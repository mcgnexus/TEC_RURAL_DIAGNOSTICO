/**
 * Configura el webhook de Telegram para el bot.
 *
 * Uso:
 *   node scripts/setup-telegram-webhook.js [BASE_URL]
 *
 * Requiere:
 *   TELEGRAM_BOT_TOKEN
 *   NEXT_PUBLIC_API_BASE_URL (o pasar BASE_URL como argumento)
 *
 * Opcional:
 *   TELEGRAM_WEBHOOK_SECRET (se enviará como secret_token y se validará en /api/webhooks/telegram)
 */

require('dotenv').config({ path: '.env.local' });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const baseUrl = (process.argv[2] || process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
const webhookSecret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();

if (!botToken) {
  console.error('Falta TELEGRAM_BOT_TOKEN en .env.local');
  process.exit(1);
}

if (!baseUrl) {
  console.error('Falta NEXT_PUBLIC_API_BASE_URL (o pásalo como argumento: node scripts/setup-telegram-webhook.js https://tu-dominio)');
  process.exit(1);
}

const origin = baseUrl.replace(/\/+$/, '');
const webhookUrl = `${origin}/api/webhooks/telegram`;

async function main() {
  console.log('Configurando webhook de Telegram...');
  console.log('Webhook URL:', webhookUrl);

  const payload = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  };

  if (webhookSecret) {
    payload.secret_token = webhookSecret;
    console.log('Usando TELEGRAM_WEBHOOK_SECRET (secret_token) ✓');
  }

  const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const setData = await setRes.json().catch(() => ({}));
  if (!setRes.ok || setData.ok !== true) {
    console.error('Error configurando webhook:', setData);
    process.exit(1);
  }

  console.log('Webhook configurado ✓');

  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, {
    method: 'GET',
  });
  const infoData = await infoRes.json().catch(() => ({}));
  console.log('Webhook info:', JSON.stringify(infoData, null, 2));
}

main().catch((err) => {
  console.error('Error inesperado:', err?.message || err);
  process.exit(1);
});

