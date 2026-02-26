import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { getLiteratureWorksByAuthor } from '@kaca/common/queries/literature';

export async function GET(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const author = req.nextUrl.searchParams.get('author')?.trim();
  if (!author) {
    return NextResponse.json({ works: [] });
  }

  try {
    const works = await getLiteratureWorksByAuthor(author);
    return NextResponse.json({ works });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '작품 조회 실패' },
      { status: 500 },
    );
  }
}
