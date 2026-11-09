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

  it('requires a fresh follow after unblock and enforces block checks for follow and chat', async () => {
    const social = {
      findUserIdByUsername: vi.fn(async () => 'target-id'),
      getBlockStatus: vi.fn(async () => ({ blockedByMe: true, blockedYou: false })),
      follow: vi.fn(async () => false),
      block: vi.fn(async () => undefined),
      unblock: vi.fn(async () => undefined),
      canChat: vi.fn(async () => false),
    };
    const service = new SocialService(social as never);

    await expect(service.getBlockStatus('viewer-id', 'alice')).resolves.toEqual({ blockedByMe: true, blockedYou: false });
    await expect(service.followByUsername('viewer-id', 'alice')).rejects.toMatchObject({ code: 'user_blocked', statusCode: 403 });
    await expect(service.assertChatAllowed('viewer-id', 'alice')).rejects.toMatchObject({ code: 'user_blocked', statusCode: 403 });
    await service.blockByUsername('viewer-id', 'alice');
    await service.unblockByUsername('viewer-id', 'alice');
    expect(social.block).toHaveBeenCalledWith('viewer-id', 'target-id');
    expect(social.unblock).toHaveBeenCalledWith('viewer-id', 'target-id');
    expect(social.follow).toHaveBeenCalledWith('viewer-id', 'target-id');
  });
});
