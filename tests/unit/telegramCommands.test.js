import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectCommand, handleNuevoCommand } from '../../lib/telegram/telegramCommands';
import * as telegramSession from '../../lib/telegram/telegramSession';

// Mock dependencias
vi.mock('../../lib/supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

vi.mock('../../lib/telegram/telegramSession.js', () => ({
  getOrCreateSession: vi.fn(),
  updateSessionState: vi.fn(),
}));

vi.mock('../../lib/telegram/telegramApi.js', () => ({
  sendTelegramMessage: vi.fn(),
}));

describe('telegramCommands lib', () => {
  describe('detectCommand', () => {
    it('should detect /start', () => {
      expect(detectCommand('/start')).toBe('start');
      expect(detectCommand(' /start ')).toBe('start');
    });

    it('should detect /nuevo and aliases', () => {
      expect(detectCommand('/nuevo')).toBe('nuevo');
      expect(detectCommand('/new')).toBe('nuevo');
    });

    it('should return null for non-commands', () => {
      expect(detectCommand('hola')).toBeNull();
      expect(detectCommand('')).toBeNull();
      expect(detectCommand(null)).toBeNull();
    });
  });

  describe('handleNuevoCommand', () => {
    it('should initialize session and return welcome message', async () => {
      const telegramId = '12345';
      const userId = 'user-abc';
      
      const response = await handleNuevoCommand(telegramId, userId);
      
      expect(telegramSession.getOrCreateSession).toHaveBeenCalledWith(telegramId, userId);
      expect(telegramSession.updateSessionState).toHaveBeenCalledWith(telegramId, 'awaiting_cultivo', expect.any(Object));
      expect(response).toContain('¡Excelente! Vamos a crear un nuevo diagnóstico');
    });

    it('should handle errors gracefully', async () => {
      telegramSession.getOrCreateSession.mockRejectedValueOnce(new Error('DB Error'));
      
      const response = await handleNuevoCommand('123', 'abc');
      expect(response).toContain('Ocurrió un error');
    });
  });
});
