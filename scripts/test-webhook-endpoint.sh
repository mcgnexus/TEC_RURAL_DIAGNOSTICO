#!/bin/bash

echo "🧪 Probando endpoint de webhook de WhatsApp..."
echo ""

# Probar el endpoint con un mensaje de prueba
curl -X POST https://tec-rural-diagnostico.vercel.app/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "from_me": false,
      "chat_id": "34614242716@s.whatsapp.net",
      "type": "text",
      "text": {
        "body": "/ayuda"
      },
      "from": "34614242716",
      "from_name": "Test User"
    }]
  }'

echo ""
echo ""
echo "✅ Si ves {\"success\":true}, el endpoint funciona correctamente"
echo "❌ Si ves un error, hay un problema con el deployment"
