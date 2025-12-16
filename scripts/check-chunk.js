import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkChunk() {
  const chunkId = '3c4aaaed-9bc7-4f0a-9b9c-a946f89f2a9f';
  console.log(`🔍 Buscando chunk ID: ${chunkId}`);

  const { data, error } = await supabase
    .from('ingestion_chunks')
    .select('id, content')
    .eq('id', chunkId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Chunk encontrado:', data);
  }
}

checkChunk();