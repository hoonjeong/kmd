import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { searchLiterature, selectLiteratureFileContent } from '@kaca/common/queries/literature';

interface RequestBody {
  title?: string;
  author?: string;
  grade?: string;
  publisher?: string;
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

  try {
    const metas = await searchLiterature({
      title: body.title,
      author: body.author,
      grade: body.grade,
      publisher: body.publisher,
      limit: 5,
    });

    // 각 메타에 대해 파일 내용 조회
    const results = [];
    for (const meta of metas) {
      const file = await selectLiteratureFileContent(meta.id);
      results.push({
        meta,
        fileContent: file ? (typeof file.content === 'string' ? file.content : null) : null,
        fileName: file?.fileName || null,
      });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '검색에 실패했습니다.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
