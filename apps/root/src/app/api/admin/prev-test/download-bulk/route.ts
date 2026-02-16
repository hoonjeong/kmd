import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { withErrorHandler } from '@/lib/api-handler';
import { selectPrevTestFileInfoByInfoIds } from '@edenschool/common/queries/prev-test';
import JSZip from 'jszip';

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdminApiSession();

  const body = await req.json();
  const ids: number[] = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids는 비어있지 않은 배열이어야 합니다.' }, { status: 400 });
  }

  const files = await selectPrevTestFileInfoByInfoIds(ids);

  if (files.length === 0) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const file of files) {
    if (!file.content || !file.fileName) continue;
    let name = file.fileName;
    if (usedNames.has(name)) {
      const ext = name.lastIndexOf('.');
      const base = ext > 0 ? name.substring(0, ext) : name;
      const extStr = ext > 0 ? name.substring(ext) : '';
      let counter = 1;
      while (usedNames.has(name)) {
        name = `${base}(${counter})${extStr}`;
        counter++;
      }
    }
    usedNames.add(name);
    zip.file(name, file.content);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const encodedFileName = encodeURIComponent('기출문제_일괄다운.zip');

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
      'Content-Length': String(zipBuffer.length),
    },
  });
});
