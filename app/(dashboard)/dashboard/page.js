"use client";

import { useUserContext } from "@/components/UserContext";
import IconoTecRural from "@/components/IconoTecRural";

export default function DashboardHome() {
  const { profile, loading } = useUserContext();

  if (loading) {
    return <p style={{ color: 'var(--color-muted)' }}>Cargando datos...</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>Hola</p>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>
          {profile?.first_name ? `${profile.first_name}!` : 'Bienvenido a TEC Rural'}
        </h1>
        <p style={{ marginTop: 8, color: 'var(--color-muted)' }}>
          Gestiona tus diagnósticos asistidos por IA y mantén tu historial siempre a mano.
        </p>
      </section>

      <section className="action-card">
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: 8 }}>
          Diagnóstico inteligente
        </p>
        <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconoTecRural size="md" style={{ display: 'inline-block' }} />
          Iniciar diagnóstico con IA
        </h2>
        <p style={{ marginBottom: 20, color: 'var(--color-muted)' }}>
          Lanza una nueva consulta con cámara o cargando una imagen desde tu galería.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <a href="/dashboard/nueva-consulta" className="btn-gradient" style={{ padding: '0.9rem 1.8rem' }}>
            Abrir cámara
          </a>
          <a href="/dashboard/nueva-consulta" className="btn-gradient" style={{ padding: '0.9rem 1.8rem' }}>
            Subir imagen
          </a>
        </div>
      </section>

      <section className="card" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <IconoTecRural size="lg" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Créditos disponibles</p>
            <h3 style={{ margin: '8px 0', fontSize: '1.8rem' }}>{profile?.credits_remaining ?? 0}</h3>
            <p style={{ color: 'var(--color-muted)' }}>
              Cada diagnóstico descuenta 1 crédito. Recarga contactando al admin.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
