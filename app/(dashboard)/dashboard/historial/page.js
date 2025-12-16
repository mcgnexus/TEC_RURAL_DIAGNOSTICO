'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseBrowser';
import ReactMarkdown from 'react-markdown';
import RagUsageIndicator from '@/components/RagUsageIndicator';

export default function HistorialPage() {
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [ragDocsByDiagnosis, setRagDocsByDiagnosis] = useState({});
  const [deleteError, setDeleteError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const formatStatus = diagnosis => {
    if (diagnosis?.is_confirmed) return 'Confirmado';
    const raw = (diagnosis?.status || '').toLowerCase();
    if (raw === 'pending') return 'Pendiente';
    if (raw === 'reviewed') return 'Revisado';
    if (raw === 'rejected') return 'Rechazado';
    if (raw === 'approved') return 'Aprobado';
    return diagnosis?.status || 'Sin estado';
  };

  const buildDiagnosisPreview = markdown => {
    if (!markdown) return 'Sin diagnóstico';
    const cleaned = String(markdown)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#*_`>\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length > 90 ? `${cleaned.slice(0, 90)}…` : cleaned;
  };

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
        .select(`
          id, 
          cultivo_name, 
          ai_diagnosis_md,
          status, 
          created_at, 
          confidence_score,
          is_confirmed,
          confirmation_source,
          diagnosis_rag_sources(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setDiagnoses(data || []);
      setLoading(false);
    };

    fetchDiagnoses();
  }, []);

  useEffect(() => {
    if (!diagnoses || diagnoses.length === 0) return;
    const controller = new AbortController();

    const loadRagDocs = async () => {
      const candidates = diagnoses
        .filter(d => (d?.diagnosis_rag_sources?.[0]?.count || 0) > 0)
        .map(d => d.id);

      const missing = candidates.filter(id => ragDocsByDiagnosis[id] == null);
      if (missing.length === 0) return;

      await Promise.all(
        missing.map(async id => {
          try {
            const res = await fetch(`/api/diagnoses/${id}/rag-usage`, {
              signal: controller.signal,
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) return;
            const docsUsed = body?.ragUsage?.documentsUsed;
            if (typeof docsUsed !== 'number') return;
            setRagDocsByDiagnosis(prev => ({ ...prev, [id]: docsUsed }));
          } catch {
            return;
          }
        })
      );
    };

    loadRagDocs();

    return () => {
      controller.abort();
    };
  }, [diagnoses, ragDocsByDiagnosis]);

  const handleViewDiagnosis = async id => {
    setDetailError('');
    setDeleteError('');
    setDetailLoading(true);
    setSelectedDiagnosis(null);
    try {
      // Cargar diagnóstico básico
      const { data, error } = await supabase
        .from('diagnoses')
        .select(`
          id, 
          cultivo_name, 
          ai_diagnosis_md, 
          confidence_score, 
          created_at, 
          gps_lat, 
          gps_long, 
          status,
          is_confirmed,
          confirmation_source
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error cargando diagnóstico:', error);
        setDetailError('No se pudo cargar el diagnóstico seleccionado.');
        return;
      }

      setSelectedDiagnosis(data);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteDiagnosis = async id => {
    setDeleteError('');
    setConfirmError('');
    if (!id) return;
    const confirmed = window.confirm('¿Quieres borrar este diagnóstico? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/diagnoses/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(body?.error || 'No se pudo borrar el diagnóstico.');
        return;
      }
      setDiagnoses(prev => prev.filter(d => d.id !== id));
      setSelectedDiagnosis(prev => (prev?.id === id ? null : prev));
    } catch {
      setDeleteError('No se pudo borrar el diagnóstico.');
    }
  };

  const handleConfirmDiagnosis = async id => {
    setConfirmError('');
    setDeleteError('');
    if (!id) return;
    if (confirmLoading) return;

    const confirmed = window.confirm('¿Quieres confirmar este diagnóstico?');
    if (!confirmed) return;

    setConfirmLoading(true);
    try {
      const res = await fetch(`/api/diagnoses/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConfirmError(body?.error || 'No se pudo confirmar el diagnóstico.');
        return;
      }

      const updated = body?.diagnosis || null;
      setSelectedDiagnosis(prev =>
        prev && prev.id === id
          ? {
              ...prev,
              is_confirmed: true,
              confirmation_source: updated?.confirmation_source || prev.confirmation_source,
            }
          : prev
      );

      setDiagnoses(prev =>
        prev.map(d =>
          d.id === id
            ? {
                ...d,
                is_confirmed: true,
                confirmation_source: updated?.confirmation_source || d.confirmation_source,
              }
            : d
        )
      );
    } catch {
      setConfirmError('No se pudo confirmar el diagnóstico.');
    } finally {
      setConfirmLoading(false);
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
              <th>Diagnóstico</th>
              <th>Estado</th>
              <th>Confianza</th>
              <th>RAG</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}
                >
                  Cargando historial...
                </td>
              </tr>
            ) : diagnoses.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
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
                  <td style={{ color: 'var(--color-muted)' }}>{buildDiagnosisPreview(diagnosis.ai_diagnosis_md)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span>{formatStatus(diagnosis)}</span>
                      {diagnosis.is_confirmed && (
                        <span
                          style={{
                            background: 'var(--color-success-light)',
                            color: 'var(--color-success)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                          title={`Confirmado con: ${diagnosis.confirmation_source}`}
                        >
                          ✅ Confirmado
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {diagnosis.confidence_score
                      ? `${(diagnosis.confidence_score * 100).toFixed(1)}%`
                      : 'Sin datos'}
                  </td>
                  <td>
                    {diagnosis.diagnosis_rag_sources?.[0]?.count > 0 ? (
                      <span
                        style={{
                          background: 'var(--color-primary-light)',
                          color: 'var(--color-primary)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          display: 'inline-block',
                        }}
                        title={`${diagnosis.diagnosis_rag_sources[0].count} fragmentos RAG utilizados`}
                      >
                        {typeof ragDocsByDiagnosis[diagnosis.id] === 'number'
                          ? `${ragDocsByDiagnosis[diagnosis.id]} doc · ${diagnosis.diagnosis_rag_sources[0].count} frag`
                          : `— doc · ${diagnosis.diagnosis_rag_sources[0].count} frag`}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={() => handleViewDiagnosis(diagnosis.id)}
                      >
                        Ver diagnóstico
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={() => handleDeleteDiagnosis(diagnosis.id)}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {deleteError && <div className="alert-banner alert-danger">{deleteError}</div>}

      {confirmError && <div className="alert-banner alert-danger">{confirmError}</div>}

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
              {formatStatus(selectedDiagnosis)} · Confianza:{' '}
              {typeof selectedDiagnosis.confidence_score === 'number'
                ? `${(selectedDiagnosis.confidence_score * 100).toFixed(1)}%`
                : 'Sin datos'}
            </p>
            {selectedDiagnosis.is_confirmed && (
              <div style={{marginTop: '0.5rem'}}>
                <span 
                  style={{ 
                    background: 'var(--color-success-light)', 
                    color: 'var(--color-success)', 
                    padding: '0.35rem 0.75rem', 
                    borderRadius: '12px', 
                    fontSize: '0.85rem',
                    fontWeight: 500
                  }}
                >
                  ✅ Confirmado por la base de conocimiento ({selectedDiagnosis.confirmation_source})
                </span>
              </div>
            )}
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

          {/* Componente de indicador RAG */}
          <RagUsageIndicator
            diagnosisId={selectedDiagnosis.id}
            highlightFilename={selectedDiagnosis.confirmation_source}
          />
 
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-gradient"
              disabled={confirmLoading || selectedDiagnosis.is_confirmed}
              onClick={() => handleConfirmDiagnosis(selectedDiagnosis.id)}
            >
              {selectedDiagnosis.is_confirmed ? 'Confirmado' : confirmLoading ? 'Confirmando...' : 'Confirmar'}
            </button>
            <a href="/dashboard/nueva-consulta" className="btn-secondary">
              Nueva fotografía
            </a>
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
