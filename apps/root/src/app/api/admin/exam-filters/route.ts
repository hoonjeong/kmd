import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import {
  getDistinctSubCategories,
  getDistinctQuestionPatterns,
  countQuestionsByFilter,
} from '@edenschool/common/queries/passage-question';

export async function GET(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sp = req.nextUrl.searchParams;
    const categories = sp.get('categories')?.split(',').filter(Boolean) || undefined;
    const subCategories = sp.get('subCategories')?.split(',').filter(Boolean) || undefined;
    const questionPatterns = sp.get('questionPatterns')?.split(',').filter(Boolean) || undefined;
    const keyword = sp.get('keyword') || undefined;

    const [subCats, patterns, totalCount] = await Promise.all([
      getDistinctSubCategories(categories),
      getDistinctQuestionPatterns(categories),
      countQuestionsByFilter({ categories, subCategories, questionPatterns, keyword }),
    ]);

    return NextResponse.json({
      subCategories: subCats,
      questionPatterns: patterns,
      totalCount,
    });
  } catch (err) {
    console.error('exam-filters error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DB 조회 실패' },
      { status: 500 }
    );
  }
}
