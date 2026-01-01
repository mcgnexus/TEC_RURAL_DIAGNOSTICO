import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/webhooks/telegram/route';
import * as telegramAuth from '@/lib/telegram/telegramAuth';
import * as telegramCommands from '@/lib/telegram/telegramCommands';
import * as telegramApi from '@/lib/telegram/telegramApi';

// Mocking dependencies using @ prefix to match route.js imports
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/telegram/telegramAuth', () => ({
  findUserByTelegramId: vi.fn(),
}));

vi.mock('@/lib/telegram/telegramCommands', () => ({
  detectCommand: vi.fn(),
  handleNuevoCommand: vi.fn(),
  showStartMenu: vi.fn(),
  handleAyudaCommand: vi.fn(),
  handleHistorialCommand: vi.fn(),
  handleCreditosCommand: vi.fn(),
}));

vi.mock('@/lib/telegram/telegramApi', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
  sendTelegramMessageChunks: vi.fn().mockResolvedValue(true),
  sendTelegramPhoto: vi.fn().mockResolvedValue({ ok: true }),
  downloadTelegramFile: vi.fn(),
}));

vi.mock('@/lib/diagnosisEngine', () => ({
  runDiagnosis: vi.fn(),
}));

vi.mock('@/lib/telegram/telegramSession', () => ({
  getActiveSession: vi.fn(),
  updateSessionState: vi.fn(),
  clearSession: vi.fn(),
}));

describe('Telegram Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_WEBHOOK_SECRET = ''; 
  });

  it('should reject request with invalid secret token when configured', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';

    const request = {
      json: async () => ({ update_id: 1 }),
      headers: { get: () => 'wrong' }
    };

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(telegramApi.sendTelegramMessage).not.toHaveBeenCalled();
    expect(telegramApi.sendTelegramPhoto).not.toHaveBeenCalled();
  });

  it('should return 200 for empty or invalid body', async () => {
    const body = {};
    const request = {
      json: async () => body,
      headers: { get: () => null }
    };

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('should handle /start command for unauthenticated user', async () => {
    telegramAuth.findUserByTelegramId.mockResolvedValue(null);
    telegramCommands.detectCommand.mockReturnValue('start');

    const body = {
      update_id: 1,
      message: {
        from: { id: 12345 },
        text: '/start',
      },
    };

    const request = {
      json: async () => body,
      headers: { get: () => null }
    };

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(telegramCommands.showStartMenu).toHaveBeenCalledWith('12345', false);
  });

  it('should handle /nuevo command for authenticated user', async () => {
    const mockProfile = { id: 'user-1', full_name: 'Test User', phone: '123456789', credits_remaining: 10 };
    telegramAuth.findUserByTelegramId.mockResolvedValue(mockProfile);
    telegramCommands.detectCommand.mockReturnValue('nuevo');
    telegramCommands.handleNuevoCommand.mockResolvedValue('Respuesta');

    const body = {
      update_id: 2,
      message: {
        from: { id: 12345 },
        text: '/nuevo',
      },
    };

    const request = {
      json: async () => body,
      headers: { get: () => null }
    };

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(telegramCommands.handleNuevoCommand).toHaveBeenCalled();
    expect(telegramApi.sendTelegramMessage).toHaveBeenCalledWith('12345', 'Respuesta');
  });

  it('should handle a photo message and run diagnosis', async () => {
    const mockProfile = { id: 'user-1', full_name: 'Test User', phone: '123456789', credits_remaining: 10 };
    telegramAuth.findUserByTelegramId.mockResolvedValue(mockProfile);
    telegramCommands.detectCommand.mockReturnValue(null); // No specific command, just a photo
    telegramApi.downloadTelegramFile.mockResolvedValue(Buffer.from('fake-image-data'));
    
    const diagnosisEngine = await import('@/lib/diagnosisEngine');
    diagnosisEngine.runDiagnosis.mockResolvedValue({
      success: true,
      diagnosis: {
        id: 'diag-1',
        diagnosis_md: 'Diagnóstico de prueba',
        image_url: 'http://example.com/image.jpg',
        cultivo_name: 'Maiz',
      },
      remainingCredits: 9,
      recommendations: ['Recomendación 1'],
      raw: { confidence: 0.95 },
    });

    const body = {
      update_id: 3,
      message: {
        from: { id: 12345, first_name: 'Test' },
        photo: [{
          file_id: 'photo-id-1',
          file_unique_id: 'photo-unique-id-1',
          file_size: 100,
          width: 100,
          height: 100,
        }],
        caption: 'Cultivo: Maiz',
      },
    };

    const request = {
      json: async () => body,
      headers: { get: () => null }
    };

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(telegramApi.downloadTelegramFile).toHaveBeenCalledWith('photo-id-1');
    expect(telegramApi.sendTelegramPhoto).toHaveBeenCalledWith(
      '12345',
      'http://example.com/image.jpg',
      'Diagnóstico TEC Rural - Maiz',
      { parse_mode: null }
    );
    expect(telegramApi.sendTelegramMessage).toHaveBeenCalledWith(
      '12345',
      '🔄 Analizando tu imagen... Esto puede tardar unos segundos.'
    );
    expect(telegramApi.sendTelegramMessageChunks).toHaveBeenCalledWith(
      '12345',
      '✅ *Diagnóstico completado*\n\n🌱 Cultivo: Maiz\n📊 Confianza: 0%\n\nDiagnóstico no disponible.\n\n💳 Créditos restantes: 9',
      { parse_mode: null }
    );
  });
});
