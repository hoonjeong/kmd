import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { getClaudeClient, buildReadingQuestionPrompt } from '@/lib/claude-client';
import { jsonError, createClaudeSSEResponse } from '@/lib/api-handler';
import { selectReadingPassageSets } from '@edenschool/common/queries/reading';
import { deductCredits } from '@/lib/credits';

interface RequestBody {
  keyword?: string;
  subCategories?: string[];
  questionPatterns?: string[];
  difficulty?: string;
  count?: number;
  userNotes?: string;
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireAdminApiSession(); } catch { return jsonError('Unauthorized', 401); }

  let body: RequestBody;
  try { body = await req.json(); } catch { return jsonError('잘못된 요청입니다.'); }

  const creditCount = body.count || 3;
  const creditDesc = `독서 문제 생성 (${creditCount}문항)`;
  const creditError = await deductCredits(String(session.user.id), session.user.role, creditCount, creditDesc);
  if (creditError) return jsonError(creditError);

  try {
    let passageSets = await selectReadingPassageSets({
      keyword: body.keyword,
      subCategories: body.subCategories,
      questionPatterns: body.questionPatterns,
      passageLimit: 5,
    });

    // 결과 없으면 키워드만으로 재검색
    if (passageSets.length === 0 && body.keyword) {
      passageSets = await selectReadingPassageSets({
        keyword: body.keyword,
        passageLimit: 5,
      });
    }

    // 그래도 없으면 세부영역/유형만으로 재검색
    if (passageSets.length === 0 && (body.subCategories?.length || body.questionPatterns?.length)) {
      passageSets = await selectReadingPassageSets({
        subCategories: body.subCategories,
        questionPatterns: body.questionPatterns,
        passageLimit: 5,
      });
    }

    if (passageSets.length === 0) {
      return jsonError('조건에 맞는 참고 문항이 없습니다. 필터를 조정해주세요.');
    }

    const prompt = buildReadingQuestionPrompt(passageSets, {
      subCategories: body.subCategories,
      questionPatterns: body.questionPatterns,
      keyword: body.keyword,
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
