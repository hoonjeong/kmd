import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { updatePassageTitleAuthor } from '@edenschool/common/queries/passage-question';

export async function POST(req: NextRequest) {
  try {
    await requireAdminApiSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { passageId, title, author } = body;

  if (!passageId || typeof passageId !== 'number') {
    return NextResponse.json({ error: 'passageId is required' }, { status: 400 });
  }

  await updatePassageTitleAuthor(passageId, title || '', author || '');

  return NextResponse.json({ ok: true });
}
