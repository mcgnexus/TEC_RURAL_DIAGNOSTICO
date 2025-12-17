'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseBrowser';
import ReactMarkdown from 'react-markdown';
import RagUsageIndicator from '@/components/RagUsageIndicator';
import IconoTecRural from '@/components/IconoTecRural';

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
  const [isAdmin, setIsAdmin] = useState(false);

  const formatStatus = diagnosis => {
    if (diagnosis?.is_confirmed) return 'Confirmado';
    const raw = (diagnosis?.status || '').toLowerCase();
    if (raw === 'pending') return 'Pendiente';
    if (raw === 'reviewed') return 'Revisado';
    if (raw === 'rejected') return 'Rechazado';
    if (raw === 'approved') return 'Aprobado';
    return diagnosis?.status || 'Sin estado';
  };

  const extractDiseaseName = markdown => {
    if (!markdown) return 'Sin diagnóstico';

    const text = String(markdown);

    // Buscar título markdown (# Nombre de Enfermedad)
    const headingMatch = text.match(/^#{1,3}\s*(.+?)(?:\n|$)/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // Buscar patrón "Diagnóstico:" o "Enfermedad:" seguido del nombre
    const diagnosticoMatch = text.match(/(?:diagnóstico|enfermedad|problema):\s*\*{0,2}(.+?)\*{0,2}(?:\n|\.)/i);
    if (diagnosticoMatch) {
      return diagnosticoMatch[1].trim();
    }

    // Buscar texto en negrita al inicio (**Nombre**)
    const boldMatch = text.match(/^\*{2}(.+?)\*{2}/);
    if (boldMatch) {
      return boldMatch[1].trim();
    }

    // Tomar la primera línea no vacía
    const firstLine = text.split('\n').find(line => line.trim().length > 0);
    if (firstLine) {
      const cleaned = firstLine
        .replace(/[#*_`>]/g, '')
        .trim();
      return cleaned.length > 50 ? `${cleaned.slice(0, 50)}…` : cleaned;
    }

    return 'Sin diagnóstico';
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

      // Verificar si el usuario es admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');

      const { data } = await supabase
        .from('diagnoses')
        .select(`
          id,
          cultivo_name,
          ai_diagnosis_md,
          image_url,
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
      // Cargar diagnóstico básico (incluye llm_reasoning solo si es admin)
      const fields = `
        id,
        cultivo_name,
        ai_diagnosis_md,
        image_url,
        confidence_score,
        created_at,
        gps_lat,
        gps_long,
        status,
        is_confirmed,
        confirmation_source
        ${isAdmin ? ', llm_reasoning' : ''}
      `;

      const { data, error } = await supabase
        .from('diagnoses')
        .select(fields)
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
              <th>Imagen</th>
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
                  colSpan={8}
                  style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}
                >
                  Cargando historial...
                </td>
              </tr>
            ) : diagnoses.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: '24px', textAlign: 'center', color: 'var(--color-muted)' }}
                >
                  Aún no tienes diagnósticos.
                </td>
              </tr>
            ) : (
              diagnoses.map(diagnosis => (
                <tr key={diagnosis.id}>
                  <td>{new Date(diagnosis.created_at).toLocaleString('es-ES')}</td>
                  <td>
                    {diagnosis.image_url ? (
                      <img
                        src={diagnosis.image_url}
                        alt={`${diagnosis.cultivo_name} diagnosis`}
                        style={{
                          width: '60px',
                          height: '60px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <span style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>Sin imagen</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>{diagnosis.cultivo_name}</td>
                  <td style={{ fontWeight: 500 }}>{extractDiseaseName(diagnosis.ai_diagnosis_md)}</td>
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
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <IconoTecRural size="xs" style={{ display: 'inline-block' }} />
                  Confirmado por la base de conocimiento ({selectedDiagnosis.confirmation_source})
                </span>
              </div>
            )}
          </div>

          {/* Imagen del diagnóstico */}
          {selectedDiagnosis.image_url && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '1rem',
                borderRadius: '16px',
                background: '#f9fafb',
                border: '1px solid var(--color-border)',
              }}
            >
              <img
                src={selectedDiagnosis.image_url}
                alt={`Diagnóstico de ${selectedDiagnosis.cultivo_name}`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                  borderRadius: '12px',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}

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

          {/* Componente de indicador RAG - Solo para administradores */}
          {isAdmin && (
            <RagUsageIndicator
              diagnosisId={selectedDiagnosis.id}
              highlightFilename={selectedDiagnosis.confirmation_source}
            />
          )}

          {/* Cadena de razonamiento del LLM - Solo para administradores */}
          {isAdmin && selectedDiagnosis.llm_reasoning && (
            <div className="card" style={{ background: '#fff5e6', border: '2px solid #ff9800' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#e65100', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🔒 Cadena de Razonamiento del LLM (Solo Administrador)
                </h3>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#666' }}>
                  Esta sección muestra el proceso de razonamiento completo que utilizó el modelo de IA para llegar al diagnóstico.
                </p>
              </div>
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: '#fff',
                  border: '1px solid #ffa726',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                }}
              >
                {selectedDiagnosis.llm_reasoning}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-gradient"
              disabled={confirmLoading || selectedDiagnosis.is_confirmed}
              onClick={() => handleConfirmDiagnosis(selectedDiagnosis.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <IconoTecRural size="sm" style={{ display: 'inline-block' }} />
              {selectedDiagnosis.is_confirmed ? 'Confirmado' : confirmLoading ? 'Confirmando...' : 'Confirmar'}
            </button>
            <a href="/dashboard/nueva-consulta" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <IconoTecRural size="sm" style={{ display: 'inline-block' }} />
              Nueva fotografía
            </a>
            <a
              href={`/api/export-pdf/${selectedDiagnosis.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <IconoTecRural size="sm" style={{ display: 'inline-block' }} />
              Descargar PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
