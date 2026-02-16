import Footer from '@/components/Footer';

export default function PolicyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        {children}
      </div>
      <Footer />
    </div>
  );
}
