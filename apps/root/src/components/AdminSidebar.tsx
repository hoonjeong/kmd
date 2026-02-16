import { getAdminSession } from '@/lib/admin-session';

export async function AdminSidebar() {
  const session = await getAdminSession();
  const user = session.user;
  const isAdmin = user?.code === 'O';

  return (
    <aside className="admin-sidebar" id="adminSidebar">
      <a href="/admin" className="admin-sidebar-brand">
        <i className="fas fa-school"></i>
        <span>기출문제 관리</span>
      </a>

      <nav className="admin-sidebar-nav">
        {/* 기출문제 메뉴 */}
        <div className="admin-sidebar-section">기출문제</div>
        <a href="/admin/prev-test-dashboard?region=부천" className="admin-sidebar-link">
          <i className="fas fa-chart-bar"></i> 부천지역기출
        </a>
        <a href="/admin/prev-test-dashboard?region=타지역" className="admin-sidebar-link">
          <i className="fas fa-chart-bar"></i> 타학교 기출
        </a>
        <a href="/admin/prev-test" className="admin-sidebar-link">
          <i className="fas fa-search"></i> 기출문제 검색
        </a>
        <a href="/admin" className="admin-sidebar-link">
          <i className="fas fa-robot"></i> AI 문제 생성기
        </a>

        {isAdmin && (
          <>
            {/* 기출관리 */}
            <div className="admin-sidebar-section">기출관리</div>
            <a href="/admin/prev-test-add?region=부천" className="admin-sidebar-link">
              <i className="fas fa-plus-circle"></i> 부천기출관리
            </a>
            <a href="/admin/prev-test-add?region=타지역" className="admin-sidebar-link">
              <i className="fas fa-plus-circle"></i> 타지역 기출관리
            </a>
          </>
        )}
      </nav>

      <div className="admin-sidebar-footer">
        {user ? (
          <>
            <div className="admin-sidebar-user">
              <i className="fas fa-user-circle"></i>
              <span>{user.name}</span>
            </div>
            <div className="admin-sidebar-footer-links">
              <a href="/admin/logout">로그아웃</a>
            </div>
          </>
        ) : (
          <div className="admin-sidebar-footer-links">
            <a href="/admin/login">로그인</a>
          </div>
        )}
      </div>
    </aside>
  );
}
