import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { getClaudeClient, buildExamQuestionPrompt } from '@/lib/claude-client';
import { selectPassageSetsByFilter } from '@edenschool/common/queries/passage-question';

interface RequestBody {
  categories?: string[];
  subCategories?: string[];
  questionPatterns?: string[];
  keyword?: string;
  difficulty?: string;
  count?: number;
  userNotes?: string;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청입니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { categories, subCategories, questionPatterns, keyword, difficulty, count, userNotes } = body;

  try {
    // 1) DB에서 조건에 맞는 문항 조회
    const passageSets = await selectPassageSetsByFilter({
      categories,
      subCategories,
      questionPatterns,
      keyword,
      passageLimit: 5,
    });

    if (passageSets.length === 0) {
      return new Response(
        JSON.stringify({ error: '조건에 맞는 참고 문항이 없습니다. 필터를 조정해주세요.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2) 프롬프트 구성
    const prompt = buildExamQuestionPrompt(passageSets, {
      categories,
      subCategories,
      questionPatterns,
      keyword,
      difficulty: difficulty || '중',
      count: count || 3,
      userNotes,
    });

    // 3) Claude API 스트리밍 호출
    const client = getClaudeClient();
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    // 4) SSE 형식으로 스트리밍 응답
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
    const message = err instanceof Error ? err.message : 'AI 문제 생성에 실패했습니다.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
