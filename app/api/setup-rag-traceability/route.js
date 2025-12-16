import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    console.log('🚀 Ejecutando trazabilidad RAG...');

    // Ejecutar cada parte del SQL
    const sqlParts = [
      // Parte 1: Crear tabla e índices
      `
        CREATE TABLE IF NOT EXISTS public.diagnosis_rag_sources (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
          chunk_id UUID REFERENCES public.ingestion_chunks(id) ON DELETE CASCADE NOT NULL,
          similarity_score FLOAT NOT NULL,
          chunk_index INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_diagnosis_id ON public.diagnosis_rag_sources(diagnosis_id);
        CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_chunk_id ON public.diagnosis_rag_sources(chunk_id);
        CREATE INDEX IF NOT EXISTS idx_diagnosis_rag_sources_similarity ON public.diagnosis_rag_sources(similarity_score DESC);
      `,
      // Parte 2: Función para obtener fuentes RAG
      `
        CREATE OR REPLACE FUNCTION public.get_diagnosis_rag_sources(diagnosis_uuid UUID)
        RETURNS TABLE (
          chunk_id UUID,
          similarity_score FLOAT,
          chunk_index INTEGER,
          content TEXT,
          filename TEXT,
          document_id UUID
        ) AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            ic.id as chunk_id,
            drs.similarity_score,
            drs.chunk_index,
            ic.content,
            ic.metadata->>'filename' as filename,
            ic.document_id
          FROM public.diagnosis_rag_sources drs
          JOIN public.ingestion_chunks ic ON drs.chunk_id = ic.id
          WHERE drs.diagnosis_id = diagnosis_uuid
          ORDER BY drs.similarity_score DESC;
        END;
        $$ LANGUAGE plpgsql;
      `,
      // Parte 3: Función para estadísticas
      `
        CREATE OR REPLACE FUNCTION public.get_user_rag_stats(user_uuid UUID)
        RETURNS TABLE (
          total_diagnoses BIGINT,
          diagnoses_with_rag BIGINT,
          avg_rag_sources_per_diagnosis FLOAT,
          avg_similarity_score FLOAT,
          top_documents JSONB
        ) AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            COUNT(DISTINCT d.id) as total_diagnoses,
            COUNT(DISTINCT CASE WHEN drs.chunk_id IS NOT NULL THEN d.id END) as diagnoses_with_rag,
            COALESCE(AVG(DISTINCT rag_counts.chunk_count), 0) as avg_rag_sources_per_diagnosis,
            COALESCE(AVG(drs.similarity_score), 0) as avg_similarity_score,
            (
              SELECT jsonb_agg(doc_info)
              FROM (
                SELECT jsonb_build_object(
                  'document_id', ic.document_id,
                  'filename', ic.metadata->>'filename',
                  'usage_count', COUNT(*),
                  'avg_similarity', AVG(drs.similarity_score)
                ) as doc_info
                FROM public.diagnosis_rag_sources drs2
                JOIN public.ingestion_chunks ic ON drs2.chunk_id = ic.id
                JOIN public.diagnoses d2 ON drs2.diagnosis_id = d2.id
                WHERE d2.user_id = user_uuid
                GROUP BY ic.document_id, ic.metadata->>'filename'
                ORDER BY COUNT(*) DESC
                LIMIT 5
              ) top_docs
            ) as top_documents
          FROM public.diagnoses d
          LEFT JOIN public.diagnosis_rag_sources drs ON d.id = drs.diagnosis_id
          LEFT JOIN (
            SELECT diagnosis_id, COUNT(*) as chunk_count
            FROM public.diagnosis_rag_sources
            GROUP BY diagnosis_id
          ) rag_counts ON d.id = rag_counts.diagnosis_id
          WHERE d.user_id = user_uuid;
        END;
        $$ LANGUAGE plpgsql;
      `,
      // Parte 4: Políticas RLS
      `
        ALTER TABLE public.diagnosis_rag_sources ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view their own diagnosis RAG sources" ON public.diagnosis_rag_sources
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM public.diagnoses d
            WHERE d.id = diagnosis_rag_sources.diagnosis_id
            AND d.user_id = auth.uid()
          )
        );

        CREATE POLICY "Users can insert into their own diagnosis RAG sources" ON public.diagnosis_rag_sources
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.diagnoses d
            WHERE d.id = diagnosis_rag_sources.diagnosis_id
            AND d.user_id = auth.uid()
          )
        );

        CREATE POLICY "Users can update their own diagnosis RAG sources" ON public.diagnosis_rag_sources
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM public.diagnoses d
            WHERE d.id = diagnosis_rag_sources.diagnosis_id
            AND d.user_id = auth.uid()
          )
        );

        CREATE POLICY "Users can delete their own diagnosis RAG sources" ON public.diagnosis_rag_sources
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM public.diagnoses d
            WHERE d.id = diagnosis_rag_sources.diagnosis_id
            AND d.user_id = auth.uid()
          )
        );
      `
    ];

    for (let i = 0; i < sqlParts.length; i++) {
      console.log(`🔧 Ejecutando parte ${i + 1}/${sqlParts.length}...`);
      
      try {
        // Ejecutar usando RPC directo
        const { error } = await supabase.rpc('exec_sql', { 
          sql: sqlParts[i] 
        });
        
        if (error) {
          console.error(`❌ Error en parte ${i + 1}:`, error.message);
          throw error;
        }
        
        console.log(`✅ Parte ${i + 1} ejecutada correctamente`);
      } catch (error) {
        console.error(`💥 Error ejecutando parte ${i + 1}:`, error.message);
        return NextResponse.json({ 
          error: `Error en parte ${i + 1}: ${error.message}` 
        }, { status: 500 });
      }
    }

    console.log('🎉 ¡Script ejecutado exitosamente!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Trazabilidad RAG implementada correctamente',
      details: {
        tableCreated: true,
        functionsCreated: true,
        policiesCreated: true,
        indexesCreated: true
      }
    });
    
  } catch (error) {
    console.error('💥 Error general:', error.message);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}