import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { selectGrammarFileContent } from '@edenschool/common/queries/grammar';

export async function GET(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metaId = req.nextUrl.searchParams.get('metaId');
  if (!metaId || isNaN(Number(metaId))) {
    return NextResponse.json({ error: 'metaId 파라미터가 필요합니다.' }, { status: 400 });
  }

  try {
    const fileContent = await selectGrammarFileContent(Number(metaId));
    if (!fileContent) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ fileContent });
  } catch (err) {
    console.error('grammar-content error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '파일 조회 실패' },
      { status: 500 }
    );
  }
}
