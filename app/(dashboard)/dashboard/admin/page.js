'use client';

import { useState } from 'react';
import { useUserContext } from '@/components/UserContext';

export default function AdminHome() {
  const { profile } = useUserContext();

  if (profile?.role !== 'admin') {
    return <div className="alert-banner alert-danger">No tienes permisos para acceder a esta seccion.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Administracion</p>
        <h1 style={{ margin: '4px 0 8px', fontSize: '1.9rem' }}>Panel administrativo</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Gestiona los usuarios de la plataforma y las herramientas administrativas.
        </p>
      </header>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <a href="/dashboard/admin/indexing" className="card" style={{ textDecoration: 'none' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Indexacion</p>
          <h2 style={{ margin: '6px 0', fontSize: '1.25rem' }}>Nuevo flujo (borrador)</h2>
          <p style={{ color: 'var(--color-muted)' }}>
            Boceto inicial para el pipeline de ingesta de documentos v2.
          </p>
        </a>

        <a href="/dashboard/admin/rag-search" className="card" style={{ textDecoration: 'none' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>RAG</p>
          <h2 style={{ margin: '6px 0', fontSize: '1.25rem' }}>Busqueda de conocimiento</h2>
          <p style={{ color: 'var(--color-muted)' }}>
            Revisa los fragmentos indexados y su similitud con una consulta.
          </p>
        </a>

        <a href="/dashboard/admin/usuarios" className="card" style={{ textDecoration: 'none' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Agricultores</p>
          <h2 style={{ margin: '6px 0', fontSize: '1.25rem' }}>Gestion de usuarios</h2>
          <p style={{ color: 'var(--color-muted)' }}>
            Ajusta creditos y revisa la actividad de los productores registrados.
          </p>
        </a>

        <GeminiHealthCard />
      </div>
    </div>
  );
}

function GeminiHealthCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/health/gemini');
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) {
        setError(body.error || 'No se pudo verificar la conexión con Gemini.');
        return;
      }
      setResult(body);
    } catch (err) {
      setError('Error realizando la verificación. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ display: 'grid', gap: '0.65rem' }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Salud del proveedor IA</p>
      <h2 style={{ margin: '6px 0', fontSize: '1.25rem' }}>Probar conexión a Gemini</h2>
      <p style={{ color: 'var(--color-muted)' }}>
        Realiza una llamada de prueba al modelo para confirmar que la API responde.
      </p>
      {error && <div className="alert-banner alert-danger">{error}</div>}
      {result && (
        <div className="alert-banner alert-success">
          Conexión OK · Modelo: {result.model} · Tiempo: {result.elapsedMs} ms
        </div>
      )}
      <button
        className="btn-secondary"
        disabled={loading}
        onClick={handleCheck}
        style={{ justifySelf: 'start' }}
      >
        {loading ? 'Verificando…' : 'Probar ahora'}
      </button>
    </div>
  );
}
