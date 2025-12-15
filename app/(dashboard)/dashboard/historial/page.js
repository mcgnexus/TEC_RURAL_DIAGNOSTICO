'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseBrowser';

import ReactMarkdown from 'react-markdown';

export default function HistorialPage() {
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    const fetchDiagnoses = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setDiagnoses([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('diagnoses')
        .select('id, cultivo_name, status, created_at, confidence_score')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setDiagnoses(data || []);
      setLoading(false);
    };

    fetchDiagnoses();
  }, []);

  const handleViewDiagnosis = async id => {
    setDetailError('');
    setDetailLoading(true);
    setSelectedDiagnosis(null);
    try {
      const { data, error } = await supabase
        .from('diagnoses')
        .select(
          'id, cultivo_name, ai_diagnosis_md, confidence_score, created_at, gps_lat, gps_long, status'
        )
        .eq('id', id)
        .single();

      if (error) {
        setDetailError('No se pudo cargar el diagnóstico seleccionado.');
        return;
      }

      setSelectedDiagnosis(data);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Historial</p>
        <h1 style={{ margin: '4px 0 8px', fontSize: '1.9rem' }}>Diagnósticos recientes</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Revisa tus últimas consultas y exporta los informes cuando lo necesites.
        </p>
      </header>

      <div className="card">
        <table className="table-minimal">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cultivo</th>
              <th>Estado</th>
              <th>Confianza</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}
                >
                  Cargando historial...
                </td>
              </tr>
            ) : diagnoses.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}
                >
                  Aún no tienes diagnósticos.
                </td>
              </tr>
            ) : (
              diagnoses.map(diagnosis => (
                <tr key={diagnosis.id}>
                  <td>{new Date(diagnosis.created_at).toLocaleString('es-ES')}</td>
                  <td style={{ fontWeight: 600 }}>{diagnosis.cultivo_name}</td>
                  <td>{diagnosis.status}</td>
                  <td>
                    {diagnosis.confidence_score
                      ? `${(diagnosis.confidence_score * 100).toFixed(1)}%`
                      : 'Sin datos'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                      onClick={() => handleViewDiagnosis(diagnosis.id)}
                    >
                      Ver diagnóstico
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailLoading && (
        <div className="card">
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>Cargando diagnóstico...</p>
        </div>
      )}

      {detailError && (
        <div className="alert-banner alert-danger">
          {detailError}
        </div>
      )}

      {selectedDiagnosis && !detailLoading && (
        <div className="card" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-muted)', marginBottom: 4 }}>
              Detalle del diagnóstico
            </p>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{selectedDiagnosis.cultivo_name}</h2>
            <p style={{ margin: '4px 0', color: 'var(--color-muted)' }}>
              {new Date(selectedDiagnosis.created_at).toLocaleString('es-ES')} · Estado:{' '}
              {selectedDiagnosis.status} · Confianza:{' '}
              {typeof selectedDiagnosis.confidence_score === 'number'
                ? `${(selectedDiagnosis.confidence_score * 100).toFixed(1)}%`
                : 'Sin datos'}
            </p>
          </div>
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              background: '#f9fafb',
              border: '1px solid var(--color-border)',
            }}
            className="markdown-content"
          >
            <ReactMarkdown>
              {selectedDiagnosis.ai_diagnosis_md || 'Diagnóstico no disponible.'}
            </ReactMarkdown>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <a
              href={`/api/export-pdf/${selectedDiagnosis.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
            >
              Descargar PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
