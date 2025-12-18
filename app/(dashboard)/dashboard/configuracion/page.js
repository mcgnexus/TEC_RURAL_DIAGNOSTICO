'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseBrowser';
import { useUserContext } from '@/components/UserContext';

export default function ConfiguracionPage() {
  const { profile, loading } = useUserContext();
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const initializedRef = useRef(false);
  const telegramInitializedRef = useRef(false);

  // Solo sincronizar cuando el profile se carga inicialmente
  useEffect(() => {
    if (!initializedRef.current && profile?.notify_whatsapp_on_diagnosis !== undefined) {
      setNotifyWhatsApp(profile.notify_whatsapp_on_diagnosis !== false);
      initializedRef.current = true;
    }
  }, [profile]);

  // Cargar estado de Telegram
  useEffect(() => {
    const loadTelegramStatus = async () => {
      if (!telegramInitializedRef.current) {
        try {
          const response = await fetch('/api/telegram/generate-link-token');
          if (response.ok) {
            const data = await response.json();
            setTelegramLinked(data.linked);
            setTelegramUsername(data.telegram_username);
            if (profile?.notify_telegram_on_diagnosis !== undefined) {
              setNotifyTelegram(profile.notify_telegram_on_diagnosis !== false);
            }
          }
        } catch (err) {
          console.error('Error cargando estado de Telegram:', err);
        }
        telegramInitializedRef.current = true;
      }
    };

    if (profile) {
      loadTelegramStatus();
    }
  }, [profile]);

  const handleNotificationToggle = async (e) => {
    const checked = e.target.checked;
    setNotifyWhatsApp(checked);
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('No autorizado');
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ notify_whatsapp_on_diagnosis: checked })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setMessage(
        checked
          ? '✅ Recibirás diagnósticos en WhatsApp'
          : '✅ No recibirás diagnósticos en WhatsApp'
      );

      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error actualizando preferencias:', err);
      setError('Error al guardar la preferencia. Intenta de nuevo.');
      setNotifyWhatsApp(!checked);
    } finally {
      setSaving(false);
    }
  };

  const handleTelegramNotificationToggle = async (e) => {
    const checked = e.target.checked;
    setNotifyTelegram(checked);
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('No autorizado');
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ notify_telegram_on_diagnosis: checked })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setMessage(
        checked
          ? '✅ Recibirás diagnósticos en Telegram'
          : '✅ No recibirás diagnósticos en Telegram'
      );

      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error actualizando preferencias de Telegram:', err);
      setError('Error al guardar la preferencia. Intenta de nuevo.');
      setNotifyTelegram(!checked);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTelegramToken = async () => {
    setGeneratingToken(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/telegram/generate-link-token', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error generando token');
      }

      const data = await response.json();
      setGeneratedToken(data.token);
      setShowToken(true);
      setMessage('✅ Token generado correctamente');

      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error('Error generando token:', err);
      setError(err.message || 'Error al generar token. Intenta de nuevo.');
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('¿Estás seguro de que deseas desvincular tu cuenta de Telegram?')) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/telegram/generate-link-token', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error desvinculando Telegram');
      }

      setTelegramLinked(false);
      setTelegramUsername(null);
      setMessage('✅ Cuenta Telegram desvinculada correctamente');

      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error desvinculando:', err);
      setError('Error al desvincular. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhone = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('No autorizado');
        return;
      }

      // Validar formato simple
      const cleaned = phoneInput.replace(/[^\d+]/g, '');
      if (cleaned.length < 7) {
        throw new Error('El número es demasiado corto');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ phone: cleaned })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile(); // Recargar perfil
      setIsEditingPhone(false);
      setMessage('✅ Teléfono actualizado correctamente');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Error guardando teléfono:', err);
      setError(err.message || 'Error al guardar teléfono');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p style={{ color: 'var(--color-muted)' }}>Cargando configuración...</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Encabezado */}
      <section>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Configuración</h1>
        <p style={{ marginTop: 8, color: 'var(--color-muted)' }}>
          Personaliza tus preferencias y configuración de cuenta
        </p>
      </section>

      {/* Mensajes */}
      {message && (
        <div
          className="alert-banner alert-success"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          className="alert-banner alert-danger"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          {error}
        </div>
      )}

      {/* Sección de Notificaciones */}
      <div className="card" style={{ display: 'grid', gap: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            🔔 Notificaciones
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: 0 }}>
            Configura cómo deseas recibir notificaciones de diagnósticos
          </p>
        </div>

        {/* Toggle de WhatsApp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: '#f9fafb',
            border: '1px solid var(--color-border)',
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Notificaciones en WhatsApp</p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              Recibe diagnósticos completados en WhatsApp
            </p>
          </div>

          <label
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={notifyWhatsApp}
              onChange={handleNotificationToggle}
              disabled={saving}
              style={{
                position: 'absolute',
                opacity: 0,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            />
            <div
              style={{
                display: 'inline-block',
                width: '50px',
                height: '28px',
                borderRadius: '14px',
                backgroundColor: notifyWhatsApp ? 'var(--color-primary)' : '#ccc',
                transition: 'background-color 0.3s',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: notifyWhatsApp ? '26px' : '3px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  transition: 'left 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          </label>
        </div>

        {/* Información adicional */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(34, 178, 207, 0.05)',
            border: '1px solid rgba(34, 178, 207, 0.2)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)' }}>
            <strong>ℹ️ Información:</strong> Cuando deshabilites las notificaciones de WhatsApp,
            solo recibirás los diagnósticos en la aplicación web. Los diagnósticos realizados
            desde WhatsApp siempre te notificarán en WhatsApp.
          </p>
        </div>
      </div>

      {/* Sección de Telegram */}
      <div className="card" style={{ display: 'grid', gap: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            🤖 Telegram
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: 0 }}>
            Vincula tu cuenta y recibe diagnósticos en Telegram
          </p>
        </div>

        {/* Estado de vinculación */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: telegramLinked ? 'rgba(76, 175, 80, 0.05)' : 'rgba(255, 152, 0, 0.05)',
            border: `1px solid ${telegramLinked ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{telegramLinked ? '✅' : '⏳'}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {telegramLinked ? 'Cuenta vinculada' : 'No vinculado'}
              </p>
              {telegramLinked && telegramUsername && (
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                  @{telegramUsername}
                </p>
              )}
            </div>
          </div>

          {!telegramLinked && (
            <button
              onClick={handleGenerateTelegramToken}
              disabled={generatingToken}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                fontWeight: 600,
                cursor: generatingToken ? 'not-allowed' : 'pointer',
                opacity: generatingToken ? 0.7 : 1,
                fontSize: '0.95rem',
              }}
            >
              {generatingToken ? '⏳ Generando token...' : '🔗 Generar token de vinculación'}
            </button>
          )}

          {telegramLinked && (
            <button
              onClick={handleUnlinkTelegram}
              disabled={saving}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid #ff6b6b',
                backgroundColor: 'white',
                color: '#ff6b6b',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                fontSize: '0.95rem',
              }}
            >
              🔓 Desvincular
            </button>
          )}
        </div>

        {/* Mostrar token si se generó */}
        {showToken && generatedToken && (
          <div
            style={{
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: 'rgba(76, 175, 80, 0.05)',
              border: '1px solid rgba(76, 175, 80, 0.2)',
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.75rem' }}>
              ✨ Tu token de vinculación:
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '2px solid var(--color-primary)',
                marginBottom: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {generatedToken}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedToken);
                  setMessage('✅ Token copiado al portapapeles');
                  setTimeout(() => setMessage(''), 2000);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  whiteSpace: 'nowrap',
                }}
              >
                📋 Copiar
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)' }}>
              Abre Telegram y ve a <strong>@TecRuralDiagBot</strong>, luego envía: <code>/link {generatedToken}</code>
            </p>
          </div>
        )}

        {/* Toggle de notificaciones Telegram */}
        {telegramLinked && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: '#f9fafb',
              border: '1px solid var(--color-border)',
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Notificaciones en Telegram</p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                Recibe diagnósticos completados en Telegram
              </p>
            </div>

            <label
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={notifyTelegram}
                onChange={handleTelegramNotificationToggle}
                disabled={saving}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              />
              <div
                style={{
                  display: 'inline-block',
                  width: '50px',
                  height: '28px',
                  borderRadius: '14px',
                  backgroundColor: notifyTelegram ? 'var(--color-primary)' : '#ccc',
                  transition: 'background-color 0.3s',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: notifyTelegram ? '26px' : '3px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    transition: 'left 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
            </label>
          </div>
        )}

        {/* Información adicional de Telegram */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(0, 136, 204, 0.05)',
            border: '1px solid rgba(0, 136, 204, 0.2)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text)' }}>
            <strong>ℹ️ Cómo funciona:</strong> Genera un token desde aquí, luego abre Telegram y envía
            el comando al bot. Después podrás recibir diagnósticos directamente en Telegram.
          </p>
        </div>
      </div>

      {/* Sección de Perfil */}
      <div className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', marginBottom: '0.5rem' }}>
            👤 Información de Perfil
          </h2>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
              Nombre
            </p>
            <p style={{ margin: 0, fontWeight: 500 }}>
              {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'No especificado'}
            </p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
              Email
            </p>
            <p style={{ margin: 0, fontWeight: 500 }}>{profile?.email || 'No disponible'}</p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
              Teléfono
            </p>
            <p style={{ margin: 0, fontWeight: 500 }}>
              {profile?.phone ? (
                <span>{profile.phone}</span>
              ) : (
                <span style={{ color: 'var(--color-muted)' }}>No registrado</span>
              )}
            </p>
          </div>

          <div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
              Créditos Disponibles
            </p>
            <p style={{ margin: 0, fontWeight: 500, fontSize: '1.2rem', color: 'var(--color-primary)' }}>
              {profile?.credits_remaining ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Pie de página */}
      <div
        style={{
          padding: '1rem',
          borderRadius: '12px',
          backgroundColor: '#f9fafb',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          ¿Necesitas ayuda? Contacta al administrador para cambios en tu perfil.
        </p>
      </div>
    </div>
  );
}
