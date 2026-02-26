'use client';

import { useState, useCallback } from 'react';
import TeacherTabNavigation, { type TabKey } from './TeacherTabNavigation';
import LiteratureClient, { type GenerationCompleteData } from '@/app/admin/LiteratureClient';
import GrammarClient from '@/app/admin/GrammarClient';

export default function DashboardContent({ userName, role }: { userName: string; role: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>('literature');
  const isAdmin = role === 'admin';

  const onGenerated = useCallback(() => {
    // 사이드바 크레딧 실시간 갱신
    window.dispatchEvent(new Event('credits-updated'));
  }, []);

  const onGenerationComplete = useCallback(async (data: GenerationCompleteData) => {
    try {
      await fetch('/api/teacher/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: data.category,
          title: data.title,
          generatedText: data.generatedText,
          requestParams: data.requestParams,
          difficulty: data.difficulty,
          questionCount: data.questionCount,
          template: data.template,
        }),
      });
    } catch {
      // 저장 실패해도 사용자 경험에 영향 주지 않음
    }
  }, []);

  return (
    <>
      <TeacherTabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 문학 */}
      <div style={{ display: activeTab === 'literature' ? 'block' : 'none' }}>
        <LiteratureClient
          userName={userName}
          initialTotalCount={0}
          isAdmin={isAdmin}
          onGenerated={onGenerated}
          onGenerationComplete={onGenerationComplete}
        />
      </div>

      {/* 문법 */}
      <div style={{ display: activeTab === 'grammar' ? 'block' : 'none' }}>
        <GrammarClient
          userName={userName}
          initialTotalCount={0}
          isAdmin={isAdmin}
          onGenerated={onGenerated}
          onGenerationComplete={onGenerationComplete}
        />
      </div>
    </>
  );
}
