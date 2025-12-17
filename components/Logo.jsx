'use client';

import Image from 'next/image';

export default function Logo({ size = 'md', withTagline = false, align = 'center' }) {
  const fontSize = size === 'lg' ? '2rem' : size === 'sm' ? '1rem' : '1.4rem';
  const iconSize = size === 'lg' ? 48 : size === 'sm' ? 24 : 32;

  return (
    <div style={{ textAlign: align }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end',
          gap: '0.5rem',
        }}
      >
        {/* Icono SVG */}
        <Image
          src="/TecRural_icono.svg"
          alt="TEC Rural"
          width={iconSize}
          height={iconSize}
          priority
          style={{ flexShrink: 0 }}
        />

        {/* Texto del logo */}
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
      </div>
      {withTagline && (
        <p style={{ marginTop: 4, fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          Diagnóstico Agrícola Inteligente
        </p>
      )}
    </div>
  );
}
