import { PDFParse } from 'pdf-parse';

/**
 * PDF 파일 Buffer에서 텍스트를 추출합니다.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
