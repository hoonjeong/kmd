import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import TeacherNav, { SIDEBAR_WIDTH } from './TeacherNav';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <TeacherNav userName={session.user.name || '선생님'} role={session.user.role} />
      <main style={{
        marginLeft: SIDEBAR_WIDTH,
        flex: 1,
        padding: '32px 36px',
        background: '#f8fafc',
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  );
}
