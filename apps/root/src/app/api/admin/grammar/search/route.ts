import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { countGrammarBySubCategory } from '@kaca/common/queries/grammar';

interface RequestBody {
  keyword?: string;
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
    const keyword = body.keyword?.trim() || undefined;
    const grade = body.grade?.trim() || undefined;
    const publisher = body.publisher?.trim() || undefined;
    const totalCount = await countGrammarBySubCategory(keyword, grade, publisher);

    return new Response(JSON.stringify({ totalCount }), {
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
