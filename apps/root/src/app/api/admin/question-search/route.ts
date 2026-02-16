import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { selectPassageSetsByFilter } from '@edenschool/common/queries/passage-question';

interface RequestBody {
  categories?: string[];
  subCategories?: string[];
  questionPatterns?: string[];
  keyword?: string;
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

  const { categories, subCategories, questionPatterns, keyword } = body;

  try {
    const passageSets = await selectPassageSetsByFilter({
      categories,
      subCategories,
      questionPatterns,
      keyword,
      passageLimit: 2,
    });

    return new Response(JSON.stringify({ passageSets }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '문항 검색에 실패했습니다.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
