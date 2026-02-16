import JSZip from 'jszip';

/**
 * 파일 확장자에 따라 적절한 텍스트 추출기를 호출합니다.
 * 지원: .hwp, .pdf, .hwpx
 */
export async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop() || '';

  switch (ext) {
    case 'hwp': {
      const { extractTextFromHwp } = await import('./hwp-extractor');
      return extractTextFromHwp(buffer);
    }
    case 'pdf': {
      const { extractTextFromPdf } = await import('./pdf-extractor');
      return await extractTextFromPdf(buffer);
    }
    case 'hwpx':
      return await extractTextFromHwpx(buffer);
    default:
      throw new Error(`지원하지 않는 파일 형식입니다: .${ext}`);
  }
}

/**
 * HWPX 파일(ZIP 기반)에서 텍스트를 추출합니다.
 * Contents/section*.xml 파일에서 <hp:t> 태그의 텍스트를 추출합니다.
 */
async function extractTextFromHwpx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];

  // section0.xml, section1.xml, ... 순서대로 읽기
  for (let i = 0; ; i++) {
    const sectionFile = zip.file(`Contents/section${i}.xml`);
    if (!sectionFile) break;

    const xml = await sectionFile.async('string');
    // <hp:t> 태그에서 텍스트 추출
    const matches = xml.match(/<hp:t[^>]*>([^<]*)<\/hp:t>/g);
    if (matches) {
      for (const match of matches) {
        const text = match.replace(/<hp:t[^>]*>/, '').replace(/<\/hp:t>/, '');
        if (text.trim()) {
          texts.push(text);
        }
      }
    }
  }

  return texts.join('\n');
}
