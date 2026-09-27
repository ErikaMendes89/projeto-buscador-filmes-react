import { describe, expect, it, vi } from 'vitest';
import { SocialService } from './social.service.js';

describe('SocialService', () => {
  it('returns page metadata using the shared feed page size', async () => {
    const social = { getFeed: vi.fn(async (_userId: string, page: number, pageSize: number) => ({ items: [], totalResults: 41 })) };
    const service = new SocialService(social as never);

    await expect(service.getFeed('viewer-id', 3)).resolves.toEqual({ items: [], totalResults: 41, page: 3, totalPages: 3 });
    expect(social.getFeed).toHaveBeenCalledWith('viewer-id', 3, 20);
  });

  it('rejects self-follow by id and username before writing a relationship', async () => {
    const social = {
      findUserIdByUsername: vi.fn(async () => 'viewer-id'),
      follow: vi.fn(async () => undefined),
    };
    const service = new SocialService(social as never);

    expect(() => service.follow('viewer-id', 'viewer-id')).toThrowError('Você não pode seguir o próprio perfil');
    await expect(service.followByUsername('viewer-id', 'viewer')).rejects.toMatchObject({ code: 'self_follow', statusCode: 400 });
    expect(social.follow).not.toHaveBeenCalled();
  });
});
