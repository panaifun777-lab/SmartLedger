import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { extractMemories } from '@/lib/ai';
import {
  classifyIntent,
  createPlan,
  executePlan,
  buildPlanContext,
} from '@/lib/agent/orchestrator';
import type { TaskPlan, OrchestratorConfig } from '@/lib/agent/types';
import { getDefaultModel } from '@/lib/models';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/orchestrate
 *
 * Intelligent orchestration endpoint that:
 * 1. Classifies user intent
 * 2. Creates a task plan with ordered steps
 * 3. Executes steps sequentially with context passing
 * 4. Returns SSE stream with events: plan, step_start, step_result, step_error, final_result, done
 *
 * Request body: { message, conversationId?, tools?, imageUrl?, imageBase64?, audioUrl?, audioBase64? }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let agentRunId: string | null = null;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const message = body.message as string | undefined;
  const conversationId = body.conversationId as string | undefined;
  const tools = (body.tools as string[]) || [];
  const imageUrl = body.imageUrl as string | undefined;
  const imageBase64 = body.image_base64 as string | undefined;
  const audioUrl = body.audioUrl as string | undefined;
  const audioBase64 = body.audio_base64 as string | undefined;
  const model = body.model as string | undefined;
  const selectedModel = model || getDefaultModel().id;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Message is required and cannot be empty' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const hasImage = !!(imageUrl || imageBase64);
  const hasAudio = !!(audioUrl || audioBase64);

  // 1. Classify intent
  const intent = classifyIntent(message, tools, hasImage, hasAudio);

  // 2. Create execution plan
  const plan = createPlan(intent, message, tools, hasImage, hasAudio);

  // 3. Build context
  const context = buildPlanContext(message, conversationId, tools, imageUrl, imageBase64, audioUrl, audioBase64, selectedModel);

  // Build orchestrator config with the selected model
  const orchestratorConfig: OrchestratorConfig = {
    llmModel: selectedModel,
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      try {
        // Create or get conversation
        let dbConversation;
        if (conversationId) {
          dbConversation = await db.conversation.findUnique({
            where: { id: conversationId },
            include: { messages: { orderBy: { createdAt: 'asc' } } },
          });
          if (!dbConversation) {
            sendEvent({ type: 'error', message: 'Conversation not found' });
            controller.close();
            return;
          }
        } else {
          const titleText = message.length > 50 ? message.substring(0, 50) + '...' : message;
          dbConversation = await db.conversation.create({
            data: { title: titleText },
            include: { messages: true },
          });
        }

        // Send conversation ID
        sendEvent({ type: 'conversation', conversationId: dbConversation.id });

        // Save user message
        const userMessage = await db.message.create({
          data: {
            conversationId: dbConversation.id,
            role: 'user',
            content: message.trim(),
          },
        });

        // Create agent run
        const agentRun = await db.agentRun.create({
          data: {
            agentId: 'avatar-agent',
            userId: 'default-user',
            taskName: `orchestrate-${intent}`,
            status: 'running',
            inputText: message.trim(),
            toolsUsed: JSON.stringify(tools),
            startedAt: new Date(),
          },
        });
        agentRunId = agentRun.id;

        // Add conversation history to context
        const historyMessages = dbConversation.messages.slice(-20);
        for (const msg of historyMessages) {
          context.chatMessages.push({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          });
        }

        // Execute the plan
        let finalContent = '';
        let finalToolsUsed: string[] = [];
        let finalPlan: TaskPlan = plan;

        for await (const event of executePlan(plan, context, orchestratorConfig)) {
          // Forward all events to the client
          sendEvent(event as unknown as Record<string, unknown>);

          // Track the final result
          if (event.type === 'final_result') {
            finalContent = event.content;
            finalToolsUsed = event.toolsUsed;
          }
          if (event.type === 'plan') {
            finalPlan = event.plan;
          }
        }

        if (!finalContent) {
          finalContent = '抱歉，我无法生成回复。请稍后再试。';
        }

        // Save assistant message to DB
        const assistantMessage = await db.message.create({
          data: {
            conversationId: dbConversation.id,
            role: 'assistant',
            content: finalContent,
            model: selectedModel,
            toolsCalled: JSON.stringify(finalToolsUsed),
            memoryRefs: JSON.stringify(context.relevantMemories?.map((m) => m.id) || []),
            metadata: JSON.stringify({
              orchestration: true,
              intent,
              planId: finalPlan.id,
              steps: finalPlan.steps.map((s) => ({
                id: s.id,
                type: s.type,
                name: s.name,
                status: s.status,
                duration: s.duration,
              })),
            }),
          },
        });

        // Auto-extract and save memories
        const extractedMemories = extractMemories(message);
        for (const mem of extractedMemories) {
          try {
            await db.memoryItem.create({
              data: {
                memoryType: mem.memoryType,
                content: mem.content,
                importance: mem.importance,
                confidence: 0.8,
                sourceType: 'chat',
                sourceId: userMessage.id,
                status: 'active',
                versions: {
                  create: {
                    versionNo: 1,
                    content: mem.content,
                    changeReason: 'Auto-extracted from conversation',
                  },
                },
              },
            });
            sendEvent({
              type: 'memory',
              memoryType: mem.memoryType,
              content: mem.content,
            });
          } catch (memError) {
            console.error('Failed to save extracted memory:', memError);
          }
        }

        // Update agent run as success
        const duration = Date.now() - startTime;
        await db.agentRun.update({
          where: { id: agentRunId },
          data: {
            status: 'success',
            outputText: finalContent.substring(0, 500),
            toolsUsed: JSON.stringify(finalToolsUsed),
            duration,
            endedAt: new Date(),
          },
        });

        // Send done event with the complete plan for UI rendering
        sendEvent({
          type: 'done',
          messageId: assistantMessage.id,
          conversationId: dbConversation.id,
          toolsUsed: finalToolsUsed,
          plan: {
            id: finalPlan.id,
            intent: finalPlan.intent,
            steps: finalPlan.steps.map((s) => ({
              id: s.id,
              type: s.type,
              name: s.name,
              icon: s.icon,
              status: s.status,
              duration: s.duration,
              error: s.error,
            })),
          },
        });

        controller.close();
      } catch (error) {
        console.error('Orchestrate API error:', error);

        sendEvent({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to process message',
        });

        if (agentRunId) {
          try {
            await db.agentRun.update({
              where: { id: agentRunId },
              data: {
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime,
                endedAt: new Date(),
              },
            });
          } catch {
            // Ignore update errors
          }
        }

        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
