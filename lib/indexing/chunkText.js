const DEFAULT_CHUNK_CONFIG = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '],
};

function splitRecursively(text, { chunkSize, separators }) {
  if (text.length <= chunkSize) return [text];

  for (const separator of separators) {
    const parts = text.split(separator);
    if (parts.length === 1) continue;

    const merged = [];
    let current = '';
    for (const part of parts) {
      const candidate = current ? current + separator + part : part;
      if (candidate.length > chunkSize) {
        if (current) merged.push(current);
        current = part;
      } else {
        current = candidate;
      }
    }
    if (current) merged.push(current);

    if (merged.every(p => p.length <= chunkSize)) return merged;
    return merged.flatMap(p => splitRecursively(p, { chunkSize, separators }));
  }

  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export function chunkText(rawText, config = {}) {
  const { chunkSize, chunkOverlap, separators } = { ...DEFAULT_CHUNK_CONFIG, ...config };
  const text = (rawText ?? '').trim();
  if (!text) return [];

  const baseChunks = splitRecursively(text, { chunkSize, separators })
    .map(chunk => chunk.trim())
    .filter(Boolean);

  if (chunkOverlap <= 0) return baseChunks;

  const overlapped = [];
  for (let i = 0; i < baseChunks.length; i += 1) {
    const chunk = baseChunks[i];
    if (i === 0) {
      overlapped.push(chunk);
      continue;
    }

    const prev = overlapped[overlapped.length - 1] || '';
    const overlap = prev.slice(Math.max(0, prev.length - chunkOverlap));
    overlapped.push((overlap + chunk).trim());
  }

  return overlapped.filter(Boolean);
}

