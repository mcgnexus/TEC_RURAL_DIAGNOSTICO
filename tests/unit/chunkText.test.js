import { describe, it, expect } from 'vitest';
import { chunkText } from '../../lib/indexing/chunkText';

describe('chunkText', () => {
  it('should return an empty array for empty input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText(null)).toEqual([]);
    expect(chunkText(undefined)).toEqual([]);
  });

  it('should not split text smaller than chunkSize', () => {
    const text = 'Hello world';
    const chunks = chunkText(text, { chunkSize: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('should split text larger than chunkSize', () => {
    const text = 'A'.repeat(1500);
    const chunks = chunkText(text, { chunkSize: 1000, chunkOverlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(1000);
  });

  it('should handle overlap correctly', () => {
    const text = 'Parte uno. Parte dos. Parte tres.';
    const chunkSize = 15;
    const chunkOverlap = 5;
    const chunks = chunkText(text, { chunkSize, chunkOverlap });
    
    expect(chunks.length).toBeGreaterThan(1);
    // Verificar que el segundo chunk contenga el final del primero
    const firstEnd = chunks[0].slice(-chunkOverlap);
    expect(chunks[1].startsWith(firstEnd)).toBe(true);
  });

  it('should use separators to split text', () => {
    const text = 'Frase 1. Frase 2. Frase 3.';
    const chunks = chunkText(text, { chunkSize: 10, separators: ['. '], chunkOverlap: 0 });
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe('Frase 1');
    expect(chunks[1]).toBe('Frase 2');
    expect(chunks[2]).toBe('Frase 3.');
  });
});
