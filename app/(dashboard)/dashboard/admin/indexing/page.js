'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUserContext } from '@/components/UserContext';

export default function IndexingV2Page() {
  const { profile } = useUserContext();
  const [files, setFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const isAdmin = profile?.role === 'admin';
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState('');
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);

  const hasProcessing = useMemo(
    () => documents.some(doc => doc.status === 'processing' || doc.status === 'pending'),
    [documents]
  );

  const fetchDocuments = async () => {
    const response = await fetch('/api/indexing/documents');
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los documentos.');
    setDocuments(result.documents || []);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchDocuments().catch(err => setMessage(err.message));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      fetchDocuments().catch(() => {});
    }, 1500);
    return () => clearInterval(interval);
  }, [hasProcessing, isAdmin]);

  const handleFileChange = event => {
    const selected = Array.from(event.target.files || []);
    setFiles(selected);
    setMessage('');
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage('Selecciona al menos un archivo para continuar.');
      return;
    }

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    setIsUploading(true);
    setMessage('Subiendo archivos...');

    try {
      const response = await fetch('/api/indexing/upload', { method: 'POST', body: formData });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error || 'Error al subir archivos.');
        return;
      }

      const createdCount = result.created?.length || 0;
      const failedCount = result.failed?.length || 0;
      setMessage(`Listo: ${createdCount} creados${failedCount ? `, ${failedCount} fallidos` : ''}.`);
      setFiles([]);
      await fetchDocuments();
    } catch (error) {
      setMessage('Error al subir: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const processDocument = async id => {
    setProcessingId(id);
    setMessage('Procesando documento...');
    try {
      const response = await fetch('/api/indexing/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id, chunkSize, chunkOverlap }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Error procesando documento.');
      setMessage('Documento procesado.');
      await fetchDocuments();
    } catch (error) {
      setMessage(error.message);
      await fetchDocuments().catch(() => {});
    } finally {
      setProcessingId(null);
    }
  };

  const openChunks = async doc => {
    setSelectedDocument(doc);
    setChunks([]);
    setChunksError('');
    setChunksLoading(true);

    try {
      const response = await fetch(`/api/indexing/documents/${doc.id}/chunks?limit=200`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los chunks.');
      setChunks(result.chunks || []);
    } catch (error) {
      setChunksError(error.message);
    } finally {
      setChunksLoading(false);
    }
  };

  const closeChunks = () => {
    setSelectedDocument(null);
    setChunks([]);
    setChunksError('');
    setChunksLoading(false);
  };

  const processNextPending = async () => {
    setProcessingId('queue');
    setMessage('Procesando siguiente en cola...');
    try {
      const response = await fetch('/api/indexing/process-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowFailed: true, chunkSize, chunkOverlap }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const extra = result.code || result.details || result.hint ? ` (${[result.code, result.details, result.hint].filter(Boolean).join(' | ')})` : '';
        throw new Error((result.error || 'Error procesando en cola.') + extra);
      }
      if (result.status === 'empty') {
        setMessage('No hay documentos pendientes.');
      } else {
        setMessage('Documento procesado.');
      }
      await fetchDocuments();
    } catch (error) {
      setMessage(error.message);
      await fetchDocuments().catch(() => {});
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Indexacion v2 (borrador)</p>
        <h1 style={{ margin: '4px 0 8px', fontSize: '1.8rem' }}>Nuevo flujo de indexacion</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Sube archivos a Storage, crea registros en Supabase y procesa (extrae, limpia, chunk, embeddings) con progreso.
        </p>
      </header>

      {!isAdmin && (
        <div className="alert-banner alert-danger">Solo los administradores pueden acceder a esta seccion.</div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600 }}>1) Subir archivos</p>
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.9rem' }}>Crea documentos en `ingestion_documents` y guarda el archivo en Storage.</p>
        </div>
        <div className="file-input-wrapper" style={{ width: '100%' }}>
          <button type="button" className="btn-secondary" style={{ width: '100%', textAlign: 'center' }} disabled={!isAdmin || isUploading || !!processingId}>
            {files.length > 0 ? `${files.length} archivos seleccionados` : 'Seleccionar archivos'}
          </button>
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.txt"
            disabled={!isAdmin || isUploading || !!processingId}
            className="file-input-hidden"
          />
        </div>
        <button className="btn-gradient" onClick={handleUpload} disabled={isUploading || !!processingId || files.length === 0}>
          {isUploading ? 'Subiendo...' : 'Subir archivos'}
        </button>
        {files.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--color-muted)' }}>
            {files.map(file => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>2) Procesar</p>
            <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.9rem' }}>
              Extrae texto, limpia, chunk, genera embeddings (Mistral) e inserta en `ingestion_chunks`.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-outline" onClick={() => fetchDocuments().catch(() => {})} disabled={!!processingId}>
              Refrescar
            </button>
            <button className="btn-gradient" onClick={processNextPending} disabled={!!processingId || documents.length === 0}>
              {processingId ? 'Procesando...' : 'Procesar siguiente'}
            </button>
          </div>
        </div>

        {message && <div className="alert-banner alert-info">{message}</div>}

        <div style={{ display: 'grid', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '16px', background: 'rgba(2, 6, 23, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Configuracion de chunking</p>
              <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                Valores por defecto: chunkSize 1000, chunkOverlap 200.
              </p>
            </div>
            <button
              className="btn-outline"
              disabled={!!processingId}
              onClick={() => {
                setChunkSize(1000);
                setChunkOverlap(200);
              }}
            >
              Reset
            </button>
          </div>

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
              <span>chunkSize</span>
              <span>{chunkSize}</span>
            </div>
            <input
              type="range"
              min={200}
              max={3000}
              step={50}
              value={chunkSize}
              disabled={!isAdmin || !!processingId}
              onChange={e => {
                const next = Number(e.target.value);
                setChunkSize(next);
                setChunkOverlap(prev => Math.min(prev, Math.max(0, next - 1)));
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
              <span>chunkOverlap</span>
              <span>{chunkOverlap}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, chunkSize - 1)}
              step={25}
              value={chunkOverlap}
              disabled={!isAdmin || !!processingId}
              onChange={e => setChunkOverlap(Number(e.target.value))}
            />
          </div>
        </div>

        {documents.length === 0 ? (
          <div style={{ color: 'var(--color-muted)' }}>No hay documentos.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {documents.map(doc => {
              const total = Number(doc.total_chunks || 0);
              const processed = Number(doc.processed_chunks || 0);
              const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
              const isBusy = processingId === doc.id || doc.status === 'processing';

              return (
                <div
                  key={doc.id}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    background: 'var(--color-surface)',
                    display: 'grid',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
                    <div style={{ minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => openChunks(doc)}
                        disabled={!isAdmin || chunksLoading}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          margin: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: 'inherit',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%',
                        }}
                        title="Ver chunks"
                      >
                        {doc.original_name}
                      </button>
                      <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                        {doc.status}
                        {doc.error_message ? ` · ${doc.error_message}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-outline"
                          disabled={!!processingId || doc.status === 'ready'}
                          onClick={() => processDocument(doc.id)}
                        >
                          {isBusy ? 'Procesando...' : doc.status === 'failed' ? 'Reintentar' : 'Procesar'}
                        </button>
                        <button
                          className="btn-outline"
                          disabled={!!processingId}
                          onClick={async () => {
                            const ok = confirm(
                              `Borrar "${doc.original_name}" y sus chunks? Esta accion no se puede deshacer.`
                            );
                            if (!ok) return;
                            setProcessingId(doc.id);
                            try {
                              const resp = await fetch(`/api/indexing/documents/${doc.id}`, { method: 'DELETE' });
                              const json = await resp.json().catch(() => ({}));
                              if (!resp.ok) throw new Error(json.error || 'No se pudo borrar el documento.');
                              setMessage('Documento borrado.');
                              await fetchDocuments();
                            } catch (e) {
                              setMessage(e.message);
                            } finally {
                              setProcessingId(null);
                            }
                          }}
                        >
                          Borrar
                        </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                      <span>
                        {processed}/{total || '-'} chunks
                      </span>
                      <span>{total ? `${percent}%` : ''}</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, background: 'var(--color-secondary)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedDocument && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={event => {
            if (event.target === event.currentTarget) closeChunks();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div
            className="card"
            style={{
              width: 'min(980px, 100%)',
              maxHeight: '80vh',
              overflow: 'auto',
              display: 'grid',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: '0.85rem' }}>Chunks</p>
                <h2 style={{ margin: '6px 0 0', fontSize: '1.15rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedDocument.original_name}
                </h2>
              </div>
              <button className="btn-outline" onClick={closeChunks}>
                Cerrar
              </button>
            </div>

            {chunksError && <div className="alert-banner alert-danger">{chunksError}</div>}
            {chunksLoading ? (
              <div style={{ color: 'var(--color-muted)' }}>Cargando chunks...</div>
            ) : chunks.length === 0 ? (
              <div style={{ color: 'var(--color-muted)' }}>
                No hay chunks para mostrar. Procesa el documento para generarlos.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {chunks.map(chunk => (
                  <details
                    key={chunk.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '14px',
                      border: '1px solid var(--color-border)',
                      background: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      Chunk #{chunk.chunk_index}
                    </summary>
                    <pre
                      style={{
                        marginTop: 10,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: '0.9rem',
                        lineHeight: 1.45,
                      }}
                    >
                      {chunk.content}
                    </pre>
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
