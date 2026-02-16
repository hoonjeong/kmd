import { auth } from '@/auth';
import DashboardContent from './DashboardContent';

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name || '선생님';
  const role = session?.user?.role || 'user';

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
        영역별 변형문제 만들기
      </h2>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        안녕하세요, {userName}! 영역을 선택하고 AI로 변형문제를 생성하세요.
      </p>
      <DashboardContent userName={userName} role={role} />
    </div>
  );
}
