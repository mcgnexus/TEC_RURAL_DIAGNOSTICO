#!/usr/bin/env node

/**
 * Script simple para verificar la configuración de WhatsApp
 * sin depender de imports complejos
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testWhatsAppConfig() {
  console.log('🔍 Verificación simple de configuración WhatsApp...\n');

  // 1. Verificar variables de entorno
  console.log('1️⃣ Variables de entorno:');
  const requiredVars = [
    'WHAPI_TOKEN',
    'WHAPI_API_URL', 
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY'
  ];

  let allConfigured = true;
  for (const varName of requiredVars) {
    const value = process.env[varName];
    const configured = !!value;
    const masked = value ? `${value.substring(0, 8)}...` : '❌';
    console.log(`   ${configured ? '✅' : '❌'} ${varName}: ${masked}`);
    if (!configured) allConfigured = false;
  }

  if (!allConfigured) {
    console.log('\n❌ Faltan variables de entorno críticas');
    return;
  }

  // 2. Probar conexión con Whapi
  console.log('\n2️⃣ Conexión con Whapi:');
  try {
    const response = await fetch(`${process.env.WHAPI_API_URL}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Conexión exitosa');
      console.log(`   📱 Status: ${data.status?.text || 'Unknown'}`);
      console.log(`   👤 User: ${data.user?.name || 'Unknown'}`);
      console.log(`   📊 Uptime: ${data.uptime || 0} segundos`);
    } else {
      console.log(`   ❌ Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text().catch(() => 'No se pudo leer el error');
      console.log(`   📄 Detalles: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Error de conexión: ${error.message}`);
  }

  // 3. Verificar endpoint del webhook
  console.log('\n3️⃣ Endpoint del webhook:');
  try {
    const webhookUrl = 'https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp';
    const response = await fetch(webhookUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Webhook responde: ${data.status}`);
      
      if (data.checks) {
        console.log('   🔍 Checks:');
        for (const [key, value] of Object.entries(data.checks)) {
          console.log(`      ${value ? '✅' : '❌'} ${key}`);
        }
      }
    } else {
      console.log(`   ❌ Error webhook: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.log(`   ❌ Error webhook: ${error.message}`);
  }

  // 4. Probar descarga de imagen (con URL de prueba)
  console.log('\n4️⃣ Prueba de descarga de imagen:');
  try {
    // Usar una imagen real de wasabisys si existe, o una imagen pública
    const testImageUrl = 'https://s3.eu-central-1.wasabisys.com/in-files/test-image.jpg';
    
    const response = await fetch(testImageUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`
      }
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`   ✅ Imagen descargada: ${buffer.length} bytes`);
    } else {
      console.log(`   ⚠️  Error descargando imagen: ${response.status} ${response.statusText}`);
      console.log('   📝 Esto puede ser normal si la URL de prueba no existe');
      
      // Probar con imagen pública
      console.log('   🔄 Probando con imagen pública...');
      const publicImageResponse = await fetch('https://via.placeholder.com/150');
      if (publicImageResponse.ok) {
        const publicBuffer = Buffer.from(await publicImageResponse.arrayBuffer());
        console.log(`   ✅ Imagen pública descargada: ${publicBuffer.length} bytes`);
      } else {
        console.log('   ❌ Error descargando imagen pública');
      }
    }
  } catch (error) {
    console.log(`   ❌ Error en descarga: ${error.message}`);
  }

  console.log('\n📊 RESUMEN');
  console.log('='.repeat(40));
  console.log('🔍 Si hay problemas con imágenes:');
  console.log('   1. Verifica WHAPI_TOKEN en Vercel');
  console.log('   2. Verifica que el bot esté conectado en Whapi');
  console.log('   3. Revisa logs de Vercel Runtime Logs');
  console.log('   4. Verifica tamaño y formato de imágenes (<5MB, JPG/PNG)');
  
  console.log('\n🔍 Para probar manualmente:');
  console.log('   1. Envía "/ayuda" desde WhatsApp');
  console.log('   2. Envía "tomate" como texto');
  console.log('   3. Envía una foto de planta');
  console.log('   4. Revisa logs en Vercel');
}

// Ejecutar prueba
testWhatsAppConfig().catch(console.error);