import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGeminiApi, getGeminiKeyCandidates } from '../../lib/gemini';

describe('gemini lib', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Reset environment variables for each test
    process.env.GEMINI_API_KEY = 'test-key-1';
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getGeminiKeyCandidates should return available keys from env', () => {
    process.env.GEMINI_API_KEY = 'key1';
    process.env.GOOGLE_API_KEY = 'key2';
    
    const candidates = getGeminiKeyCandidates();
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({ name: 'GEMINI_API_KEY', key: 'key1' });
    expect(candidates[1]).toEqual({ name: 'GOOGLE_API_KEY', key: 'key2' });
  });

  it('callGeminiApi should return data on success', async () => {
    const mockResponse = { candidates: [{ content: { parts: [{ text: 'Respuesta' }] } }] };
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await callGeminiApi({ prompt: 'test' });
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-3-flash-preview'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'test-key-1' }),
      })
    );
  });

  it('callGeminiApi should throw error on API failure', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Invalid request',
    });

    await expect(callGeminiApi({ prompt: 'test' })).rejects.toThrow('Gemini API error: 400 - Invalid request');
  });

  it('callGeminiApi should fallback to second key if first one is invalid', async () => {
    process.env.GEMINI_API_KEY = 'invalid-key';
    process.env.GOOGLE_API_KEY = 'valid-key';

    // First call fails with invalid key error
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'API key not valid',
    });

    // Second call succeeds
    const mockResponse = { success: true };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await callGeminiApi({ prompt: 'test' });
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ 'x-goog-api-key': 'valid-key' })
    }));
  });
});
