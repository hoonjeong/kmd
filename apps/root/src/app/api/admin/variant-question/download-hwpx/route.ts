import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { withErrorHandler } from '@/lib/api-handler';
import { buildHwpx } from '@/lib/hwpx-builder';

export const POST = withErrorHandler(async (req: NextRequest) => {
  await requireAdminApiSession();

  const body = await req.json();
  const { content, title, template } = body as {
    content: string;
    title?: string;
    template?: string;
  };

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: '내용이 비어있습니다.' }, { status: 400 });
  }

  const hwpxBuffer = await buildHwpx(content, template || 'SAMPLE');
  const fileName = title || '변형문제';
  const encodedFileName = encodeURIComponent(`${fileName}.hwpx`);

  return new NextResponse(new Uint8Array(hwpxBuffer), {
    headers: {
      'Content-Type': 'application/hwp+zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
      'Content-Length': String(hwpxBuffer.length),
    },
  });
});
