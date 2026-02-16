'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const TABS = [
  { key: 'literature', label: '문학' },
  { key: 'grammar', label: '문법' },
  { key: 'reading', label: '독서' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

export default function TabNavigation({ activeTab }: { activeTab: TabKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTabClick(tab: TabKey) {
    if (tab === activeTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`/admin?${params.toString()}`);
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '2px solid #e2e8f0',
        marginBottom: 24,
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => handleTabClick(t.key)}
          style={{
            padding: '12px 28px',
            fontSize: 15,
            fontWeight: activeTab === t.key ? 700 : 500,
            color: activeTab === t.key ? '#1e293b' : '#64748b',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
            marginBottom: -2,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
