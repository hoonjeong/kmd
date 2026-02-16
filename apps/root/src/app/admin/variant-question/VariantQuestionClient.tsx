'use client';

import { useState, useRef } from 'react';

type Status = 'idle' | 'extracting' | 'extracted' | 'generating' | 'generated';

interface ExtractedFile {
  fileName: string;
  text: string;
  error?: string;
}

interface Props {
  ids: number[];
}

export default function VariantQuestionClient({ ids }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());
  const [generatedText, setGeneratedText] = useState('');
  const [error, setError] = useState('');
  const [difficulty, setDifficulty] = useState<'same' | 'easier' | 'harder'>('same');
  const [count, setCount] = useState(3);
  const [userPrompt, setUserPrompt] = useState('');
  const [template, setTemplate] = useState<'SAMPLE' | 'SAMPLE2'>('SAMPLE');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  if (ids.length === 0) {
    return (
      <div className="alert alert-warning">
        선택된 파일이 없습니다. 기출 대시보드에서 파일을 선택해주세요.
      </div>
    );
  }

  async function handleExtract() {
    setStatus('extracting');
    setError('');
    setExtractedFiles([]);

    try {
      const res = await fetch('/api/admin/variant-question/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        let errorMsg = '텍스트 추출에 실패했습니다.';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // 서버가 HTML 오류 페이지를 반환한 경우
          errorMsg = `서버 오류가 발생했습니다. (HTTP ${res.status})`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      setExtractedFiles(data.results);
      setStatus('extracted');
    } catch (err) {
      setError(err instanceof Error ? err.message : '텍스트 추출에 실패했습니다.');
      setStatus('idle');
    }
  }

  async function handleGenerate() {
    const validTexts = extractedFiles
      .filter((f) => f.text && !f.error)
      .map((f) => ({ fileName: f.fileName, text: f.text }));

    if (validTexts.length === 0) {
      setError('추출된 텍스트가 없습니다.');
      return;
    }

    setStatus('generating');
    setError('');
    setGeneratedText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/admin/variant-question/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: validTexts,
          options: { difficulty, count, userPrompt: userPrompt.trim() || undefined },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errorMsg = '변형문제 생성에 실패했습니다.';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = `서버 오류가 발생했습니다. (HTTP ${res.status})`;
        }
        throw new Error(errorMsg);
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
          if (payload === '[DONE]') {
            setStatus('generated');
            return;
          }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              setGeneratedText((prev) => prev + parsed.text);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== payload) {
              throw parseErr;
            }
          }
        }
      }

      setStatus('generated');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '변형문제 생성에 실패했습니다.');
      setStatus('extracted');
    } finally {
      abortRef.current = null;
    }
  }

  async function handleCopyToClipboard() {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = generatedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleDownloadHwpx() {
    try {
      const res = await fetch('/api/admin/variant-question/download-hwpx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: generatedText, title: '변형문제', template }),
      });

      if (!res.ok) {
        alert('다운로드에 실패했습니다.');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '변형문제.hwpx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('다운로드 중 오류가 발생했습니다.');
    }
  }

  function toggleExpand(index: number) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div>
      {/* 선택된 파일 정보 */}
      <div className="alert alert-info">
        <strong>기출문제</strong>에서{' '}
        <strong>{ids.length}개</strong> 파일이 선택되었습니다.
      </div>

      {/* 1단계: 텍스트 추출 */}
      {status === 'idle' && (
        <button className="btn btn-primary" onClick={handleExtract}>
          텍스트 추출 시작
        </button>
      )}

      {status === 'extracting' && (
        <div className="text-center py-3">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2">텍스트 추출 중...</p>
        </div>
      )}

      {/* 추출 결과 미리보기 */}
      {(status === 'extracted' || status === 'generating' || status === 'generated') && (
        <div className="mb-3">
          <h5>추출된 텍스트</h5>
          {extractedFiles.map((file, idx) => (
            <div key={idx} className="card mb-2">
              <div
                className="card-header d-flex justify-content-between align-items-center"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleExpand(idx)}
              >
                <span>
                  {file.fileName}
                  {file.error && (
                    <span className="badge badge-danger ml-2">{file.error}</span>
                  )}
                  {!file.error && file.text && (
                    <span className="badge badge-success ml-2">
                      {file.text.length.toLocaleString()}자
                    </span>
                  )}
                </span>
                <span>{expandedFiles.has(idx) ? '▲' : '▼'}</span>
              </div>
              {expandedFiles.has(idx) && (
                <div className="card-body">
                  <pre
                    style={{
                      maxHeight: '300px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '0.85rem',
                    }}
                  >
                    {file.text || '(텍스트 없음)'}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 2단계: 옵션 설정 + 생성 */}
      {status === 'extracted' && (
        <div className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">변형문제 옵션</h5>
            <div className="form-group row">
              <label className="col-sm-2 col-form-label">난이도</label>
              <div className="col-sm-10">
                <select
                  className="form-control form-control-sm"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  style={{ maxWidth: '200px' }}
                >
                  <option value="easier">쉽게</option>
                  <option value="same">동일</option>
                  <option value="harder">어렵게</option>
                </select>
              </div>
            </div>
            <div className="form-group row">
              <label className="col-sm-2 col-form-label">변형 개수</label>
              <div className="col-sm-10">
                <input
                  type="number"
                  className="form-control form-control-sm"
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                  min={1}
                  max={10}
                  style={{ maxWidth: '100px' }}
                />
              </div>
            </div>
            <div className="form-group row">
              <label className="col-sm-2 col-form-label">시험지 양식</label>
              <div className="col-sm-10">
                <select
                  className="form-control form-control-sm"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as 'SAMPLE' | 'SAMPLE2')}
                  style={{ maxWidth: '300px' }}
                >
                  <option value="SAMPLE">양식 1 (청록 테두리)</option>
                  <option value="SAMPLE2">양식 2 (회색 상하굵은 테두리)</option>
                </select>
              </div>
            </div>
            <div className="form-group row">
              <label className="col-sm-2 col-form-label">요청사항</label>
              <div className="col-sm-10">
                <textarea
                  className="form-control form-control-sm"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  rows={3}
                  placeholder="예: 서술형 문제 위주로 만들어주세요 / 비문학 지문에 대한 문제만 생성해주세요 / 문법 관련 문제를 추가해주세요"
                />
                <small className="form-text text-muted">
                  추가로 원하는 요청사항을 자유롭게 입력하세요. (선택사항)
                </small>
              </div>
            </div>
            <button className="btn btn-success" onClick={handleGenerate}>
              변형문제 생성
            </button>
          </div>
        </div>
      )}

      {/* 생성 중 */}
      {status === 'generating' && (
        <div className="mb-3">
          <div className="d-flex align-items-center mb-2">
            <div className="spinner-border spinner-border-sm text-success mr-2" role="status" />
            <span>변형문제 생성 중...</span>
          </div>
        </div>
      )}

      {/* 3단계: 생성 결과 */}
      {(status === 'generating' || status === 'generated') && generatedText && (
        <div className="card mb-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>생성된 변형문제</strong>
            {status === 'generated' && (
              <div>
                <button
                  className={`btn btn-sm mr-2 ${copied ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={handleCopyToClipboard}
                >
                  {copied ? '복사 완료!' : '클립보드 복사'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleDownloadHwpx}>
                  HWPX 다운로드
                </button>
              </div>
            )}
          </div>
          <div className="card-body">
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '600px',
                overflow: 'auto',
                fontSize: '0.9rem',
              }}
            >
              {generatedText}
            </pre>
          </div>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="alert alert-danger mt-3">
          <strong>오류:</strong> {error}
          <button
            className="btn btn-outline-danger btn-sm ml-2"
            onClick={() => {
              setError('');
              if (status === 'idle') handleExtract();
              else if (status === 'extracted') handleGenerate();
            }}
          >
            재시도
          </button>
        </div>
      )}
    </div>
  );
}
