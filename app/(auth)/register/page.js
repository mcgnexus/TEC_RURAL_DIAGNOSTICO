'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/authService';
import Logo from '@/components/Logo';
import PasswordToggle from '@/components/PasswordToggle';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async event => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
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

      const { error: signupError } = await authService.signup(email, password);
      if (signupError) {
        setError(signupError);
        return;
      }

      setSuccessMessage('Registro exitoso. Revisa tu correo para confirmar tu cuenta.');
      setEmail('');
      setPassword('');

      setTimeout(() => router.push('/login'), 2200);
    } catch (err) {
      console.error('Register error:', err);
      setError('Error al registrarse. Intenta de nuevo.');
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
      <div style={{ maxWidth: 440, width: '100%' }}>
        <div className="auth-card">
          <Logo size="lg" withTagline align="center" />
          <p style={{ marginTop: 8, textAlign: 'center', color: 'var(--color-muted)' }}>
            Crea una cuenta para empezar a enviar consultas y administrar tu base de conocimiento.
          </p>

          {error && (
            <div className="alert-banner alert-danger" style={{ marginTop: 20 }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div className="alert-banner alert-success" style={{ marginTop: 20 }}>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleRegister} style={{ marginTop: 28 }}>
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="email" style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                Email de acceso
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
              {isLoading ? 'Creando cuenta...' : 'Registrar'}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--color-muted)' }}>
            ¿Ya tienes cuenta?
            <a href="/login" style={{ marginLeft: 6, color: 'var(--color-secondary)', fontWeight: 600 }}>
              Iniciar sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
