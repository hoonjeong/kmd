import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: '문제집 AI 문제 생성기',
  description: '문제집 AI 문제 생성기',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--admin-content-bg, #f8fafc)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 40px' }}>
        {children}
      </div>
    </div>
  );
}
