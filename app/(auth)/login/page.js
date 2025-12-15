'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/authService';
import Logo from '@/components/Logo';
import PasswordToggle from '@/components/PasswordToggle';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async event => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!email || !password) {
        setError('Por favor completa todos los campos');
        return;
      }

      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres');
        return;
      }

      const { user, error: authError } = await authService.login(email, password);

      if (authError) {
        setError(authError);
        return;
      }

      if (user) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Error al iniciar sesión. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div className="auth-card">
          <Logo size="lg" withTagline align="center" />

          {error && (
            <div className="alert-banner alert-danger" style={{ marginTop: 24 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ marginTop: 32 }} className="space-y-4">
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="email" style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="agricultor@email.com"
                className="input-field"
                disabled={isLoading}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                htmlFor="password"
                style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}
              >
                Contraseña
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="input-field"
                  disabled={isLoading}
                />
                <PasswordToggle
                  isVisible={showPassword}
                  onToggle={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-gradient" style={{ width: '100%' }}>
              {isLoading ? 'Iniciando sesión...' : 'Entrar con mi cuenta'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: '0.9rem', color: 'var(--color-muted)', textAlign: 'center' }}>
            ¿No tienes cuenta?
            <a href="/register" style={{ color: 'var(--color-secondary)', fontWeight: 600, marginLeft: 6 }}>
              Crear cuenta
            </a>
          </p>

          <p style={{ marginTop: 8, fontSize: '0.85rem', textAlign: 'center', color: 'var(--color-muted)' }}>
            ¿Problemas para entrar?
            <a href="/reset-password" style={{ marginLeft: 6, color: 'var(--color-primary)' }}>
              Recuperar contraseña
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
