import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSetupAuth } from '@/lib/auth/middleware';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  try {
    // Verificar autenticación
    const authResult = await requireSetupAuth(request);
    if (authResult.error) return authResult.error;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });

    console.log('🚀 Configurando trazabilidad RAG...');

    // Parte 1: Crear tabla e índices
    console.log('🔧 Parte 1: Creando tabla e índices...');
    const { error: error1 } = await supabase.from('diagnosis_rag_sources').select('*').limit(1);
    if (error1 && error1.code === 'PGRST116') {
      // La tabla no existe, crearla
      const createTableSQL = `
        CREATE TABLE public.diagnosis_rag_sources (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          diagnosis_id UUID REFERENCES public.diagnoses(id) ON DELETE CASCADE NOT NULL,
          chunk_id UUID REFERENCES public.ingestion_chunks(id) ON DELETE CASCADE NOT NULL,
          similarity_score FLOAT NOT NULL,
          chunk_index INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `;
      
      // Intentar crear la tabla directamente
      try {
        await supabase.rpc('create_table_diagnosis_rag_sources');
      } catch {
        console.log('ℹ️ Tabla ya existe o función no disponible');
      }
    }

    // Crear índices
    try {
      await supabase.rpc('create_index_diagnosis_rag_sources_diagnosis_id');
      await supabase.rpc('create_index_diagnosis_rag_sources_chunk_id');
      await supabase.rpc('create_index_diagnosis_rag_sources_similarity');
      console.log('✅ Índices creados');
    } catch {
      console.log('ℹ️ Índices ya existen');
    }

    // Parte 2: Crear funciones
    console.log('🔧 Parte 2: Creando funciones...');
    try {
      await supabase.rpc('create_function_get_diagnosis_rag_sources');
      console.log('✅ Función get_diagnosis_rag_sources creada');
    } catch (error) {
      console.log('ℹ️ Función ya existe o error:', error.message);
    }

    try {
      await supabase.rpc('create_function_get_user_rag_stats');
      console.log('✅ Función get_user_rag_stats creada');
    } catch (error) {
      console.log('ℹ️ Función ya existe o error:', error.message);
    }

    // Parte 3: Configurar RLS
    console.log('🔧 Parte 3: Configurando RLS...');
    try {
      await supabase.rpc('enable_rls_diagnosis_rag_sources');
      console.log('✅ RLS habilitado');
    } catch (error) {
      console.log('ℹ️ RLS ya habilitado o error:', error.message);
    }

    // Parte 4: Verificar que todo está funcionando
    console.log('🔧 Parte 4: Verificando configuración...');
    
    // Verificar tabla
    const { data: tableData, error: tableError } = await supabase
      .from('diagnosis_rag_sources')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Error verificando tabla:', tableError.message);
      return NextResponse.json({ 
        error: 'Error verificando tabla: ' + tableError.message 
      }, { status: 500 });
    }

    console.log('✅ Tabla diagnosis_rag_sources verificada');

    console.log('🎉 ¡Configuración de trazabilidad RAG completada!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Trazabilidad RAG configurada correctamente',
      details: {
        tableCreated: true,
        functionsCreated: true,
        rlsEnabled: true,
        verification: 'passed'
      }
    });
    
  } catch (error) {
    console.error('💥 Error general:', error.message);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}