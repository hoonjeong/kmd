'use client';

import { useState, useRef, useCallback } from 'react';

type Status = 'idle' | 'generating' | 'generated';

export function useSSEGeneration() {
  const [status, setStatus] = useState<Status>('idle');
  const [generatedText, setGeneratedText] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (url: string, body: Record<string, unknown>) => {
    setStatus('generating');
    setError('');
    setGeneratedText('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `서버 오류 (HTTP ${res.status})`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('스트리밍을 사용할 수 없습니다.');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { setStatus('generated'); return; }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) setGeneratedText(prev => prev + parsed.text);
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== payload) throw parseErr;
          }
        }
      }
      setStatus('generated');
    } catch (err) {
      if ((err as Error).name === 'AbortError') { setStatus('idle'); return; }
      setError(err instanceof Error ? err.message : 'AI 문제 생성에 실패했습니다.');
      setStatus('idle');
    } finally {
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setGeneratedText('');
    setError('');
    setStatus('idle');
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  return { status, generatedText, error, generate, reset, abort };
}
