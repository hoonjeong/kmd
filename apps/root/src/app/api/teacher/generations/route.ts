import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import pool from '@edenschool/common/db';
import { buildHwpx } from '@/lib/hwpx-builder';
import type { RowDataPacket } from 'mysql2';

/** POST: 생성 결과 + HWPX 저장 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    category: string;
    title: string;
    generatedText: string;
    requestParams?: Record<string, unknown>;
    difficulty?: string;
    questionCount?: number;
    template?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  if (!body.category || !body.title || !body.generatedText) {
    return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
  }

  // HWPX 생성 시도 (실패해도 텍스트는 저장)
  let hwpxBuffer: Buffer | null = null;
  try {
    hwpxBuffer = await buildHwpx(body.generatedText, body.template || 'SAMPLE');
  } catch (err) {
    console.error('HWPX 생성 실패:', err);
  }

  const [result] = await pool.execute(
    `INSERT INTO kaca.generation_history
      (user_id, category, title, generated_text, request_params, difficulty, question_count, template, hwpx_blob)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.user.id,
      body.category,
      body.title,
      body.generatedText,
      body.requestParams ? JSON.stringify(body.requestParams) : null,
      body.difficulty || '중',
      body.questionCount || 3,
      body.template || 'SAMPLE',
      hwpxBuffer,
    ]
  );

  const insertId = (result as any).insertId;
  return NextResponse.json({ id: insertId, hwpxGenerated: hwpxBuffer !== null });
}

/** GET: 생성 이력 목록 조회 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, category, title, difficulty, question_count, template,
            hwpx_blob IS NOT NULL AS has_hwpx, created_at
     FROM kaca.generation_history
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [session.user.id]
  );

  return NextResponse.json({ generations: rows });
}
