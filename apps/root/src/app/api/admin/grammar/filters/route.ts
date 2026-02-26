import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import {
  getDistinctGrammarGrades,
  getDistinctGrammarPublishers,
  countGrammarBySubCategory,
} from '@kaca/common/queries/grammar';

export async function GET(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const grade = sp.get('grade') || undefined;

    const [grades, publishers, totalCount] = await Promise.all([
      getDistinctGrammarGrades(),
      getDistinctGrammarPublishers(grade),
      countGrammarBySubCategory(undefined, grade),
    ]);

    return NextResponse.json({ grades, publishers, totalCount });
  } catch (err) {
    console.error('grammar-filters error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB 조회 실패' },
      { status: 500 }
    );
  }
}
