import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import {
  getDistinctLiteratureSubCategories,
  getDistinctLiteratureQuestionPatterns,
  countLiteratureByFilters,
} from '@edenschool/common/queries/literature';

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
    const title = sp.get('title') || undefined;
    const author = sp.get('author') || undefined;

    const [subCats, patterns, totalCount] = await Promise.all([
      getDistinctLiteratureSubCategories(),
      getDistinctLiteratureQuestionPatterns(subCategories),
      countLiteratureByFilters({ title, author, subCategories, questionPatterns }),
    ]);

    return NextResponse.json({
      subCategories: subCats,
      questionPatterns: patterns,
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
