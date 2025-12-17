'use client';

import Image from 'next/image';

/**
 * Componente para mostrar el icono de TEC Rural
 * @param {string} size - Tamaño del icono: 'xs' (16px), 'sm' (24px), 'md' (32px), 'lg' (48px), 'xl' (64px)
 * @param {string} className - Clases CSS adicionales
 * @param {object} style - Estilos inline adicionales
 */
export default function IconoTecRural({ size = 'md', className = '', style = {} }) {
  const sizeMap = {
    xs: 16,
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
  };

  const iconSize = sizeMap[size] || 32;

  return (
    <Image
      src="/TecRural_icono.svg"
      alt="Icono TEC Rural"
      width={iconSize}
      height={iconSize}
      className={className}
      style={style}
      priority
    />
  );
}
