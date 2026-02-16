'use client';

import { useState } from 'react';
import { copyToClipboard, downloadHwpx } from '@/lib/client-utils';

interface Props {
  status: 'idle' | 'generating' | 'generated';
  generatedText: string;
  title: string;
  template: string;
}

export default function GenerationResultCard({ status, generatedText, title, template }: Props) {
  const [copied, setCopied] = useState(false);

  if ((status !== 'generating' && status !== 'generated') || !generatedText) return null;

  async function handleCopy() {
    await copyToClipboard(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    try {
      await downloadHwpx(generatedText, title, template);
    } catch { alert('다운로드 중 오류가 발생했습니다.'); }
  }

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <strong>생성 결과</strong>
        {status === 'generated' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline-secondary'}`} onClick={handleCopy}>
              {copied ? '복사 완료!' : '클립보드 복사'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleDownload}>한글로 다운로드</button>
          </div>
        )}
        {status === 'generating' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner-border spinner-border-sm text-primary" role="status" />
            <span style={{ fontSize: 13, color: '#64748b' }}>생성 중...</span>
          </div>
        )}
      </div>
      <div className="card-body">
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 600, overflow: 'auto', fontSize: '0.9rem', margin: 0 }}>
          {generatedText}
        </pre>
      </div>
    </div>
  );
}
