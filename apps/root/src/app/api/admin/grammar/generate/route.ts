import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { getClaudeClient, buildGrammarQuestionPrompt } from '@/lib/claude-client';
import { jsonError, createClaudeSSEResponse } from '@/lib/api-handler';
import { selectGrammarFileContent } from '@edenschool/common/queries/grammar';
import { deductCredits } from '@/lib/credits';

interface RequestBody {
  metaIds: number[];
  difficulty?: string;
  count?: number;
  userNotes?: string;
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAdminApiSession(); } catch { return jsonError('Unauthorized', 401); }

  let body: RequestBody;
  try { body = await req.json(); } catch { return jsonError('잘못된 요청입니다.'); }

  if (!Array.isArray(body.metaIds) || body.metaIds.length === 0) {
    return jsonError('생성할 파일을 선택해주세요.');
  }

  const creditCount = body.count || 3;
  const creditDesc = `문법 문제 생성 (${creditCount}문항)`;
  const creditError = await deductCredits(String(session.user.id), session.user.role, creditCount, creditDesc);
  if (creditError) return jsonError(creditError);

  try {
    const contents: string[] = [];
    for (const metaId of body.metaIds.slice(0, 5)) {
      const fc = await selectGrammarFileContent(metaId);
      if (fc?.content) {
        const text = typeof fc.content === 'string' ? fc.content : fc.content.toString('utf8');
        contents.push(`=== ${fc.fileName || `파일 ${metaId}`} ===\n${text}`);
      }
    }

    if (contents.length === 0) {
      return jsonError('선택한 파일에 콘텐츠가 없습니다.');
    }

    const combinedText = contents.join('\n\n');
    const prompt = buildGrammarQuestionPrompt(combinedText, {
      difficulty: body.difficulty || '중',
      count: body.count || 3,
      userNotes: body.userNotes,
    });

    const client = getClaudeClient();
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    return createClaudeSSEResponse(stream);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 문제 생성에 실패했습니다.';
    return jsonError(message, 500);
  }
}
