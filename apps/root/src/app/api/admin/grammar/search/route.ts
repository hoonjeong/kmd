import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { searchGrammarFiles, countGrammarFiles } from '@edenschool/common/queries/grammar';

interface RequestBody {
  keyword?: string;
  limit?: number;
  offset?: number;
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
    const keyword = body.keyword?.trim() || '';
    const [files, totalCount] = await Promise.all([
      keyword ? searchGrammarFiles(keyword, body.limit || 20, body.offset || 0) : Promise.resolve([]),
      countGrammarFiles(keyword || undefined),
    ]);

    return new Response(JSON.stringify({ files, totalCount }), {
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
