import crypto from 'node:crypto';
import { extractText } from '@/lib/textExtractor';
import { chunkText } from './chunkText';

export function sanitizeFilename(name) {
  return (name || 'documento')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function normalizeExtractedText(text) {
  return (
    (text || '')
      .replace(/\r\n/g, '\n')
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

export async function extractAndChunkDocument({ buffer, mimeType, chunkConfig }) {
  const extracted = await extractText(buffer, mimeType);
  const cleaned = normalizeExtractedText(extracted);
  const chunks = chunkText(cleaned, chunkConfig);

  return {
    textChars: cleaned.length,
    totalChunks: chunks.length,
    chunks,
  };
}

export function buildChunkRecords({ documentId, originalName, mimeType, totalChunks, chunkOffset, chunkTexts, embeddings }) {
  return chunkTexts.map((content, index) => ({
    document_id: documentId,
    chunk_index: chunkOffset + index,
    content,
    embedding: embeddings[index],
    metadata: {
      originalName,
      mimeType,
      chunkIndex: chunkOffset + index,
      totalChunks,
    },
  }));
}
