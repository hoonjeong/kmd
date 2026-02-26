import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import {
  getDistinctLiteratureGrades,
  getDistinctLiteraturePublishers,
  getDistinctLiteratureAuthors,
  countLiterature,
} from '@kaca/common/queries/literature';

export async function GET(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const grade = sp.get('grade') || undefined;
    const publisher = sp.get('publisher') || undefined;
    const title = sp.get('title') || undefined;
    const author = sp.get('author') || undefined;

    const [grades, publishers, authors, totalCount] = await Promise.all([
      getDistinctLiteratureGrades(),
      getDistinctLiteraturePublishers(grade),
      getDistinctLiteratureAuthors({ title, grade, publisher }),
      countLiterature({ title, author, grade, publisher }),
    ]);

    return NextResponse.json({
      grades,
      publishers,
      authors,
      totalCount,
    });
  } catch (err) {
    console.error('literature-filters error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB 조회 실패' },
      { status: 500 }
    );
  }
}
