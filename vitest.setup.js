import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocking environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-role-key';
process.env.GEMINI_API_KEY = 'fake-gemini-key';
process.env.TELEGRAM_BOT_TOKEN = 'fake-telegram-token';
process.env.WHAPI_TOKEN = 'fake-whapi-token';

// Global mocks if needed
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));
