import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock environment variables for testing
process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'
process.env.TURNSTILE_SECRET_KEY = 'test-secret-key'
process.env.GOOGLE_PLACES_BACKEND_KEY = 'test-google-key'

// Silencing logs during tests
vi.stubGlobal('console', {
  ...console,
  info: vi.fn(),
  warn: vi.fn(),
})

// Mock localStorage for jsdom/Node 22
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((idx: number) => Object.keys(store)[idx] ?? null),
  };
};

const storageMock = createLocalStorageMock();
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: storageMock,
    writable: true,
  });
}
Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});
