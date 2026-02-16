import 'bootstrap/dist/css/bootstrap.min.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { BootstrapClient } from '@/components/BootstrapClient';
import AuthSessionProvider from '@/components/AuthSessionProvider';

export const metadata: Metadata = {
  title: '국문당 - 고등국어 문제 제작 서비스',
  description: '고등국어 기출문제 검색 및 변형문제 제작 서비스',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';

  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.0/css/all.css" integrity="sha384-lZN37f5QGtY3VHgisS14W3ExzMWZxybE1SJSEsQp9S+oqd12jhcu+A56Ebc1zFSJ" crossOrigin="anonymous" />
      </head>
      <body>
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
        <BootstrapClient />
      </body>
    </html>
  );
}
