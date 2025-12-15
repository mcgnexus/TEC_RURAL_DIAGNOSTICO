import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateEmbeddingsBatch } from '@/lib/embeddingService';
import { buildChunkRecords, extractAndChunkDocument } from '@/lib/indexing/indexingPipeline';

async function downloadFromStorage(bucket, path) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error) throw new Error(error.message);

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function processIngestionDocument({ documentId, chunkConfig }) {
  const { data: doc, error: docError } = await supabaseAdmin
    .from('ingestion_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (docError) {
    throw new Error(docError.message);
  }

  const buffer = await downloadFromStorage(doc.storage_bucket, doc.storage_path);

  const chunkSize = Number(chunkConfig?.chunkSize ?? process.env.INGESTION_CHUNK_SIZE ?? 1000);
  const chunkOverlap = Number(chunkConfig?.chunkOverlap ?? process.env.INGESTION_CHUNK_OVERLAP ?? 200);
  const safeChunkSize = Number.isFinite(chunkSize) ? Math.max(1, chunkSize) : 1000;
  const safeChunkOverlap = Number.isFinite(chunkOverlap)
    ? Math.max(0, Math.min(chunkOverlap, safeChunkSize - 1))
    : 200;

  const { chunks, totalChunks, textChars } = await extractAndChunkDocument({
    buffer,
    mimeType: doc.mime_type,
    chunkConfig: { chunkSize: safeChunkSize, chunkOverlap: safeChunkOverlap },
  });

  await supabaseAdmin
    .from('ingestion_documents')
    .update({ total_chunks: totalChunks, text_chars: textChars })
    .eq('id', documentId);

  await supabaseAdmin.from('ingestion_chunks').delete().eq('document_id', documentId);

  const embedBatchSize = Number(process.env.MISTRAL_EMBED_BATCH_SIZE ?? 10);
  const insertBatchSize = Number(process.env.INGESTION_INSERT_BATCH_SIZE ?? 50);
  let processed = 0;

  for (let i = 0; i < chunks.length; i += insertBatchSize) {
    const chunkTexts = chunks.slice(i, i + insertBatchSize);
    const embeddings = await generateEmbeddingsBatch(chunkTexts, embedBatchSize);
    const batch = buildChunkRecords({
      documentId,
      originalName: doc.original_name,
      mimeType: doc.mime_type,
      totalChunks,
      chunkOffset: i,
      chunkTexts,
      embeddings,
    });

    const { error: insertError } = await supabaseAdmin.from('ingestion_chunks').insert(batch);
    if (insertError) {
      throw new Error(insertError.message);
    }

    processed += batch.length;
    await supabaseAdmin.from('ingestion_documents').update({ processed_chunks: processed }).eq('id', documentId);
  }

  const { data: updatedDoc, error: updateError } = await supabaseAdmin
    .from('ingestion_documents')
    .update({ status: 'ready', error_message: null, finished_at: new Date().toISOString() })
    .eq('id', documentId)
    .select('*')
    .single();

  if (updateError) throw new Error(updateError.message);

  return updatedDoc;
}
