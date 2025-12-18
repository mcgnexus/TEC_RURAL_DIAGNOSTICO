# Configuración de Seguridad para Endpoints Sensibles

## Variables de entorno necesarias:

### 1. Autenticación de Admin
Para acceder a endpoints de administración como `/api/admin/users`:
- El usuario debe tener un JWT válido de Supabase
- El usuario debe tener rol 'admin' en la tabla profiles

### 2. Tokens de seguridad para setup
Para endpoints de configuración RAG:

```bash
# Token opcional para setup RAG (si no se configura, requiere auth de admin)
SETUP_RAG_TOKEN=tu_token_secreto_aqui

# Token para cron jobs (obligatorio)
CRON_SECRET=tu_cron_secret_aqui
```

## Uso de los endpoints:

### Admin Users Endpoint
```bash
# Obtener usuarios (requiere JWT de admin)
curl -X GET \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://tu-app.com/api/admin/users

# Actualizar usuario (requiere JWT de admin)
curl -X PATCH \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid", "credits_remaining": 10}' \
  https://tu-app.com/api/admin/users
```

### Setup RAG Endpoints
```bash
# Opción 1: Usar token de setup
curl -X POST \
  -H "Authorization: Bearer YOUR_SETUP_RAG_TOKEN" \
  https://tu-app.com/api/setup-rag-simple

# Opción 2: Usar JWT de admin
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://tu-app.com/api/setup-rag-simple
```

### Cron Jobs
```bash
# Siempre requiere CRON_SECRET
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://tu-app.com/api/cron/cleanup-sessions
```

## Seguridad implementada:

1. ✅ **Admin Auth**: Verifica JWT y rol admin
2. ✅ **Setup Auth**: Soporta token de setup o auth de admin
3. ✅ **Cron Auth**: Verifica CRON_SECRET
4. ✅ **Service Role**: Limitado a backend con autenticación

## Recomendaciones:

- Usa tokens largos y aleatorios (mínimo 32 caracteres)
- Rota los tokens regularmente
- No hardcodees tokens en el código
- Usa variables de entorno en producción
- Considera implementar rate limiting adicional