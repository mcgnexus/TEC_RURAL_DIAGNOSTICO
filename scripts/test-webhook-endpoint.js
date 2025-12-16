/**
 * Script para probar el endpoint del webhook de WhatsApp
 * Ejecutar: node scripts/test-webhook-endpoint.js
 */

const WEBHOOK_URL = 'https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp';

const testPayload = {
  messages: [
    {
      from_me: false,
      chat_id: '34614242716@s.whatsapp.net',
      type: 'text',
      text: {
        body: '/ayuda',
      },
      from: '34614242716',
      from_name: 'Test User',
    },
  ],
};

console.log('🧪 Probando endpoint de webhook de WhatsApp...');
console.log('URL:', WEBHOOK_URL);
console.log('');

fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testPayload),
})
  .then(async (response) => {
    console.log('📊 Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('📝 Respuesta:', text);
    console.log('');

    if (response.ok) {
      console.log('✅ El endpoint funciona correctamente');
      console.log('');
      console.log('🔍 Ahora revisa los logs de Vercel:');
      console.log('   https://vercel.com/dashboard');
      console.log('   → Tu proyecto → Runtime Logs');
      console.log('   → Busca: [whatsapp-webhook]');
      console.log('');
      console.log('⚠️  Si NO ves logs, el problema es que Whapi NO está enviando webhooks');
    } else {
      console.log('❌ Error en el endpoint');
      console.log('   Revisa el deployment en Vercel');
    }
  })
  .catch((error) => {
    console.log('❌ Error conectando con el endpoint:', error.message);
    console.log('   Verifica que el deployment esté activo');
  });
