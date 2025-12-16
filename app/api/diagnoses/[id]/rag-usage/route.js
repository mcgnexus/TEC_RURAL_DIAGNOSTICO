import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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

export async function GET(request, { params }) {
  try {
    const supabaseAuth = createSupabaseAuthClient();
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID de diagnóstico requerido' }, { status: 400 });
    }

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Obtener información básica del diagnóstico primero
    const { data: diagnosis, error: diagnosisError } = await supabaseAuth
      .from('diagnoses')
      .select('id, user_id, cultivo_name, ai_diagnosis_md, confidence_score, created_at')
      .eq('id', id)
      .single();

    if (diagnosisError) {
      console.error('Error obteniendo diagnóstico:', diagnosisError);
      return NextResponse.json({ error: 'Diagnóstico no encontrado' }, { status: 404 });
    }

    // Verificar que el usuario sea el propietario del diagnóstico
    if (diagnosis.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado para ver este diagnóstico' }, { status: 403 });
    }

    // Obtener fuentes RAG usando la función SQL híbrida (V1/V2)
    const { data: ragSourcesData, error: ragError } = await supabaseAuth.rpc(
      'get_diagnosis_rag_sources',
      { diagnosis_uuid: id }
    );

    if (ragError) {
      console.error('Error obteniendo fuentes RAG:', ragError);
      // No es un error fatal, simplemente no hay fuentes RAG
    }

    // Procesar y formatear la información RAG
    const ragSources = (ragSourcesData || []).map((source, index) => {
      const content = source.content || '';
      return {
        rank: index + 1,
        similarityScore: source.similarity_score,
        similarityPercentage: (source.similarity_score * 100).toFixed(1),
        chunkIndex: source.chunk_index,
        chunkId: source.chunk_id,
        documentId: source.document_id,
        content,
        filename: source.filename || 'Documento sin nombre',
        contentPreview:
          content.substring(0, 300) + (content.length > 300 ? '...' : ''),
      };
    });

    // Obtener estadísticas generales
    const stats = {
      totalSources: ragSources.length,
      avgSimilarity: ragSources.length > 0 
        ? (ragSources.reduce((sum, s) => sum + s.similarityScore, 0) / ragSources.length * 100).toFixed(1)
        : '0.0',
      maxSimilarity: ragSources.length > 0 
        ? (Math.max(...ragSources.map(s => s.similarityScore)) * 100).toFixed(1)
        : '0.0',
      minSimilarity: ragSources.length > 0 
        ? (Math.min(...ragSources.map(s => s.similarityScore)) * 100).toFixed(1)
        : '0.0',
    };

    // Obtener documentos únicos utilizados
    const uniqueDocuments = [...new Set(ragSources.map(s => s.documentId))];

    return NextResponse.json({
      success: true,
      diagnosis: {
        id: diagnosis.id,
        cultivoName: diagnosis.cultivo_name,
        confidenceScore: diagnosis.confidence_score,
        createdAt: diagnosis.created_at,
      },
      ragUsage: {
        enabled: ragSources.length > 0,
        stats,
        sources: ragSources,
        documentsUsed: uniqueDocuments.length,
        documentIds: uniqueDocuments,
      },
      message: ragSources.length > 0 
        ? `Se utilizaron ${ragSources.length} fragmentos de conocimiento de ${uniqueDocuments.length} documento(s)`
        : 'No se utilizó conocimiento del RAG para este diagnóstico',
    });

  } catch (error) {
    console.error('Error en API RAG traceability:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
