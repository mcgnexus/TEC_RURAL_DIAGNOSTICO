import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDiagnosis, findProfileByPhone, ensureEnv } from '../../lib/diagnosisEngine';
import * as embeddingService from '../../lib/embeddingService';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockImplementation(() => ({
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (resolve) => resolve({ data: null, error: null }),
  })),
  single: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  rpc: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
  storage: {
    from: vi.fn().mockReturnThis(),
    upload: vi.fn().mockImplementation(() => Promise.resolve({ data: { path: 'test.jpg' }, error: null })),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock embedding service
vi.mock('../../lib/embeddingService', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

// Mock fetch
global.fetch = vi.fn();

describe('diagnosisEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mockSupabase properties to default behavior
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.eq.mockImplementation(() => ({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve) => resolve({ data: null, error: null }),
    }));
    mockSupabase.single.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    mockSupabase.maybeSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    mockSupabase.rpc.mockImplementation(() => Promise.resolve({ data: [], error: null }));
    mockSupabase.storage.from.mockReturnThis();
    mockSupabase.storage.upload.mockImplementation(() => Promise.resolve({ data: { path: 'test.jpg' }, error: null }));

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.NEXT_PUBLIC_DIAGNOSE_DEBUG = '1';
    process.env.DIAGNOSE_DEBUG = '1';
    
    // Mock crypto.randomUUID
    if (typeof global.crypto === 'undefined') {
      global.crypto = { randomUUID: () => 'test-uuid' };
    } else if (typeof global.crypto.randomUUID === 'undefined') {
      global.crypto.randomUUID = () => 'test-uuid';
    }
  });

  describe('findProfileByPhone', () => {
    it('should return profile data for a valid phone number', async () => {
      const mockProfile = { id: 'user-1', credits_remaining: 5, phone: '+123456789' };
      mockSupabase.eq.mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null })
      });

      const result = await findProfileByPhone('123456789');
      expect(result.data).toEqual(mockProfile);
      expect(result.error).toBeNull();
    });

    it('should return null if profile not found', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      });

      const result = await findProfileByPhone('123456789');
      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('runDiagnosis', () => {
    it('should fail if userId is missing', async () => {
      const result = await runDiagnosis({ cultivoName: 'Maiz', imageBuffer: Buffer.from('test') });
      expect(result.error).toBe('El usuario es obligatorio.');
    });

    it('should fail if credits are 0', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: { credits_remaining: 0 }, error: null });
      mockSupabase.eq.mockReturnValueOnce({
        single: mockSingle
      });

      const result = await runDiagnosis({ userId: 'user-1', cultivoName: 'Maiz', imageBuffer: Buffer.from('test') });
      
      console.log('Result for credits 0:', result);
      
      expect(result.error).toContain('No tienes créditos disponibles');
      expect(result.statusCode).toBe(402);
    });

    it('should handle successful diagnosis flow', async () => {
      // Mock profile check (first eq().single())
      mockSupabase.eq.mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({ data: { credits_remaining: 10 }, error: null })
      });

      // Mock RAG matches
      mockSupabase.rpc.mockResolvedValueOnce({ 
        data: [{ id: 1, content: 'Symptom description', metadata: { filename: 'guide.pdf' }, similarity: 0.8 }], 
        error: null 
      });

      // Mock Gemini API call for diagnosis
      const mockGeminiResponse = {
        candidates: [{
          content: {
            parts: [{
              text: '```json\n{"diagnosis_title": "Roya", "confidence_score": 90, "is_conclusive": true, "urgency_level": "Alta", "recommendations": ["Apply fungicide"]}\n```\nDetailed diagnosis markdown here.'
            }]
          }
        }]
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeminiResponse
      });

      // Mock Gemini API call for verification (RAG)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: '{"is_match": true, "confidence": 0.9, "reasoning": "Symptoms match exactly"}'
              }]
            }
          }]
        })
      });

      // Mock diagnosis insert
      const mockInsertedDiagnosis = { id: 'diag-1', cultivo_name: 'Maiz', status: 'pending' };
      mockSupabase.single.mockResolvedValueOnce({ 
        data: mockInsertedDiagnosis, 
        error: null 
      });

      // Mock credit update (second eq())
      mockSupabase.eq.mockReturnValueOnce({
        then: (resolve) => resolve({ error: null })
      });

      const result = await runDiagnosis({
        userId: 'user-1',
        cultivoName: 'Maiz',
        notes: 'Yellow spots',
        imageBuffer: Buffer.from('fake-image-data'),
        mimeType: 'image/jpeg'
      });

      expect(result.success).toBe(true);
      expect(result.diagnosis).toEqual(mockInsertedDiagnosis);
      expect(result.remainingCredits).toBe(9);
      expect(result.recommendations).toContain('Apply fungicide');
    });

    it('should return needsBetterPhoto if confidence is low', async () => {
      mockSupabase.eq.mockReturnValueOnce({
        single: vi.fn().mockResolvedValue({ data: { credits_remaining: 10 }, error: null })
      });
      mockSupabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      const mockGeminiResponse = {
        candidates: [{
          content: {
            parts: [{
              text: '```json\n{"diagnosis_title": "Unknown", "confidence_score": 0.3, "is_conclusive": false}\n```'
            }]
          }
        }]
      };
      global.fetch.mockResolvedValueOnce({ ok: true, json: async () => mockGeminiResponse });

      const result = await runDiagnosis({
        userId: 'user-1',
        cultivoName: 'Maiz',
        imageBuffer: Buffer.from('fake-image-data'),
      });

      expect(result.needsBetterPhoto).toBe(true);
      expect(result.message).toContain('imagen no fue concluyente');
    });
  });
});
