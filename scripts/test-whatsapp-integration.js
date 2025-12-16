/**
 * Script de Diagnóstico: Integración WhatsApp
 *
 * Ejecutar: node scripts/test-whatsapp-integration.js
 *
 * Verifica:
 * 1. Variables de entorno
 * 2. Conexión con Whapi
 * 3. Conexión con Supabase
 * 4. Existencia de tabla whatsapp_sessions
 */

require('dotenv').config({ path: '.env.local' });

const REQUIRED_ENV_VARS = [
  'WHAPI_TOKEN',
  'WHAPI_API_URL',
  'WHAPI_BUSINESS_NUMBER',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
];

const OPTIONAL_ENV_VARS = [
  'NEXT_PUBLIC_API_BASE_URL',
];

console.log('🔍 Iniciando diagnóstico de integración WhatsApp...\n');

// 1. Verificar variables de entorno
console.log('1️⃣  Verificando variables de entorno...');
let missingVars = [];
let warnings = [];

REQUIRED_ENV_VARS.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    console.log(`   ❌ ${varName} - NO CONFIGURADA`);
  } else {
    // Mostrar solo los primeros caracteres para seguridad
    const value = process.env[varName];
    const preview = value.length > 20 ? value.substring(0, 20) + '...' : value;
    console.log(`   ✅ ${varName} - ${preview}`);
  }
});

OPTIONAL_ENV_VARS.forEach(varName => {
  if (!process.env[varName]) {
    warnings.push(`${varName} no configurada (opcional pero recomendada)`);
    console.log(`   ⚠️  ${varName} - NO CONFIGURADA (opcional)`);
  } else {
    console.log(`   ✅ ${varName} - ${process.env[varName]}`);
  }
});

if (missingVars.length > 0) {
  console.log('\n❌ Variables faltantes:', missingVars.join(', '));
  console.log('   Agrega estas variables a .env.local y/o Vercel\n');
  process.exit(1);
}

console.log('   ✅ Todas las variables requeridas están configuradas\n');

// 2. Verificar conexión con Whapi
console.log('2️⃣  Verificando conexión con Whapi...');
(async () => {
  try {
    const response = await fetch(`${process.env.WHAPI_API_URL}/health`, {
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Conexión con Whapi exitosa:', data);
    } else {
      console.log(`   ❌ Error en Whapi: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log('      Respuesta:', text);
    }
  } catch (error) {
    console.log('   ❌ No se pudo conectar con Whapi:', error.message);
  }

  // 3. Verificar conexión con Supabase
  console.log('\n3️⃣  Verificando conexión con Supabase...');
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verificar conexión
    const { data, error } = await supabase.from('profiles').select('count').limit(1);

    if (error) {
      console.log('   ❌ Error conectando con Supabase:', error.message);
    } else {
      console.log('   ✅ Conexión con Supabase exitosa');
    }

    // 4. Verificar tabla whatsapp_sessions
    console.log('\n4️⃣  Verificando tabla whatsapp_sessions...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .limit(1);

    if (sessionsError) {
      if (sessionsError.message.includes('does not exist')) {
        console.log('   ❌ La tabla whatsapp_sessions NO EXISTE');
        console.log('      Ejecuta el script SQL: supabase/whatsapp_sessions.sql');
      } else {
        console.log('   ❌ Error accediendo a whatsapp_sessions:', sessionsError.message);
      }
    } else {
      console.log('   ✅ Tabla whatsapp_sessions existe y es accesible');
    }

    // 5. Verificar función RPC cleanup_expired_whatsapp_sessions
    console.log('\n5️⃣  Verificando función RPC cleanup_expired_whatsapp_sessions...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('cleanup_expired_whatsapp_sessions');

    if (rpcError) {
      console.log('   ❌ Función RPC no encontrada:', rpcError.message);
      console.log('      Ejecuta el script SQL: supabase/whatsapp_sessions.sql');
    } else {
      console.log(`   ✅ Función RPC existe y funciona (limpió ${rpcData} sesiones)`);
    }

    // 6. Verificar perfiles con teléfono
    console.log('\n6️⃣  Verificando perfiles con teléfono...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, phone, credits_remaining')
      .not('phone', 'is', null);

    if (profilesError) {
      console.log('   ❌ Error consultando perfiles:', profilesError.message);
    } else if (profiles.length === 0) {
      console.log('   ⚠️  No hay perfiles con teléfono registrado');
      console.log('      Ejecuta: UPDATE profiles SET phone = \'+34XXXXXXXXX\' WHERE email = \'tu_email\';');
    } else {
      console.log(`   ✅ ${profiles.length} perfil(es) con teléfono registrado:`);
      profiles.forEach(p => {
        console.log(`      - ${p.email}: ${p.phone} (${p.credits_remaining} créditos)`);
      });
    }

    // 7. Verificar campo notes en diagnoses
    console.log('\n7️⃣  Verificando campo notes en tabla diagnoses...');
    const { data: diagnosesCheck, error: diagnosesError } = await supabase
      .from('diagnoses')
      .select('notes')
      .limit(1);

    if (diagnosesError) {
      if (diagnosesError.message.includes('column "notes" does not exist')) {
        console.log('   ❌ Campo notes NO EXISTE en tabla diagnoses');
        console.log('      Ejecuta el script SQL: supabase/whatsapp_sessions.sql');
      } else {
        console.log('   ⚠️  Error verificando campo notes:', diagnosesError.message);
      }
    } else {
      console.log('   ✅ Campo notes existe en tabla diagnoses');
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DEL DIAGNÓSTICO');
    console.log('='.repeat(60));

    if (warnings.length > 0) {
      console.log('\n⚠️  Advertencias:');
      warnings.forEach(w => console.log(`   - ${w}`));
    }

    console.log('\n✅ Siguiente paso: Configurar webhook en Whapi');
    console.log('   URL: https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp');
    console.log('   Events: messages.post');
    console.log('\n✅ Probar enviando mensaje: /ayuda');

  } catch (error) {
    console.log('\n❌ Error inesperado:', error.message);
    console.log(error.stack);
  }
})();
