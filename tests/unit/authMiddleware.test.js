import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks deben estar antes de los imports
const mockGetUser = vi.fn();
const mockFrom = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser
    },
    from: mockFrom,
    select: mockSelect,
    eq: mockEq,
    single: mockSingle
  }))
}));

// Importar después de los mocks
const { requireAdminAuth, requireCronAuth, requireSetupAuth } = await import('@/lib/auth/middleware');

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Resetear variables de entorno
    delete process.env.CRON_SECRET;
    delete process.env.SETUP_RAG_TOKEN;
  });

  describe('requireAdminAuth', () => {
    it('should reject request without authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'GET'
      });

      const result = await requireAdminAuth(request);
      
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid token') });

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });

      const result = await requireAdminAuth(request);
      
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(401);
    });

    it('should reject non-admin users', async () => {
      const mockUser = { id: 'user-123', email: 'user@example.com' };
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: { role: 'user' }, error: null });

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      const result = await requireAdminAuth(request);
      
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(403);
    });

    it('should allow admin users', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@example.com' };
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      const result = await requireAdminAuth(request);
      
      expect(result.error).toBeNull();
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('requireCronAuth', () => {
    it('should reject when CRON_SECRET is not configured', () => {
      const request = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        method: 'GET'
      });

      const result = requireCronAuth(request);
      
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(500);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid cron secret', () => {
      process.env.CRON_SECRET = 'correct-secret';
      
      const request = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer wrong-secret'
        }
      });

      const result = requireCronAuth(request);
      
      expect(result.error).toBeDefined();
      expect(result.error.status).toBe(401);
      expect(result.valid).toBe(false);
    });

    it('should accept valid cron secret', () => {
      process.env.CRON_SECRET = 'correct-secret';
      
      const request = new NextRequest('http://localhost:3000/api/cron/cleanup', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer correct-secret'
        }
      });

      const result = requireCronAuth(request);
      
      expect(result.error).toBeNull();
      expect(result.valid).toBe(true);
    });
  });

  describe('requireSetupAuth', () => {
    it('should accept valid setup token when configured', async () => {
      process.env.SETUP_RAG_TOKEN = 'setup-token-123';
      
      const request = new NextRequest('http://localhost:3000/api/setup-rag-simple', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer setup-token-123'
        }
      });

      const result = await requireSetupAuth(request);
      
      expect(result.error).toBeNull();
      expect(result.valid).toBe(true);
    });

    it('should fall back to admin auth when setup token is not configured', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@example.com' };
      mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });

      const request = new NextRequest('http://localhost:3000/api/setup-rag-simple', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      const result = await requireSetupAuth(request);
      
      expect(result.error).toBeNull();
      expect(result.user).toEqual(mockUser);
    });
  });
});