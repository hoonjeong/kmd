'use client';

import { useState, useCallback } from 'react';
import TeacherTabNavigation, { type TabKey } from './TeacherTabNavigation';
import LiteratureClient, { type GenerationCompleteData } from '@/app/admin/LiteratureClient';
import GrammarClient from '@/app/admin/GrammarClient';
import ReadingClient from '@/app/admin/ReadingClient';

// 하드코딩된 필터 옵션 (DB 기반 확정 데이터)
const LIT_SUB_CATEGORIES = ['갈래복합', '고전산문', '고전시가', '국어(통합)', '극', '수필', '현대소설', '현대시', '희곡'];
const LIT_QUESTION_PATTERNS = ['감상이해', '내용이해', '문법규칙', '비교분석', '빈칸추론', '서술방식', '어휘', '자료해석', '적용', '추론', '표현감상'];
const READ_SUB_CATEGORIES = ['경제', '과학', '기술', '사회', '예술', '인문'];
const READ_QUESTION_PATTERNS = ['감상이해', '내용이해', '문법규칙', '비교분석', '빈칸추론', '서술방식', '어휘', '자료해석', '적용', '추론', '표현감상'];

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
          initialSubCategories={LIT_SUB_CATEGORIES}
          initialQuestionPatterns={LIT_QUESTION_PATTERNS}
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

      {/* 독서 */}
      <div style={{ display: activeTab === 'reading' ? 'block' : 'none' }}>
        <ReadingClient
          userName={userName}
          initialSubCategories={READ_SUB_CATEGORIES}
          initialQuestionPatterns={READ_QUESTION_PATTERNS}
          initialTotalCount={0}
          isAdmin={isAdmin}
          onGenerated={onGenerated}
          onGenerationComplete={onGenerationComplete}
        />
      </div>
    </>
  );
}
