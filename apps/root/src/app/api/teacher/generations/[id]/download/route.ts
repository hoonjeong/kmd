import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@kaca/common/db';
import type { RowDataPacket } from 'mysql2';

/** GET: 저장된 HWPX 파일 다운로드 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT title, hwpx_blob FROM generation_history WHERE id = ? AND user_id = ?`,
    [id, session.user.id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { title, hwpx_blob } = rows[0];

  if (!hwpx_blob) {
    return NextResponse.json({ error: 'HWPX 파일이 없습니다.' }, { status: 404 });
  }

  const buffer = Buffer.isBuffer(hwpx_blob) ? hwpx_blob : Buffer.from(hwpx_blob);
  const filename = encodeURIComponent(`${title || '변형문제'}.hwpx`);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Content-Length': String(buffer.length),
    },
  });
}
