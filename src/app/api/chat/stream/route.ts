import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getAI, SYSTEM_PROMPT, extractMemories, extractMemoriesWithLLM, mergeExtractedMemories, getRelevantKeywords } from '@/lib/ai';
import { searchForRAG } from '@/lib/knowledge/searcher';
import { getDefaultModel } from '@/lib/models';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Extract a more specific search query from the user's message.
 * Removes filler words and extracts the core question/topic.
 */
function extractSearchQuery(message: string): string {
  // Chinese patterns that indicate search intent, extract the actual query
  const chinesePatterns = [
    /(?:搜索|搜一下|搜搜看|帮我搜|搜索一下|查一下|查查|查找|查找一下)\s*(.+)/,
    /(?:最新的|最近的|当前的|目前的)\s*(.+)/,
    /(?:新闻|资讯|消息)\s*(.+)/,
    /(.+?)\s*(?:的最新消息|的最新新闻|的最新资讯|的最新动态|的最新信息)/,
    /(.+?)\s*(?:是什么|怎么样|如何|多少钱|什么时候)/,
  ];

  for (const pattern of chinesePatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 100);
    }
  }

  // English patterns
  const englishPatterns = [
    /(?:search for|look up|find info(?:rmation)? about|search)\s+(.+)/i,
    /(?:what is the latest|what is the current|what are the recent)\s+(.+)/i,
    /(?:recent news|latest news|current events)\s*(?:about|on)?\s*(.+)/i,
  ];

  for (const pattern of englishPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 100);
    }
  }

  // Fallback: use the full message trimmed
  return message.trim().substring(0, 100);
}

/**
 * Detect if the message implies a need for web search, including Chinese intent.
 */
