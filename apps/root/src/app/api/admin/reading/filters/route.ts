import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import {
  getDistinctReadingSubCategories,
  getDistinctReadingQuestionPatterns,
  countReadingByFilters,
} from '@edenschool/common/queries/reading';

export async function GET(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const subCategories = sp.get('subCategories')?.split(',').filter(Boolean) || undefined;
    const questionPatterns = sp.get('questionPatterns')?.split(',').filter(Boolean) || undefined;
    const keyword = sp.get('keyword') || undefined;

    const [subCats, patterns, totalCount] = await Promise.all([
      getDistinctReadingSubCategories(),
      getDistinctReadingQuestionPatterns(subCategories),
      countReadingByFilters({ keyword, subCategories, questionPatterns }),
    ]);

    return NextResponse.json({
      subCategories: subCats,
      questionPatterns: patterns,
      totalCount,
    });
  } catch (err) {
    console.error('reading-filters error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB 조회 실패' },
      { status: 500 }
    );
  }
}
