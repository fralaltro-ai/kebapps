import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateTurnstileToken } from '../turnstile';

describe('validateTurnstileToken', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, TURNSTILE_SECRET_KEY: 'test-secret' };
    global.fetch = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should return true and warn if TURNSTILE_SECRET_KEY is missing', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const result = await validateTurnstileToken('test-token');
    expect(result).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('TURNSTILE_SECRET_KEY is not defined'));
  });

  it('should return false if token is missing', async () => {
    const result = await validateTurnstileToken('');
    expect(result).toBe(false);
  });

  it('should return true if validation is successful', async () => {
    (global.fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await validateTurnstileToken('valid-token', '1.2.3.4');
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('should return false if validation fails', async () => {
    (global.fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    });

    const result = await validateTurnstileToken('invalid-token');
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Turnstile validation failed:', ['invalid-input-response']);
  });

  it('should return false and log error if siteverify returns a non-OK HTTP status', async () => {
    (global.fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ success: false }),
    });

    const result = await validateTurnstileToken('token');
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Turnstile siteverify returned HTTP 503');
  });

  it('should return false and log error if fetch throws (error path test)', async () => {
    const networkError = new Error('Network failure');
    (global.fetch as unknown as { mockRejectedValue: (v: unknown) => void }).mockRejectedValue(networkError);

    const result = await validateTurnstileToken('token');
    expect(result).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Error connecting to Turnstile API:', networkError);
  });

  it('should reject Cloudflare test secret key in production (fail-closed)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    const result = await validateTurnstileToken('dev-turnstile-bypass');
    expect(result).toBe(false);
    vi.unstubAllEnvs();
  });

  it('should allow dev-turnstile-bypass only outside production with Cloudflare test secret key', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    const result = await validateTurnstileToken('dev-turnstile-bypass', '127.0.0.1', 'shops_search');
    expect(result).toBe(true);
    vi.unstubAllEnvs();
  });
});
