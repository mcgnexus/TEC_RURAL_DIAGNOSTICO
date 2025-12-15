'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserContext } from './UserContext';
import Logo from './Logo';

const navItems = [
  { href: '/dashboard', label: 'Resumen' },
  { href: '/dashboard/nueva-consulta', label: 'Nueva consulta' },
  { href: '/dashboard/historial', label: 'Historial' },
];

const adminItems = [
  { href: '/dashboard/admin', label: 'Panel Admin' },
  { href: '/dashboard/admin/indexing', label: 'Indexacion (v2)' },
  { href: '/dashboard/admin/usuarios', label: 'Usuarios' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUserContext();
  const isAdmin = profile?.role === 'admin';

  const renderLink = item => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`nav-link ${active ? 'active' : ''}`}
        style={{ display: 'block' }}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="sidebar">
      <Logo size="sm" align="left" />
      <div style={{ marginTop: 18 }}>
        <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
          Sesión
        </p>
        <p style={{ marginTop: 4, fontWeight: 600 }}>
          {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : profile?.email || 'Cargando...'}
        </p>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
          Créditos disponibles: <strong>{profile?.credits_remaining ?? '—'}</strong>
        </p>
      </div>

      <div className="sidebar-nav" style={{ marginTop: 32, display: 'grid', gap: 8 }}>
        {navItems.map(renderLink)}
      </div>

      {isAdmin && (
        <div style={{ marginTop: 32 }}>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
            Administración
          </p>
          <div className="sidebar-nav" style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {adminItems.map(renderLink)}
          </div>
        </div>
      )}
    </aside>
  );
}
