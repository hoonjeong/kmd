import { NextRequest, NextResponse } from 'next/server';
import pool from '@edenschool/common/db';
import { requireAdminApiSession } from '@/lib/admin-session';
import { withErrorHandler } from '@/lib/api-handler';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import {
  insertPrevTestMetaInfo,
  insertPrevTestFileInfo,
  deletePrevTestMetaInfoById,
  deletePrevTestFileInfoByInfoId,
  selectPrevTestMetaInfoAll,
  selectPrevTestMetaInfoById,
  selectPrevTestFileInfoByInfoId,
  selectPrevTestByYear,
} from '@edenschool/common/queries/prev-test';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireAdminApiSession();

  try {
    const formData = await req.formData();
    // Match original ActionPrevTestAddController field names
    const file = formData.get('formFile') as File | null;
    const region = formData.get('region') as string;
    const school_type = formData.get('school_type') as string;
    const school_name = formData.get('school_name') as string;
    const year = formData.get('year') as string;
    const grade = formData.get('grade') as string;
    const term = formData.get('term') as string;
    const test_type = formData.get('test_type') as string;
    const section = formData.get('section') as string;
    const publisher = formData.get('publisher') as string;
    const fileType = formData.get('fileType') as string;

    // Insert prev_test_meta_info (matches DataMapper: insertPrevTestMetaInfo)
    const metaId = await insertPrevTestMetaInfo({
      region,
      schoolType: school_type,
      schoolName: school_name,
      year,
      grade,
      term,
      testType: test_type,
      section,
      publisher,
      fileType,
    });

    let fileId = -1;

    // Insert prev_test_file_info if file provided (matches DataMapper: insertPrevTestFileInfo)
    if (file) {
      const fileName = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());

      fileId = await insertPrevTestFileInfo(metaId, buffer, fileName);
    }

    // Original: if PDF, insert into pdf_to_hwp table for conversion tracking
    if (fileType === 'PDF' && fileId > 0) {
      await pool.query<ResultSetHeader>(
        'INSERT INTO pdf_to_hwp (file_id, user_id, work) VALUES (?, ?, 0)',
        [fileId, session.user.id]
      );
    } else if (fileType === 'HWP' && fileId > 0) {
      // Original: if HWP, check if there's a non-processed PDF for the same test and mark it
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT fi.id FROM prev_test_meta_info mi, prev_test_file_info fi
         WHERE mi.school_name=? AND mi.year=? AND mi.grade=? AND mi.term=? AND mi.test_type=? AND mi.file_type='PDF'
         AND fi.info_id=mi.id LIMIT 1`,
        [school_name, year, grade, term, test_type]
      );
      if (rows.length > 0 && rows[0].id > 0) {
        await pool.query('UPDATE pdf_to_hwp SET work=1 WHERE file_id=?', [rows[0].id]);
      }
    }

    return NextResponse.json({ ok: true, id: metaId });
  } catch (error) {
    console.error('Insert prev test error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to insert prev test' }, { status: 500 });
  }
});

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAdminApiSession();

  try {
    const { searchParams } = new URL(req.url);
    const metaId = searchParams.get('metaId');
    const year = searchParams.get('year');

    if (metaId) {
      // Fetch single meta info + files (for edit page)
      const meta = await selectPrevTestMetaInfoById(Number(metaId));
      const fileInfo = await selectPrevTestFileInfoByInfoId(Number(metaId));
      const files = fileInfo ? [fileInfo] : [];
      return NextResponse.json({
        meta: meta || null,
        files,
      });
    }

    if (year) {
      // Matches DataMapper: selectPrevTestByYear
      const rows = await selectPrevTestByYear(year);
      return NextResponse.json(rows);
    }

    // Default: return all (matches DataMapper: selectPrevTestMetaInfoAll)
    const rows = await selectPrevTestMetaInfoAll();
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Get prev test error:', error);
    return NextResponse.json([], { status: 500 });
  }
});

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  await requireAdminApiSession();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    }

    // Java original: dao.deletePrevTestMetaInfoById(id) AND dao.deletePrevTestFileInfoByInfoId(id)
    // Must delete both meta info and file info (file info references meta via info_id)
    await deletePrevTestFileInfoByInfoId(Number(id));
    await deletePrevTestMetaInfoById(Number(id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete prev test error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to delete prev test' }, { status: 500 });
  }
});
