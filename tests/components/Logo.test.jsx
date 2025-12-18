import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Logo from '../../components/Logo';

// Mock next/image
vi.mock('next/image', () => ({
  default: (props) => <img {...props} />,
}));

describe('Logo Component', () => {
  it('renders the logo text correctly', () => {
    render(<Logo />);
    expect(screen.getByText('TEC')).toBeInTheDocument();
    expect(screen.getByText('Rural')).toBeInTheDocument();
  });

  it('renders the tagline when withTagline is true', () => {
    render(<Logo withTagline={true} />);
    expect(screen.getByText('Diagnóstico Agrícola Inteligente')).toBeInTheDocument();
  });

  it('does not render the tagline by default', () => {
    render(<Logo />);
    expect(screen.queryByText('Diagnóstico Agrícola Inteligente')).not.toBeInTheDocument();
  });

  it('renders the icon image', () => {
    render(<Logo />);
    const image = screen.getByAltText('TEC Rural');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/TecRural_icono.svg');
  });
});
