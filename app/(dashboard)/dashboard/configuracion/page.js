'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseBrowser';
import { useUserContext } from '@/components/UserContext';

export default function ConfiguracionPage() {
  const { profile, loading } = useUserContext();
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile?.notify_whatsapp_on_diagnosis !== undefined) {
      setNotifyWhatsApp(profile.notify_whatsapp_on_diagnosis !== false);
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
