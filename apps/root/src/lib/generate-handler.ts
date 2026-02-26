import { NextRequest } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-session';
import { getClaudeClient } from '@/lib/claude-client';
import { jsonError, createClaudeSSEResponse } from '@/lib/api-handler';
import { deductCredits } from '@/lib/credits';

interface FileContentItem {
  id: number;
  content?: Buffer | string | null;
  fileName?: string | null;
}

interface GenerateOptions {
  category: string;
  creditCount: number;
  searchFiles: () => Promise<{ id: number }[]>;
  getFileContent: (metaId: number) => Promise<FileContentItem | null>;
  buildPrompt: (contents: string[]) => string;
}

/**
 * 문제 생성 API 공통 핸들러
 * 세션 체크 → 크레딧 차감 → 파일 검색/추출 → 프롬프트 빌드 → Claude SSE 스트림
 */
export async function handleGenerate(req: NextRequest, opts: GenerateOptions): Promise<Response> {
  let session;
  try { session = await requireAdminApiSession(); } catch { return jsonError('Unauthorized', 401); }

  const creditDesc = `${opts.category} 문제 생성 (${opts.creditCount}문항)`;
  const creditError = await deductCredits(String(session.user.id), session.user.role, opts.creditCount, creditDesc);
  if (creditError) return jsonError(creditError);

  try {
    const files = await opts.searchFiles();
    if (files.length === 0) {
      return jsonError('조건에 맞는 참고 자료가 없습니다. 필터를 조정해주세요.');
    }

    // 비용 제어: 최대 2파일, 총 6,000자(≈4K 토큰) → 문항당 ~45원
    const MAX_FILES = 2;
    const MAX_TOTAL_CHARS = 6_000;
    const contents: string[] = [];
    let totalChars = 0;

    for (const file of files.slice(0, MAX_FILES)) {
      if (totalChars >= MAX_TOTAL_CHARS) break;
      const fc = await opts.getFileContent(file.id);
      if (fc?.content) {
        let text = typeof fc.content === 'string' ? fc.content : fc.content.toString('utf8');
        const remaining = MAX_TOTAL_CHARS - totalChars;
        if (text.length > remaining) {
          text = text.slice(0, remaining) + '\n...(이하 생략)';
        }
        contents.push(`=== ${fc.fileName || `파일 ${file.id}`} ===\n${text}`);
        totalChars += text.length;
      }
    }

    if (contents.length === 0) {
      return jsonError('참고 자료에 콘텐츠가 없습니다.');
    }

    const prompt = opts.buildPrompt(contents);

    const client = getClaudeClient();
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    return createClaudeSSEResponse(stream);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI 문제 생성에 실패했습니다.';
    return jsonError(message, 500);
  }
}
