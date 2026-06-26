import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAI, SYSTEM_PROMPT, extractMemories, extractMemoriesWithLLM, mergeExtractedMemories } from '@/lib/ai';
import { getDefaultModel } from '@/lib/models';
import { recallMemories, createMemoryWithEmbedding } from '@/lib/memory-engine';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let agentRunId: string | null = null;

  try {
    const body = await request.json();
    const { conversationId, message, tools, model } = body as {
      conversationId?: string;
      message: string;
      tools?: string[];
      model?: string;
    };

    const selectedModel = model || getDefaultModel().id;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required and cannot be empty' },
        { status: 400 }
      );
    }

    // 1. Create or get conversation
    let conversation;
    if (conversationId) {
      conversation = await db.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
    } else {
      // Generate a title from the first message
      const titleText = message.length > 50 ? message.substring(0, 50) + '...' : message;
      conversation = await db.conversation.create({
        data: { title: titleText },
        include: { messages: true },
      });
    }

    // 2. Save user message
    const userMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message.trim(),
      },
    });

    // 3. Create agent run
    const agentRun = await db.agentRun.create({
      data: {
        agentId: 'avatar-agent',
        userId: 'default-user',
        taskName: 'chat-response',
        status: 'running',
        inputText: message.trim(),
        toolsUsed: JSON.stringify(tools || []),
        startedAt: new Date(),
      },
    });
    agentRunId = agentRun.id;

    // 4. Recall relevant memories using semantic + keyword hybrid search
    //    (升级:用 memory-engine 的向量召回,而非纯关键词匹配)
    const recallResults = await recallMemories(message, 'default-user', 8);
    const relevantMemories = recallResults.map((r) => ({
      id: r.memory.id,
      content: r.memory.content,
      memoryType: r.memory.memoryType,
      importance: r.memory.importance,
      score: r.score,
    }));

    // 5. Build conversation history for LLM
    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add memory context if available (升级:显示重要性 + 召回评分)
    if (relevantMemories.length > 0) {
      const memoryContext = relevantMemories
        .map((m) => `- ${m.content} (类型: ${m.memoryType}, 重要性: ${(m.importance as number).toFixed(2)})`)
        .join('\n');
      chatMessages.push({
        role: 'system',
        content: `[相关记忆 — 以下是你应该参考的关于用户的长期记忆,按相关性排序]\n${memoryContext}\n\n请在回答时参考以上记忆。如果用户提到的新信息与某条记忆矛盾,请确认并更新。`,
      });
    }

    // Add conversation history (last 20 messages for context window)
    const historyMessages = conversation.messages.slice(-20);
    for (const msg of historyMessages) {
      chatMessages.push({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      });
    }

    // Add current user message
    chatMessages.push({ role: 'user', content: message.trim() });

    // 6. Call LLM
    const ai = await getAI();
    let toolsUsedList: string[] = [];
    let finalResponse = '';
    let totalTokensUsed: number | null = null;

    // Check if web search is needed
    const needsWebSearch = tools?.includes('web_search') ||
      /(?:search for|look up|find info|what is the latest|current|recent news|today)/i.test(message);

    if (needsWebSearch) {
      // First, do the web search
      try {
        const searchResults = await ai.functions.invoke('web_search', {
          query: message.trim(),
          num: 5,
        });

        toolsUsedList.push('web_search');

        // Add search results to the context
        const searchContext = searchResults
          .map((r: { name: string; snippet: string; url: string }, i: number) =>
            `${i + 1}. ${r.name}: ${r.snippet} (${r.url})`
          )
          .join('\n');

        chatMessages.push({
          role: 'system',
          content: `Web search results:\n${searchContext}\n\nUse this information to answer the user's question. Always cite your sources.`,
        });

        // Now call LLM with search context
        const completion = await ai.chat.completions.create({
          model: selectedModel,
          messages: chatMessages,
          stream: false,
        });

        finalResponse = completion?.choices?.[0]?.message?.content ||
          completion?.content ||
          (typeof completion === 'string' ? completion : 'I found some results but couldn\'t generate a response.');
        totalTokensUsed = completion?.usage?.total_tokens || null;
      } catch (searchError) {
        console.error('Web search failed:', searchError);
        // Fall back to LLM without search
        const completion = await ai.chat.completions.create({
          model: selectedModel,
          messages: chatMessages,
          stream: false,
        });

        finalResponse = completion?.choices?.[0]?.message?.content ||
          completion?.content ||
          (typeof completion === 'string' ? completion : 'I apologize, but I couldn\'t complete the search. How else can I help you?');
        totalTokensUsed = completion?.usage?.total_tokens || null;
      }
    } else {
      // Regular LLM call
      const completion = await ai.chat.completions.create({
        model: selectedModel,
        messages: chatMessages,
        stream: false,
      });

      finalResponse = completion?.choices?.[0]?.message?.content ||
        completion?.content ||
        (typeof completion === 'string' ? completion : 'I apologize, but I couldn\'t generate a response.');
      totalTokensUsed = completion?.usage?.total_tokens || null;
    }

    // 7. Save assistant message
    const assistantMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: finalResponse,
        model: selectedModel,
        tokensUsed: totalTokensUsed,
        toolsCalled: JSON.stringify(toolsUsedList),
        memoryRefs: JSON.stringify(relevantMemories.map((m) => m.id)),
      },
    });

    // 8. Auto-extract and save memories
    //    升级:regex + LLM 双重提取,合并去重,带 embedding + 矛盾检测
    const regexMemories = extractMemories(message);
    let llmMemories: typeof regexMemories = [];

    // 长消息(>50字符)用 LLM 提取更细粒度的记忆
    if (message.trim().length > 50) {
      try {
        llmMemories = await extractMemoriesWithLLM(message, finalResponse);
      } catch (err) {
        console.error('[Chat] LLM memory extraction failed:', err);
      }
    }

    const mergedMemories = mergeExtractedMemories(regexMemories, llmMemories);
    let memoryCreated = false;

    for (const mem of mergedMemories) {
      try {
        // 用 memory-engine 创建,带 embedding + 矛盾检测
        await createMemoryWithEmbedding({
          content: mem.content,
          memoryType: mem.memoryType,
          importance: mem.importance,
          confidence: 0.8,
          sourceType: 'chat',
          metadata: {
            sourceId: userMessage.id,
            extractedBy: message.trim().length > 50 ? 'regex+llm' : 'regex',
          },
        });
        memoryCreated = true;
      } catch (memError) {
        console.error('Failed to save extracted memory:', memError);
      }
    }

    // 9. Update agent run
    const duration = Date.now() - startTime;
    await db.agentRun.update({
      where: { id: agentRunId },
      data: {
        status: 'success',
        outputText: finalResponse.substring(0, 500),
        toolsUsed: JSON.stringify(toolsUsedList),
        duration,
        endedAt: new Date(),
      },
    });

    // 10. Return response
    return NextResponse.json({
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      response: finalResponse,
      memoryCreated,
      toolsUsed: toolsUsedList,
    });
  } catch (error) {
    console.error('Chat API error:', error);

    // Update agent run as failed
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

    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
