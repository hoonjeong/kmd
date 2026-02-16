'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

const SIDEBAR_WIDTH = 180;

const menuItems = [
  { href: '/dashboard', icon: 'fas fa-home', label: '대시보드' },
  { href: '/my-questions', icon: 'fas fa-file-alt', label: '생성이력' },
  { href: '/my-credits', icon: 'fas fa-coins', label: '크레딧' },
  { href: '/my-info', icon: 'fas fa-user-cog', label: '내정보' },
];

export { SIDEBAR_WIDTH };

export default function TeacherNav({ userName, role }: { userName: string; role?: string }) {
  const pathname = usePathname();
  const initial = userName ? userName.charAt(0) : '?';
  const [credits, setCredits] = useState<number | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/credits');
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // 커스텀 이벤트로 실시간 갱신
  useEffect(() => {
    const handler = () => fetchCredits();
    window.addEventListener('credits-updated', handler);
    return () => window.removeEventListener('credits-updated', handler);
  }, [fetchCredits]);

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: SIDEBAR_WIDTH,
      height: '100vh',
      background: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      overflowY: 'auto',
    }}>
      {/* 로고 */}
      <Link href="/dashboard" style={{
        padding: '20px 20px 16px',
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{
          fontWeight: 800,
          fontSize: 20,
          color: '#fff',
          letterSpacing: -0.5,
        }}>국문당</span>
      </Link>

      {/* 크레딧 표시 */}
      {credits !== null && (
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>잔여 크레딧</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>
            {credits.toLocaleString()}
          </div>
        </div>
      )}

      {/* 메뉴 */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {menuItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 2,
                borderRadius: 8,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <i className={item.icon} style={{ width: 18, textAlign: 'center', fontSize: 13 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 하단: 사용자 + 로그아웃 */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 12px 16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 8px 12px',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#3b82f6',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {initial}
          </div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
            {userName} 선생님
          </span>
        </div>
        <button
          onClick={() => {
            document.cookie = 'session_guard=; path=/; max-age=0';
            signOut({ callbackUrl: '/login' });
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            color: 'rgba(255,255,255,0.5)',
            background: 'none',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            fontSize: 13,
            cursor: 'pointer',
            borderRadius: 6,
          }}
        >
          <i className="fas fa-sign-out-alt" style={{ width: 18, textAlign: 'center', fontSize: 12 }} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
