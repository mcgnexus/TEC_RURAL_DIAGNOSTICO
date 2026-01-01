import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('whapi lib', () => {
  let whapi;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.resetModules();
    process.env.WHAPI_API_URL = 'https://gate.whapi.cloud';
    process.env.WHAPI_TOKEN = 'test-whapi-token';
    delete process.env.WHAPI_MAX_IMAGE_BYTES;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloadWhatsAppMedia should accept wasabisys links', async () => {
    whapi = await import('../../lib/whapi');
    const { downloadWhatsAppMedia } = whapi;
    const buffer = Buffer.from([1, 2, 3]);
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => buffer,
    });

    const result = await downloadWhatsAppMedia(
      'https://s3.eu-central-1.wasabisys.com/in-files/123/image-abc.jpg'
    );

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(3);
    expect(fetch).toHaveBeenCalledWith(
      'https://s3.eu-central-1.wasabisys.com/in-files/123/image-abc.jpg',
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Object),
      })
    );
  });

  it('downloadWhatsAppMedia should fetch /media/{id} when given a media id', async () => {
    whapi = await import('../../lib/whapi');
    const { downloadWhatsAppMedia } = whapi;
    const buffer = Buffer.from([9, 9]);
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => buffer,
    });

    const result = await downloadWhatsAppMedia('img-12345');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(fetch).toHaveBeenCalledWith(
      'https://gate.whapi.cloud/media/img-12345',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-whapi-token',
        }),
      })
    );
  });

  it('sendWhatsAppImage should fall back to base64 when URL send fails', async () => {
    whapi = await import('../../lib/whapi');
    const { sendWhatsAppImage } = whapi;
    fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Failed to fetch media by link',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: name => (String(name).toLowerCase() === 'content-type' ? 'image/jpeg' : null),
        },
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ sent: true }),
      });

    const result = await sendWhatsAppImage({
      to: '+34600000000',
      imageUrl: 'https://example.com/photo.jpg',
      caption: 'test',
    });

    expect(result).toEqual({ sent: true });
    expect(fetch).toHaveBeenCalledTimes(3);

    const thirdCallOptions = fetch.mock.calls[2][1];
    const body = JSON.parse(thirdCallOptions.body);
    expect(body.media).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.caption).toBe('test');
  });

  it('sendWhatsAppImage should fall back to text with link when base64 fails', async () => {
    process.env.WHAPI_MAX_IMAGE_BYTES = String(10);
    whapi = await import('../../lib/whapi');
    const { sendWhatsAppImage } = whapi;

    fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Failed to fetch media by link',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: name => (String(name).toLowerCase() === 'content-length' ? '999999' : null),
        },
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ textSent: true }),
      });

    const result = await sendWhatsAppImage({
      to: '+34600000000',
      imageUrl: 'https://example.com/huge.jpg',
      caption: 'caption',
    });

    expect(result).toEqual({ textSent: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    const thirdCallUrl = fetch.mock.calls[2][0];
    expect(String(thirdCallUrl)).toContain('/messages/text');
    const thirdBody = JSON.parse(fetch.mock.calls[2][1].body);
    expect(thirdBody.body).toContain('https://example.com/huge.jpg');
  });
});
