import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { getClaudeClient, buildVariantQuestionPrompt } from '@/lib/claude-client';
import type { VariantQuestionOptions } from '@/lib/claude-client';

export async function POST(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { texts: { fileName: string; text: string }[]; options?: VariantQuestionOptions };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청입니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { texts, options } = body;

  if (!Array.isArray(texts) || texts.length === 0) {
    return new Response(JSON.stringify({ error: 'texts는 비어있지 않은 배열이어야 합니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 모든 텍스트를 합쳐서 하나의 프롬프트로 생성
  const combinedText = texts
    .map((t) => `=== ${t.fileName} ===\n${t.text}`)
    .join('\n\n');

  const prompt = buildVariantQuestionPrompt(combinedText, options);

  try {
    const client = getClaudeClient();

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    // SSE 스트리밍 응답
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Claude API 오류';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Claude API 호출에 실패했습니다.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
