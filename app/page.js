import Logo from '@/components/Logo';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          maxWidth: 640,
          width: '100%',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.85)',
          borderRadius: '32px',
          padding: '48px',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <Logo size="lg" withTagline align="center" />
        <p style={{ marginTop: 16, fontSize: '1rem', color: 'var(--color-muted)' }}>
          Diagnósticos agrícolas asistidos por IA combinando Mistral + Gemini con tu base de
          conocimiento especializada.
        </p>
        <div style={{ marginTop: 36, display: 'flex', gap: 16, justifyContent: 'center' }}>
          <a href="/login" className="btn-gradient" style={{ padding: '0.95rem 2.5rem' }}>
            Ingresar
          </a>
          <a href="/register" className="btn-outline" style={{ padding: '0.95rem 2.5rem' }}>
            Crear cuenta
          </a>
        </div>
      </div>
    </main>
  );
}
