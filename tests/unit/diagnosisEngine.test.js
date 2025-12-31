import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDiagnosis, ensureEnv } from '../../lib/diagnosisEngine';
import { callGeminiApi } from '../../lib/gemini';

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn(),
    upload: vi.fn(),
  },
};

let creditsRemaining = 10;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('../../lib/embeddingService', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
}));

vi.mock('../../lib/gemini', () => ({
  callGeminiApi: vi.fn(),
}));

describe('diagnosisEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    creditsRemaining = 10;

    mockSupabase.from.mockImplementation(table => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { credits_remaining: creditsRemaining }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }

      if (table === 'diagnosis_cache') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }

      if (table === 'diagnoses') {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'diag-1', cultivo_name: 'Maiz', status: 'pending', created_at: new Date().toISOString() },
                  error: null,
                }),
            }),
          }),
        };
      }

      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    mockSupabase.rpc.mockImplementation(() => Promise.resolve({ data: [], error: null }));
    mockSupabase.storage.from.mockReturnThis();
    mockSupabase.storage.upload.mockImplementation(() =>
      Promise.resolve({ data: { path: 'test.jpg' }, error: null })
    );

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.NEXT_PUBLIC_DIAGNOSE_DEBUG = '1';
    process.env.DIAGNOSE_DEBUG = '1';

    if (typeof global.crypto === 'undefined') {
      global.crypto = { randomUUID: () => 'test-uuid' };
    } else if (typeof global.crypto.randomUUID === 'undefined') {
      global.crypto.randomUUID = () => 'test-uuid';
    }
  });

  it('ensureEnv should throw if env missing', () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    expect(() => ensureEnv()).toThrow();
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
  });

  describe('runDiagnosis', () => {
    it('should fail if userId is missing', async () => {
      const result = await runDiagnosis({ cultivoName: 'Maiz', imageBuffer: Buffer.from('test') });
      expect(result.error).toBe('El usuario es obligatorio.');
    });

    it('should fail if credits are 0', async () => {
      creditsRemaining = 0;

      const result = await runDiagnosis({
        userId: 'user-1',
        cultivoName: 'Maiz',
        imageBuffer: Buffer.from('test'),
      });

      expect(result.error).toContain('No tienes creditos disponibles');
      expect(result.statusCode).toBe(402);
    });

    it('should handle successful diagnosis flow', async () => {
      creditsRemaining = 10;

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            content: 'Diagnostico: Roya. Sintomas: manchas amarillas y necrosis en bordes.',
            similarity: 0.8,
            metadata: { diagnosis: 'Roya' },
          },
        ],
        error: null,
      });

      const observationResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    cultivo_detectado: 'Maiz',
                    cultivo_confianza: 90,
                    coincide_cultivo: true,
                    sintomas: ['manchas amarillas', 'necrosis en bordes'],
                    hallazgos_visuales: ['manchas amarillas en hojas', 'bordes necroticos'],
                    descripcion_visual: 'Hojas con manchas amarillas irregulares y bordes necroticos.',
                    calidad_imagen: { nitidez: 'alta', cobertura: 'media', notas: '' },
                    riesgos_visibles: ['mancha fungica'],
                    diagnosis_title_prelim: 'Roya',
                    vision_confidence: 90,
                  }),
                },
              ],
            },
          },
        ],
      };

      const diagnosisResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    diagnosis_title: 'Roya',
                    confidence_score: 90,
                    is_conclusive: true,
                    urgency_level: 'Alta',
                    supporting_points: ['manchas amarillas coinciden con contexto'],
                    report: {
                      descripcion_visual: 'Hojas con manchas amarillas y necrosis en bordes.',
                      por_que: 'Los sintomas observados coinciden con el contexto RAG.',
                      acciones_ecologicas: ['Retirar hojas afectadas', 'Mejorar ventilacion'],
                      acciones_quimicas: ['Aplicar fungicida recomendado', 'Seguir etiqueta'],
                      recomendaciones: ['Monitorear semanalmente', 'Evitar exceso de riego'],
                      referencias_rag: ['Ficha de roya en maiz'],
                    },
                  }),
                },
              ],
            },
          },
        ],
      };

      callGeminiApi.mockResolvedValueOnce(observationResponse).mockResolvedValueOnce(diagnosisResponse);

      const result = await runDiagnosis({
        userId: 'user-1',
        cultivoName: 'Maiz',
        notes: 'Yellow spots',
        imageBuffer: Buffer.from('fake-image-data'),
        mimeType: 'image/jpeg',
      });

      expect(result.success).toBe(true);
      expect(result.diagnosis).toBeTruthy();
      expect(result.remainingCredits).toBe(9);
      expect(result.ragUsage).toBeTruthy();
      expect(result.scores.final).toBeGreaterThan(0.7);
    });

    it('should return needsBetterPhoto if observation rejects image', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      const observationResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    cultivo_detectado: 'Otro',
                    cultivo_confianza: 50,
                    coincide_cultivo: false,
                    sintomas: [],
                    hallazgos_visuales: [],
                    descripcion_visual: '',
                    calidad_imagen: { nitidez: 'baja', cobertura: 'baja', notas: '' },
                    riesgos_visibles: [],
                    diagnosis_title_prelim: 'desconocido',
                    vision_confidence: 20,
                  }),
                },
              ],
            },
          },
        ],
      };

      callGeminiApi.mockResolvedValueOnce(observationResponse);

      const result = await runDiagnosis({
        userId: 'user-1',
        cultivoName: 'Maiz',
        imageBuffer: Buffer.from('fake-image-data'),
      });

      expect(result.needsBetterPhoto).toBe(true);
      expect(result.message.toLowerCase()).toContain('foto');
    });
  });
});
