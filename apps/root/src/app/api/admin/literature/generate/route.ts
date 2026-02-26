import { NextRequest } from 'next/server';
import { buildLiteratureQuestionPrompt } from '@/lib/claude-client';
import { jsonError } from '@/lib/api-handler';
import { handleGenerate } from '@/lib/generate-handler';
import { searchLiterature, selectLiteratureFileContent } from '@kaca/common/queries/literature';

export async function POST(req: NextRequest) {
  let body: { title?: string; author?: string; grade?: string; publisher?: string; difficulty?: string; count?: number; userNotes?: string };
  try { body = await req.json(); } catch { return jsonError('잘못된 요청입니다.'); }

  const count = body.count || 3;

  return handleGenerate(req, {
    category: '문학',
    creditCount: count,
    searchFiles: async () => {
      let metas = await searchLiterature({
        title: body.title, author: body.author,
        grade: body.grade, publisher: body.publisher, limit: 3,
      });
      if (metas.length === 0 && (body.title || body.author)) {
        metas = await searchLiterature({ title: body.title, author: body.author, limit: 3 });
      }
      return metas;
    },
    getFileContent: (metaId) => selectLiteratureFileContent(metaId),
    buildPrompt: (contents) => buildLiteratureQuestionPrompt(contents, {
      title: body.title, author: body.author,
      grade: body.grade, publisher: body.publisher,
      difficulty: body.difficulty || '중',
      count,
      userNotes: body.userNotes,
    }),
  });
}
