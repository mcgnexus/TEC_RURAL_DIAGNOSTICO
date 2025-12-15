import Sidebar from '@/components/Sidebar';
import { UserProvider } from '@/components/UserContext';

export const metadata = {
  title: 'Dashboard | TEC Rural',
};

export default function DashboardLayout({ children }) {
  return (
    <UserProvider>
      <div
        style={{
          minHeight: '100vh',
          padding: '2.5rem',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: '1.5rem',
          }}
        >
          <Sidebar />
          <main className="card" style={{ minHeight: '80vh' }}>
            {children}
          </main>
        </div>
      </div>
    </UserProvider>
  );
}
