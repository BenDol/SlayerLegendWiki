/**
 * Tests for image format detection and fail-closed moderation.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectImageFormat, validateImageFile, checkImageModeration } from '../../functions/_shared/image-utils.js';

const bytes = (...arr) => Buffer.from(arr);
// A minimal valid WebP header: "RIFF"????"WEBP"
const webp = () => Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0, 0, 0]);
// A RIFF container that is NOT WebP (e.g. WAV): "RIFF"????"WAVE"
const riffWave = () => Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, 0, 0, 0, 0]);
const jpeg = () => bytes(0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0);
const png = () => bytes(0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0);
const gif = () => bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0);

describe('detectImageFormat', () => {
  it('detects JPEG as jpg', () => expect(detectImageFormat(jpeg())).toEqual({ mime: 'image/jpeg', ext: 'jpg' }));
  it('detects PNG', () => expect(detectImageFormat(png())).toEqual({ mime: 'image/png', ext: 'png' }));
  it('detects GIF', () => expect(detectImageFormat(gif())).toEqual({ mime: 'image/gif', ext: 'gif' }));
  it('detects WebP (RIFF + WEBP fourCC)', () => expect(detectImageFormat(webp())).toEqual({ mime: 'image/webp', ext: 'webp' }));

  it('rejects a RIFF container that is not WebP', () => {
    // The security-relevant clause: RIFF alone (wav/avi) must NOT pass as webp.
    expect(detectImageFormat(riffWave())).toBeNull();
  });

  it('returns null for a buffer shorter than 12 bytes', () => {
    expect(detectImageFormat(bytes(0xFF, 0xD8, 0xFF))).toBeNull();
  });

  it('returns null for non-image content', () => {
    expect(detectImageFormat(Buffer.from('<!doctype html><script>x</script>'))).toBeNull();
  });
});

describe('validateImageFile', () => {
  it('accepts content matching the claimed MIME type', () => {
    expect(validateImageFile(png(), 'image/png')).toBe(true);
  });
  it('rejects content that does not match the claimed MIME type', () => {
    expect(validateImageFile(png(), 'image/webp')).toBe(false);
  });
  it('rejects an unknown MIME type', () => {
    expect(validateImageFile(png(), 'text/html')).toBe(false);
  });
});

describe('checkImageModeration (fail-closed)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('skips (allows) when no API key is configured', async () => {
    const result = await checkImageModeration('base64', null);
    expect(result.flagged).toBe(false);
  });

  it('fails closed on a non-OK API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500, text: async () => 'err' });
    const result = await checkImageModeration('base64', 'key');
    expect(result.flagged).toBe(true);
    expect(result.moderationUnavailable).toBe(true);
  });

  it('fails closed when the API call throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const result = await checkImageModeration('base64', 'key');
    expect(result.flagged).toBe(true);
    expect(result.moderationUnavailable).toBe(true);
  });
});
