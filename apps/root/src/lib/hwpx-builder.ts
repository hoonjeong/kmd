import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Python 스크립트를 사용하여 템플릿 기반 HWPX 파일을 생성합니다.
 * 한글(한컴오피스)에서 정상적으로 열립니다.
 *
 * @param content - 변형문제 텍스트 (마크다운 + 커스텀 태그)
 * @param template - 사용할 템플릿 이름 ("SAMPLE" | "SAMPLE2"), 기본값 "SAMPLE"
 */
export async function buildHwpx(content: string, template = 'SAMPLE'): Promise<Buffer> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'generate-hwpx.py');
  const outputPath = path.join(os.tmpdir(), `variant-${randomUUID()}.hwpx`);

  const input = JSON.stringify({ content, output: outputPath, template });

  await new Promise<void>((resolve, reject) => {
    const proc = execFile('python', [scriptPath], { timeout: 30000 }, (error) => {
      if (error) {
        reject(new Error(`HWPX 생성 실패: ${error.message}`));
      } else {
        resolve();
      }
    });
    proc.stdin?.write(input);
    proc.stdin?.end();
  });

  try {
    const buffer = await readFile(outputPath);
    return buffer;
  } finally {
    // 임시 파일 정리
    unlink(outputPath).catch(() => {});
  }
}
