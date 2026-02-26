import { NextRequest } from 'next/server';
import { buildGrammarQuestionPrompt } from '@/lib/claude-client';
import { jsonError } from '@/lib/api-handler';
import { handleGenerate } from '@/lib/generate-handler';
import { searchGrammarBySubCategory, selectGrammarFileContent } from '@kaca/common/queries/grammar';

export async function POST(req: NextRequest) {
  let body: { keyword?: string; grade?: string; publisher?: string; difficulty?: string; count?: number; userNotes?: string };
  try { body = await req.json(); } catch { return jsonError('잘못된 요청입니다.'); }

  if (!body.keyword?.trim()) return jsonError('키워드를 입력해주세요.');

  const keyword = body.keyword.trim();
  const count = body.count || 3;

  return handleGenerate(req, {
    category: '문법',
    creditCount: count,
    searchFiles: () => searchGrammarBySubCategory(keyword, body.grade?.trim(), body.publisher?.trim(), 3),
    getFileContent: (metaId) => selectGrammarFileContent(metaId),
    buildPrompt: (contents) => buildGrammarQuestionPrompt(contents.join('\n\n'), {
      difficulty: body.difficulty || '중',
      count,
      userNotes: body.userNotes,
    }),
  });
}
