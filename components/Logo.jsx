'use client';

export default function Logo({ size = 'md', withTagline = false, align = 'center' }) {
  const fontSize = size === 'lg' ? '2rem' : size === 'sm' ? '1rem' : '1.4rem';
  return (
    <div style={{ textAlign: align }}>
      <div
        style={{
          fontSize,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: '#1f2937',
        }}
      >
        <span style={{ color: 'var(--color-primary)' }}>TEC</span>{' '}
        <span style={{ color: 'var(--color-secondary-dark)' }}>Rural</span>
      </div>
      {withTagline && (
        <p style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          Diagnóstico Agrícola Inteligente
        </p>
      )}
    </div>
  );
}
