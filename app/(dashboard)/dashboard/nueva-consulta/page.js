'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import IconoTecRural from '@/components/IconoTecRural';

export default function NuevaConsultaPage() {
  const router = useRouter();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cultivoName, setCultivoName] = useState('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsData, setGpsData] = useState({ lat: null, long: null });
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setError('');
    setStatusMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: 'environment' } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      if (debug) {
        console.error('[diagnose] request failed', err);
      }
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
        streamRef.current = fallbackStream;
        setIsCameraActive(true);
      } catch (innerErr) {
        setError('No se pudo acceder a la cámara. Usa la opción de subir foto.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    setImageFile(null);
    setStatusMessage('Foto capturada correctamente.');
  };

  const handleFileInput = event => {
    setCapturedImage(null);
    setImageFile(event.target.files[0] || null);
    setStatusMessage('');
  };

  const activateGPS = () => {
    if (!navigator.geolocation) {
      setError('La geolocalización no es soportada.');
      return;
    }

    setGpsEnabled(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setGpsData({
          lat: position.coords.latitude,
          long: position.coords.longitude,
        });
        setStatusMessage('GPS activado correctamente.');
      },
      () => {
        setError('No se pudo obtener la ubicación. Verifica permisos del navegador.');
        setGpsEnabled(false);
      }
    );
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setError('');
    setStatusMessage('');

    const debug = process.env.NODE_ENV !== 'production';
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let groupStarted = false;

    if (!cultivoName.trim()) {
      setError('Por favor ingresa el nombre del cultivo.');
      return;
    }

    if (!capturedImage && !imageFile) {
      setError('Captura una foto o sube una imagen desde tu dispositivo.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('cultivoName', cultivoName.trim());
      formData.append('notes', notes.trim());

      if (gpsData.lat && gpsData.long) {
        formData.append('gpsLat', String(gpsData.lat));
        formData.append('gpsLong', String(gpsData.long));
      }

      if (capturedImage) {
        const blob = await (await fetch(capturedImage)).blob();
        formData.append('image', blob, 'captura.jpg');
        if (debug) {
          console.log('[diagnose] using captured image', { bytes: blob.size, type: blob.type });
        }
      } else if (imageFile) {
        formData.append('image', imageFile, imageFile.name);
        if (debug) {
          console.log('[diagnose] using file image', {
            name: imageFile.name,
            bytes: imageFile.size,
            type: imageFile.type,
          });
        }
      }

      if (debug) {
        groupStarted = true;
        console.groupCollapsed('[diagnose] submit');
        console.log({
          cultivoName: cultivoName.trim(),
          notesChars: notes.trim().length,
          gpsLat: gpsData.lat,
          gpsLong: gpsData.long,
        });
      }

      const response = await fetch('/api/diagnose', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json().catch(() => ({}));
      const requestId =
        response.headers.get('x-diagnose-request-id') || result.requestId || null;

      if (debug) {
        const elapsedMs =
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        console.log('[diagnose] response', {
          status: response.status,
          ok: response.ok,
          requestId,
          elapsedMs: Math.round(elapsedMs),
        });
        console.log('[diagnose] body', result);
      }

      if (!response.ok) {
        if (response.status === 503 || response.status === 429) {
          setError(result.error || 'El servicio de IA está temporalmente sobrecargado. Intenta nuevamente en unos minutos.');
        } else {
          setError(result.error || 'Error procesando la consulta.');
        }
      } else if (result.needsBetterPhoto) {
        setError(result.message || 'La foto no fue clara, intenta nuevamente.');
      } else {
        setStatusMessage('Diagnóstico generado correctamente.');
        router.push('/dashboard/historial');
      }
    } catch (err) {
      setError('Ocurrió un problema al enviar la consulta. Intenta más tarde.');
    } finally {
      setIsSubmitting(false);
      if (debug && groupStarted) {
        console.groupEnd();
      }
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.75rem' }}>
      <header>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Consulta</p>
        <h1 style={{ margin: '4px 0 8px', fontSize: '1.9rem' }}>Nueva consulta</h1>
        <p style={{ color: 'var(--color-muted)' }}>
          Captura una foto del cultivo y describe el problema para obtener un diagnóstico.
        </p>
      </header>

      {error && (
        <div className="alert-banner alert-danger">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="alert-banner alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <IconoTecRural size="sm" style={{ display: 'inline-block', flexShrink: 0 }} />
          {statusMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
        <div className="card" style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Nombre del cultivo</label>
            <input
              type="text"
              value={cultivoName}
              onChange={e => setCultivoName(e.target.value)}
              className="input-field"
              disabled={isSubmitting}
              placeholder="Ej: Tomate verde"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Describe lo que observas</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="input-field"
              disabled={isSubmitting}
              placeholder="Ej: Manchas amarillas en hojas superiores..."
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Sube una foto desde tu dispositivo</p>
            <div className="file-input-wrapper" style={{ width: '100%' }}>
              <button type="button" className="btn-secondary" style={{ width: '100%', textAlign: 'center' }}>
                {imageFile ? 'Cambiar imagen' : 'Seleccionar imagen'}
              </button>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInput}
                disabled={isSubmitting}
                className="file-input-hidden"
              />
            </div>
            {imageFile && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
                Imagen seleccionada: <strong>{imageFile.name}</strong>
              </p>
            )}
          </div>

          {gpsData.lat && gpsData.long && (
            <div className="alert-banner alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <IconoTecRural size="sm" style={{ display: 'inline-block', flexShrink: 0 }} />
              Ubicación registrada: {gpsData.lat.toFixed(5)}, {gpsData.long.toFixed(5)}
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>Captura con cámara</p>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                Usa la cámara trasera para mejor enfoque.
              </p>
            </div>
            <button
              type="button"
              onClick={isCameraActive ? stopCamera : startCamera}
              className="btn-outline"
              style={{ padding: '0.5rem 1rem' }}
            >
              {isCameraActive ? 'Detener cámara' : 'Activar cámara'}
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <div
              style={{
                borderRadius: '24px',
                border: '1.5px dashed rgba(31,41,55,0.2)',
                height: 280,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f9fafb',
                overflow: 'hidden',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isCameraActive ? 'block' : 'none',
                }}
              />

              {!isCameraActive && !capturedImage && (
                <p style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '0 1rem' }}>
                  Activa la cámara o sube una foto para continuar.
                </p>
              )}

              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Captura previa"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
            <div className="gps-toggle">
              <button
                type="button"
                onClick={activateGPS}
                className={`pill-toggle ${gpsEnabled ? 'pill-toggle--on' : 'pill-toggle--off'}`}
                disabled={gpsEnabled}
              >
                {gpsEnabled ? 'GPS activo' : 'GPS'}
              </button>
            </div>
          </div>

          {isCameraActive && (
            <button
              type="button"
              onClick={capturePhoto}
              className="btn-gradient"
              style={{ width: '100%' }}
            >
              Capturar foto
            </button>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="button" onClick={() => router.push('/dashboard')} className="btn-outline">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-gradient" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isSubmitting && <IconoTecRural size="sm" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }} />}
            {isSubmitting ? 'Enviando...' : 'Enviar consulta'}
          </button>
        </div>
      </form>
    </div>
  );
}
