// Script para ejecutar la configuración de trazabilidad RAG
async function setupRagTraceability() {
  try {
    console.log('🚀 Configurando trazabilidad RAG...');
    
    const response = await fetch('http://localhost:3000/api/setup-rag-traceability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Trazabilidad RAG configurada exitosamente!');
      console.log('📊 Detalles:', result.details);
    } else {
      console.error('❌ Error:', result.error);
    }
  } catch (error) {
    console.error('💥 Error de conexión:', error.message);
    console.log('\n💡 Asegúrate de que el servidor esté ejecutándose:');
    console.log('   npm run dev');
  }
}

setupRagTraceability();