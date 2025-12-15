import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sanitizeFilename, sha256 } from '@/lib/indexing/indexingPipeline';

export const runtime = 'nodejs';

const createSupabaseAuthClient = () => {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) {
    throw new Error('Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });
};

async function requireAdmin() {
  const supabaseAuth = createSupabaseAuthClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'No autorizado.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { error: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo administradores.' }, { status: 403 }) };
  }

  return { user };
}

export async function POST(request) {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const formData = await request.formData();
    const files = formData.getAll('files').filter(f => f && typeof f !== 'string');

    if (!files.length) {
      return NextResponse.json({ error: 'Debes enviar al menos un archivo en el campo files.' }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_INGESTION_BUCKET || 'ingestion-documents';
    const maxBytes = Number(process.env.INGESTION_MAX_BYTES ?? 10 * 1024 * 1024);
    const allowedTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]);
    const created = [];
    const failed = [];

    for (const file of files) {
      const safeName = sanitizeFilename(file.name);
      const mimeType = file.type || 'application/octet-stream';
      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = sha256(buffer);

      if (!allowedTypes.has(mimeType)) {
        failed.push({ name: safeName, error: `Tipo de archivo no soportado: ${mimeType}` });
        continue;
      }

      if (buffer.length > maxBytes) {
        failed.push({ name: safeName, error: `Archivo supera el limite de ${maxBytes} bytes.` });
        continue;
      }

      const { data: doc, error: insertError } = await supabaseAdmin
        .from('ingestion_documents')
        .insert({
          created_by: user.id,
          original_name: safeName,
          mime_type: mimeType,
          size_bytes: buffer.length,
          checksum,
          storage_bucket: bucket,
          storage_path: `uploads/${user.id}/${Date.now()}-${checksum}-${safeName}`,
          status: 'pending',
        })
        .select('*')
        .single();

      if (insertError) {
        failed.push({ name: safeName, error: insertError.message });
        continue;
      }

      const uploadResult = await supabaseAdmin.storage
        .from(bucket)
        .upload(doc.storage_path, buffer, { contentType: mimeType, upsert: false });

      if (uploadResult.error) {
        await supabaseAdmin
          .from('ingestion_documents')
          .update({ status: 'failed', error_message: uploadResult.error.message })
          .eq('id', doc.id);

        failed.push({ id: doc.id, name: safeName, error: uploadResult.error.message });
        continue;
      }

      created.push(doc);
    }

    return NextResponse.json({ created, failed }, { status: failed.length ? 207 : 200 });
  } catch (error) {
    console.error('Indexing upload error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Error inesperado.',
        hint: 'Asegurate de crear el bucket de Storage "ingestion-documents" (o SUPABASE_INGESTION_BUCKET).',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST /api/indexing/upload con FormData(files[]=...).',
  });
}
