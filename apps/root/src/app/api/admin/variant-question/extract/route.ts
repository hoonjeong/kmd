import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { withErrorHandler } from '@/lib/api-handler';
import { selectPrevTestFileInfoByInfoIds } from '@kaca/common/queries/prev-test';
import { extractText } from '@/lib/text-extractor';

const MAX_FILES = 10;

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdminApiSession();

  const body = await req.json();
  const { ids } = body as { ids: number[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids는 비어있지 않은 배열이어야 합니다.' }, { status: 400 });
  }

  if (ids.length > MAX_FILES) {
    return NextResponse.json({ error: `최대 ${MAX_FILES}개까지 선택할 수 있습니다.` }, { status: 400 });
  }

  // DB에서 파일 조회
  const files = await selectPrevTestFileInfoByInfoIds(ids);

  if (files.length === 0) {
    return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 파일별 텍스트 추출
  const results: { fileName: string; text: string; error?: string }[] = [];

  for (const file of files) {
    if (!file.content || !file.fileName) {
      results.push({ fileName: file.fileName || '알 수 없음', text: '', error: '파일 내용이 없습니다.' });
      continue;
    }

    try {
      const buf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
      const text = await extractText(buf, file.fileName);
      if (!text.trim()) {
        results.push({ fileName: file.fileName, text: '', error: '텍스트를 추출할 수 없습니다. 이미지로만 구성된 파일일 수 있습니다.' });
      } else {
        results.push({ fileName: file.fileName, text });
      }
    } catch (err) {
      results.push({
        fileName: file.fileName,
        text: '',
        error: err instanceof Error ? err.message : '텍스트 추출에 실패했습니다.',
      });
    }
  }

  return NextResponse.json({ results });
});
