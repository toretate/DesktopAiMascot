import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authMiddleware from '../middleware/auth';

const { mockGetHeader, mockGetCookie } = vi.hoisted(() => ({
    mockGetHeader: vi.fn(),
    mockGetCookie: vi.fn()
}));

vi.mock('h3', async (importOriginal) => {
    const actual = await importOriginal<typeof import('h3')>();
    return {
        ...actual,
        getHeader: mockGetHeader,
        getCookie: mockGetCookie
    };
});

const createEvent = (path = '/api/tts') => ({
    path,
    context: {},
    node: {
        req: {
            socket: {
                remoteAddress: '192.168.10.50'
            }
        }
    }
}) as any;

describe('認証ミドルウェア', () => {
    const originalAllowAuthBypass = process.env.ALLOW_AUTH_BYPASS;

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ALLOW_AUTH_BYPASS;
        mockGetHeader.mockReturnValue(undefined);
        mockGetCookie.mockReturnValue(undefined);
    });

    afterEach(() => {
        if (originalAllowAuthBypass === undefined) {
            delete process.env.ALLOW_AUTH_BYPASS;
        } else {
            process.env.ALLOW_AUTH_BYPASS = originalAllowAuthBypass;
        }
    });

    it('認証ミドルウェア_ALLOW_AUTH_BYPASSがtrueの場合は認証をバイパスすること', async () => {
        process.env.ALLOW_AUTH_BYPASS = 'true';
        const event = createEvent();

        await expect(authMiddleware(event)).resolves.toBeUndefined();

        expect(event.context.user).toEqual({
            id: 'usr_local_dev_bypass',
            email: 'test-user@gmail.com',
            role: 'user'
        });
    });

    it('認証ミドルウェア_ALLOW_AUTH_BYPASSが未設定で認証情報がない場合は未認証メッセージ付き401を返すこと', async () => {
        await expect(authMiddleware(createEvent())).rejects.toMatchObject({
            statusCode: 401,
            message: '未認証です。ログインしてからもう一度お試しください。'
        });
    });

    it('認証ミドルウェア_pingは認証バイパス設定にかかわらず許可すること', async () => {
        await expect(authMiddleware(createEvent('/api/ping'))).resolves.toBeUndefined();
    });

    it.each(['/api/auth/login', '/api/auth/callback', '/api/auth/callback?code=test-code'])(
        '認証ミドルウェア_%sは未認証でも許可すること',
        async (path) => {
            await expect(authMiddleware(createEvent(path))).resolves.toBeUndefined();
        }
    );
});
