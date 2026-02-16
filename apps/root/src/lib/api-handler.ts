import { NextRequest, NextResponse } from 'next/server';
import { ApiUnauthorizedError } from './session';

type HandlerFn = (req: NextRequest, context?: any) => Promise<NextResponse | Response>;

export function withErrorHandler(handler: HandlerFn): HandlerFn {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof ApiUnauthorizedError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      console.error('API error:', error);
      return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 });
    }
  };
}

/** JSON 에러 응답 생성 */
export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Claude SSE 스트림을 브라우저용 SSE 응답으로 변환 */
export function createClaudeSSEResponse(stream: AsyncIterable<any>): Response {
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const data = JSON.stringify({ text: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Claude API 오류';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
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
}