function needsWebSearch(message: string, tools: string[]): boolean {
  // Explicit tool selection
  if (tools.includes('web_search')) return true;

  // English search intent patterns
  const englishPattern = /(?:search for|look up|find info|what is the latest|current|recent news|today|latest update)/i;

  // Chinese search intent patterns
  const chinesePattern = /(?:搜索|搜一下|搜搜看|帮我搜|搜索一下|查一下|查查|查找|查找一下|最新的|最近的|当前的|目前的|新闻|资讯|消息|动态|今日|今天|目前|现在|实时|当前)/;

  return englishPattern.test(message) || chinesePattern.test(message);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let agentRunId: string | null = null;

  const { searchParams } = new URL(request.url);
  const message = searchParams.get('message');
  const conversationId = searchParams.get('conversationId') || undefined;
  const toolsParam = searchParams.get('tools') || '';
  const tools = toolsParam ? toolsParam.split(',').filter(Boolean) : [];
  // Optional: image/audio references for VLM/ASR tools
  const imageUrl = searchParams.get('imageUrl') || undefined;
  const imageBase64 = searchParams.get('image_base64') || undefined;
  const audioUrl = searchParams.get('audioUrl') || undefined;
  const audioBase64 = searchParams.get('audio_base64') || undefined;
  const modelParam = searchParams.get('model') || undefined;
  const selectedModel = modelParam || getDefaultModel().id;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Message is required and cannot be empty' })}\n\n`,
      {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }
    );
  }

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
        // 1. Create or get conversation
        let conversation;
        if (conversationId) {
          conversation = await db.conversation.findUnique({
            where: { id: conversationId },
            include: { messages: { orderBy: { createdAt: 'asc' } } },
          });
          if (!conversation) {
            sendEvent({ type: 'error', message: 'Conversation not found' });
            controller.close();
            return;
          }
        } else {
          const titleText = message.length > 50 ? message.substring(0, 50) + '...' : message;
          conversation = await db.conversation.create({
            data: { title: titleText },
            include: { messages: true },
          });
        }

        // Send conversation event so client knows the conversation ID
        sendEvent({ type: 'conversation', conversationId: conversation.id });

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

        // 4. Recall relevant memories with importance scoring
        const keywords = getRelevantKeywords(message);
        let relevantMemories: Array<{ id: string; content: string; memoryType: string; importance: number }> = [];

        if (keywords.length > 0) {
          const allActiveMemories = await db.memoryItem.findMany({
            where: { status: 'active' },
            select: { id: true, content: true, memoryType: true, importance: true, metadata: true },
            take: 200,
          });

          // Score memories by keyword match count and importance
          const scored = allActiveMemories
            .map((m) => {
              const contentLower = m.content.toLowerCase();
              const matchCount = keywords.filter((kw) => contentLower.includes(kw)).length;
              return { ...m, matchCount };
            })
            .filter((m) => m.matchCount > 0)
            .sort((a, b) => {
              // Sort by match count first, then by importance
              if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
              return b.importance - a.importance;
            })
            .slice(0, 10);

          relevantMemories = scored.map(({ matchCount, metadata, ...rest }) => rest);

          // Update access count in metadata for recalled memories
          for (const mem of scored) {
            try {
              const currentMeta = typeof mem.metadata === 'string' ? JSON.parse(mem.metadata) : (mem.metadata || {});
              const accessCount = (currentMeta.accessCount || 0) + 1;
              await db.memoryItem.update({
                where: { id: mem.id },
                data: {
                  metadata: JSON.stringify({ ...currentMeta, accessCount, lastAccessedAt: new Date().toISOString() }),
                },
              });
            } catch {
              // Non-critical: skip if metadata update fails
            }
          }
        }

        // Send memory_refs event so frontend knows which memories were referenced
        if (relevantMemories.length > 0) {
          sendEvent({
            type: 'memory_refs',
            memoryIds: relevantMemories.map((m) => m.id),
            count: relevantMemories.length,
          });
        }

        // 5. Build conversation history for LLM
        const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: SYSTEM_PROMPT },
        ];

        // Add memory context with importance levels (Chinese format)
        if (relevantMemories.length > 0) {
          const memoryContext = relevantMemories
            .map((m) => `- ${m.content} (类型: ${m.memoryType}, 重要性: ${m.importance.toFixed(1)})`)
            .join('\n');
          chatMessages.push({
            role: 'system',
            content: `[相关记忆]\n${memoryContext}\n\n请在回答时参考以上相关记忆信息。`,
          });
        }

        // --- RAG Knowledge Retrieval ---
        let knowledgeRefCount = 0;
        try {
          const knowledgeResults = await searchForRAG(message.trim(), 5, 0.1);
          if (knowledgeResults.length > 0) {
            knowledgeRefCount = knowledgeResults.length;
            const knowledgeContext = knowledgeResults
              .map((r, i) => `${i + 1}. [来源: ${r.docTitle}] ${r.content}`)
              .join('\n');
            chatMessages.push({
              role: 'system',
              content: `[知识库检索结果]\n${knowledgeContext}\n\n请在回答时参考以上知识库中的相关内容，并在适用时引用来源文档名。`,
            });
            sendEvent({
              type: 'knowledge_refs',
              count: knowledgeRefCount,
              sources: knowledgeResults.map(r => r.docTitle),
            });
          }
        } catch (ragError) {
          console.error('RAG knowledge retrieval error:', ragError);
          // Non-critical: continue without knowledge context
        }

        // Add conversation history (last 20 messages for context window)
        const historyMessages = conversation.messages.slice(-20);
        for (const msg of historyMessages) {
          chatMessages.push({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          });
        }

        // 6. Call LLM with streaming
        const ai = await getAI();
        let toolsUsedList: string[] = [];
        let fullResponse = '';

        // --- VLM Tool: Analyze image before sending to LLM ---
        const hasImage = imageUrl || imageBase64;
        if (tools.includes('vlm') && hasImage) {
          try {
            toolsUsedList.push('vlm');
            sendEvent({ type: 'tool_status', tool: 'vlm', status: 'analyzing_image' });

            let vlmImageUrl: string;
            if (imageBase64) {
              // Construct data URL from base64
              vlmImageUrl = imageBase64.startsWith('data:')
                ? imageBase64
                : `data:image/png;base64,${imageBase64}`;
            } else if (imageUrl) {
              vlmImageUrl = imageUrl;
            } else {
              throw new Error('No image data available');
            }

            const vlmResponse = await ai.chat.completions.createVision({
              model: 'glm-4v-flash',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: '详细描述这张图片的内容，包括关键元素、场景、文字等信息。' },
                    { type: 'image_url', image_url: { url: vlmImageUrl } },
                  ],
                },
              ],
              thinking: { type: 'disabled' },
            });

            const imageAnalysis = vlmResponse.choices?.[0]?.message?.content || '';

            if (imageAnalysis) {
              // Add image analysis as context for the LLM
              chatMessages.push({
                role: 'system',
                content: `Image analysis result (VLM):\n${imageAnalysis}\n\nThe user's message may reference this image. Use this analysis to provide a better response.`,
              });
              sendEvent({ type: 'vlm_result', analysis: imageAnalysis });
            }
          } catch (vlmError) {
            console.error('VLM analysis error:', vlmError);
            sendEvent({ type: 'tool_error', tool: 'vlm', error: 'Failed to analyze image' });
          }
        }

        // --- ASR Tool: Transcribe audio before sending to LLM ---
        const hasAudio = audioUrl || audioBase64;
        if (tools.includes('asr') && hasAudio) {
          try {
            toolsUsedList.push('asr');
            sendEvent({ type: 'tool_status', tool: 'asr', status: 'transcribing_audio' });

            let base64Audio: string;
            if (audioBase64) {
              base64Audio = audioBase64;
            } else if (audioUrl) {
              // Fetch the audio file from URL
              const audioResponse = await fetch(audioUrl);
              if (!audioResponse.ok) {
                throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
              }
              const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
              base64Audio = audioBuffer.toString('base64');
            } else {
              throw new Error('No audio data available');
            }

            const asrResponse = await ai.audio.asr.create({
              file_base64: base64Audio,
            });

            const transcription = asrResponse.text || '';

            if (transcription) {
              // Add transcription as context for the LLM
              chatMessages.push({
                role: 'system',
                content: `Audio transcription (ASR):\n${transcription}\n\nThe user's message may reference this audio. Use this transcription to provide a better response.`,
              });
              sendEvent({ type: 'asr_result', text: transcription });
            }
          } catch (asrError) {
            console.error('ASR transcription error:', asrError);
            sendEvent({ type: 'tool_error', tool: 'asr', error: 'Failed to transcribe audio' });
          }
        }

        // --- Web Search: Enhanced with Chinese support ---
        if (needsWebSearch(message, tools)) {
          try {
            const searchQuery = extractSearchQuery(message);
            sendEvent({ type: 'tool_status', tool: 'web_search', status: 'searching', query: searchQuery });

            const searchResults = await ai.functions.invoke('web_search', {
              query: searchQuery,
              num: 5,
            });

            toolsUsedList.push('web_search');

            if (Array.isArray(searchResults) && searchResults.length > 0) {
              const searchContext = searchResults
                .map(
                  (r: { name: string; snippet: string; url: string }, i: number) =>
                    `${i + 1}. ${r.name}: ${r.snippet} (${r.url})`
                )
                .join('\n');

              chatMessages.push({
                role: 'system',
                content: `Web search results:\n${searchContext}\n\nUse this information to answer the user's question. Always cite your sources.`,
              });
              sendEvent({ type: 'search_results', query: searchQuery, count: searchResults.length });
            } else {
              chatMessages.push({
                role: 'system',
                content: 'Web search did not return any results. Answer based on your knowledge and let the user know you could not find current information.',
              });
            }
          } catch (searchError) {
            console.error('Web search failed:', searchError);
            sendEvent({ type: 'tool_error', tool: 'web_search', error: 'Search failed' });
            // Continue without search context
          }
        }

        // Add current user message
        chatMessages.push({ role: 'user', content: message.trim() });

        // Stream the LLM response
        try {
          const llmStream = await ai.chat.completions.create({
            model: selectedModel,
            messages: chatMessages,
            stream: true,
          });

          for await (const chunk of llmStream) {
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              sendEvent({ type: 'token', content });
            }
          }
        } catch (llmError) {
          console.error('LLM streaming error:', llmError);
          // If streaming fails, try non-streaming as fallback
          try {
            const completion = await ai.chat.completions.create({
              model: selectedModel,
              messages: chatMessages,
              stream: false,
            });
            fullResponse =
              completion?.choices?.[0]?.message?.content ||
              completion?.content ||
              (typeof completion === 'string'
                ? completion
                : '抱歉，生成回复时遇到问题。请稍后再试。');
            // Send the full response as a single token
            sendEvent({ type: 'token', content: fullResponse });
          } catch (fallbackError) {
            console.error('LLM fallback error:', fallbackError);
            sendEvent({
              type: 'error',
              message: 'Failed to generate response',
            });
          }
        }

        if (!fullResponse) {
          fullResponse = '抱歉，我无法生成回复。请稍后再试。';
        }

        // Handle image generation tool
        if (tools.includes('image_gen')) {
          try {
            toolsUsedList.push('image_gen');
            const imageResponse = await ai.images.generations.create({
              prompt: message.trim(),
              size: '1024x1024',
            });
            const imageBase64Result = imageResponse.data[0].base64;
            const filename = `img_${Date.now()}.png`;
            const publicDir = path.join(process.cwd(), 'public', 'generated');
            if (!fs.existsSync(publicDir)) {
              fs.mkdirSync(publicDir, { recursive: true });
            }
            const filepath = path.join(publicDir, filename);
            const imageBuffer = Buffer.from(imageBase64Result, 'base64');
            fs.writeFileSync(filepath, imageBuffer);
            sendEvent({ type: 'image', url: `/generated/${filename}`, prompt: message.trim() });
          } catch (imgErr) {
            console.error('Image generation error:', imgErr);
          }
        }

        // Handle TTS tool
        if (tools.includes('tts')) {
          try {
            toolsUsedList.push('tts');
            const ttsText = fullResponse.trim().substring(0, 1024);
            if (ttsText.length > 0) {
              const ttsResponse = await ai.audio.tts.create({
                input: ttsText,
                voice: 'tongtong',
                speed: 1.0,
                response_format: 'mp3',
                stream: false,
              });
              const ttsArrayBuffer = await ttsResponse.arrayBuffer();
              const ttsBuffer = Buffer.from(new Uint8Array(ttsArrayBuffer));
              // Save TTS audio to public directory
              const audioFilename = `tts_${Date.now()}.mp3`;
              const audioPublicDir = path.join(process.cwd(), 'public', 'generated');
              if (!fs.existsSync(audioPublicDir)) {
                fs.mkdirSync(audioPublicDir, { recursive: true });
              }
              const audioFilepath = path.join(audioPublicDir, audioFilename);
              fs.writeFileSync(audioFilepath, ttsBuffer);
              sendEvent({ type: 'audio', url: `/generated/${audioFilename}` });
            }
          } catch (ttsErr) {
            console.error('TTS error:', ttsErr);
          }
        }

        // 7. Save assistant message to DB
        const assistantMessage = await db.message.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: fullResponse,
            model: selectedModel,
            toolsCalled: JSON.stringify(toolsUsedList),
            memoryRefs: JSON.stringify(relevantMemories.map((m) => m.id)),
          },
        });

        // 8. Auto-extract and save memories (regex + LLM)
        const regexMemories = extractMemories(message);
        let llmMemories: Array<{ memoryType: string; content: string; importance: number }> = [];

        // Use LLM extraction for longer messages (>50 chars) to save API costs
        if (message.trim().length > 50) {
          try {
            llmMemories = await extractMemoriesWithLLM(message, fullResponse);
          } catch (llmErr) {
            console.error('LLM memory extraction error:', llmErr);
          }
        }

        // Merge and deduplicate
        const extractedMemories = mergeExtractedMemories(regexMemories, llmMemories);
        let newMemoryCount = 0;

        for (const mem of extractedMemories) {
          try {
            // Check for duplicate content in existing memories
            const existing = await db.memoryItem.findFirst({
              where: { content: { contains: mem.content.substring(0, 20) }, status: 'active' },
            });
            if (existing) continue; // Skip if similar memory exists

            await db.memoryItem.create({
              data: {
                memoryType: mem.memoryType,
                content: mem.content,
                importance: mem.importance,
                confidence: 0.8,
                sourceType: 'chat',
                sourceId: userMessage.id,
                status: 'active',
                metadata: JSON.stringify({ extractedBy: message.trim().length > 50 ? 'regex+llm' : 'regex', accessCount: 0 }),
                versions: {
                  create: {
                    versionNo: 1,
                    content: mem.content,
                    changeReason: 'Auto-extracted from conversation',
                  },
                },
              },
            });
            newMemoryCount++;
            // Notify client about extracted memory
            sendEvent({
              type: 'memory',
              memoryType: mem.memoryType,
              content: mem.content,
            });
          } catch (memError) {
            console.error('Failed to save extracted memory:', memError);
          }
        }

        // Send memory extraction summary
        if (newMemoryCount > 0) {
          sendEvent({
            type: 'memory_extracted',
            count: newMemoryCount,
            methods: message.trim().length > 50 ? ['regex', 'llm'] : ['regex'],
          });
        }

        // 9. Update agent run as success
        const duration = Date.now() - startTime;
        await db.agentRun.update({
          where: { id: agentRunId },
          data: {
            status: 'success',
            outputText: fullResponse.substring(0, 500),
            toolsUsed: JSON.stringify(toolsUsedList),
            duration,
            endedAt: new Date(),
          },
        });

        // 10. Send done event
        sendEvent({
          type: 'done',
          messageId: assistantMessage.id,
          conversationId: conversation.id,
          toolsUsed: toolsUsedList,
        });

        controller.close();
      } catch (error) {
        console.error('Chat stream API error:', error);

        // Send error event
        sendEvent({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to process chat message',
        });

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
