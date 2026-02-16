import { Suspense } from 'react';
import { requireAdminSession } from '@/lib/admin-session';
import {
  getDistinctLiteratureSubCategories,
  getDistinctLiteratureQuestionPatterns,
  countLiteratureByFilters,
} from '@edenschool/common/queries/literature';
import {
  getDistinctReadingSubCategories,
  getDistinctReadingQuestionPatterns,
  countReadingByFilters,
} from '@edenschool/common/queries/reading';
import { countGrammarFiles } from '@edenschool/common/queries/grammar';
import TabNavigation from './TabNavigation';
import type { TabKey } from './TabNavigation';
import LiteratureClient from './LiteratureClient';
import GrammarClient from './GrammarClient';
import ReadingClient from './ReadingClient';

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminPage({ searchParams }: Props) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const tab = (params.tab || 'literature') as TabKey;

  return (
    <div className="admin-content">
      {/* 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 0', borderBottom: '2px solid #e2e8f0', marginBottom: 0,
      }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
          📝🏠 문제집 AI 문제 생성기
        </h2>
        <div style={{ fontSize: 14, color: '#64748b' }}>
          {session.user.name}{' '}
          <span style={{ margin: '0 6px', color: '#e2e8f0' }}>|</span>
          <a href="/admin/logout" style={{ color: '#64748b', textDecoration: 'none' }}>로그아웃</a>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <Suspense fallback={null}>
        <TabNavigation activeTab={tab} />
      </Suspense>

      {/* 탭 콘텐츠 */}
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>로딩 중...</div>}>
        {tab === 'literature' && <LiteratureTab userName={session.user.name} />}
        {tab === 'grammar' && <GrammarTab userName={session.user.name} />}
        {tab === 'reading' && <ReadingTab userName={session.user.name} />}
      </Suspense>
    </div>
  );
}

async function LiteratureTab({ userName }: { userName: string }) {
  const [subCategories, questionPatterns, totalCount] = await Promise.all([
    getDistinctLiteratureSubCategories(),
    getDistinctLiteratureQuestionPatterns(),
    countLiteratureByFilters({}),
  ]);

  return (
    <LiteratureClient
      userName={userName}
      initialSubCategories={subCategories}
      initialQuestionPatterns={questionPatterns}
      initialTotalCount={totalCount}
    />
  );
}

async function GrammarTab({ userName }: { userName: string }) {
  const totalCount = await countGrammarFiles();

  return (
    <GrammarClient
      userName={userName}
      initialTotalCount={totalCount}
    />
  );
}

async function ReadingTab({ userName }: { userName: string }) {
  const [subCategories, questionPatterns, totalCount] = await Promise.all([
    getDistinctReadingSubCategories(),
    getDistinctReadingQuestionPatterns(),
    countReadingByFilters({}),
  ]);

  return (
    <ReadingClient
      userName={userName}
      initialSubCategories={subCategories}
      initialQuestionPatterns={questionPatterns}
      initialTotalCount={totalCount}
    />
  );
}
