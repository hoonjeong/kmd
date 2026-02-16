import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@edenschool/common/db';
import type { RowDataPacket } from 'mysql2';

/** GET: 단건 상세 조회 (generated_text 포함) */
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
    `SELECT id, category, title, generated_text, request_params, difficulty,
            question_count, template, hwpx_blob IS NOT NULL AS has_hwpx, created_at
     FROM kaca.generation_history
     WHERE id = ? AND user_id = ?`,
    [id, session.user.id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ generation: rows[0] });
}
