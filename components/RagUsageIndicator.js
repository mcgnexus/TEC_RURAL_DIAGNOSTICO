'use client';

import { useState, useEffect } from 'react';

export default function RagUsageIndicator({ diagnosisId, highlightFilename = null }) {
  const [ragData, setRagData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!diagnosisId) return;

    const fetchRagUsage = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/diagnoses/${diagnosisId}/rag-usage`);
        
        if (!response.ok) {
          throw new Error('Error al cargar información RAG');
        }

        const data = await response.json();
        setRagData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching RAG usage:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRagUsage();
  }, [diagnosisId]);

  if (loading) {
    return (
      <div style={{ 
        padding: '1rem', 
        borderRadius: '12px', 
        background: 'var(--color-surface)', 
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span>🔍</span>
        <span style={{ color: 'var(--color-muted)' }}>Verificando uso de RAG...</span>
      </div>
    );
  }

  if (error || !ragData?.ragUsage) {
    return null; // No mostrar nada si hay error o no hay datos
  }

  const { ragUsage } = ragData;

  if (!ragUsage.enabled || ragUsage.sources.length === 0) {
    return (
      <div style={{ 
        padding: '1rem', 
        borderRadius: '12px', 
        background: '#fef3c7', 
        border: '1px solid #f59e0b',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span>⚠️</span>
        <span style={{ color: '#92400e' }}>Este diagnóstico no utilizó el conocimiento base del sistema</span>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '1.5rem', 
      borderRadius: '16px', 
      background: 'var(--color-surface)', 
      border: '1px solid var(--color-border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.2rem' }}>📚</span>
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
          Citas de documentos RAG
        </h3>
      </div>

      {/* Estadísticas generales */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ 
          padding: '1rem', 
          borderRadius: '12px', 
          background: 'white',
          border: '1px solid var(--color-border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
            {ragUsage.stats.totalSources}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Fragmentos utilizados</div>
        </div>

        <div style={{ 
          padding: '1rem', 
          borderRadius: '12px', 
          background: 'white',
          border: '1px solid var(--color-border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
            {ragUsage.stats.avgSimilarity}%
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Similitud promedio</div>
        </div>

        <div style={{ 
          padding: '1rem', 
          borderRadius: '12px', 
          background: 'white',
          border: '1px solid var(--color-border)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-warning)' }}>
            {ragUsage.documentsUsed}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Documentos consultados</div>
        </div>
      </div>
      
      {/* Lista de fuentes */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {ragUsage.sources.map(source => {
          const isHighlighted =
            highlightFilename &&
            String(source.filename || '').trim() === String(highlightFilename || '').trim();

          return (
            <div 
              key={source.chunkId} 
              style={{ 
                padding: '1rem', 
                borderRadius: '12px', 
                background: 'white',
                border: isHighlighted ? '1px solid var(--color-success)' : '1px solid var(--color-border)'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '0.5rem' 
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  #{source.rank} - {source.filename}
                </span>
                {isHighlighted && (
                  <span
                    style={{
                      background: 'var(--color-success-light)',
                      color: 'var(--color-success)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      marginLeft: '0.75rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Fuente de confirmación
                  </span>
                )}
                <span style={{ 
                  background: source.similarityScore > 0.8 ? 'var(--color-success-light)' : 
                             source.similarityScore > 0.6 ? 'var(--color-warning-light)' : 
                             'var(--color-error-light)', 
                  color: source.similarityScore > 0.8 ? 'var(--color-success)' : 
                         source.similarityScore > 0.6 ? 'var(--color-warning)' : 
                         'var(--color-error)', 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: '8px', 
                  fontSize: '0.8rem',
                  fontWeight: 500
                }}>
                  {source.similarityPercentage}% similitud
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)', lineHeight: 1.5 }}>
                {source.contentPreview}
              </p>
            </div>
          );
        })}
      </div>

      {/* Mensaje informativo */}
      <div style={{ 
        marginTop: '1rem',
        padding: '0.75rem',
        borderRadius: '8px',
        background: 'var(--color-primary-light)',
        border: '1px solid var(--color-primary)',
        fontSize: '0.85rem',
        color: 'var(--color-primary)'
      }}>
        <strong>ℹ️ Nota:</strong> Este diagnóstico fue generado utilizando conocimiento de documentos 
        previamente indexados en el sistema. La similitud indica qué tan relevante fue cada fragmento 
        para tu consulta.
      </div>
    </div>
  );
}
