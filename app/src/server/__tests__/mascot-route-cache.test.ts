import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mascotRouteHandler, { createFileEtag, isRequestNotModified } from '../routes/mascots/[...path]';

const {
    mockExistsSync,
    mockStatSync,
    mockCreateReadStream,
    mockGetHeader,
    mockGetCookie,
    mockSetResponseHeader,
    mockSendNoContent,
    mockSendStream,
    mockAuthenticateUserToken
} = vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockStatSync: vi.fn(),
    mockCreateReadStream: vi.fn(),
    mockGetHeader: vi.fn(),
    mockGetCookie: vi.fn(),
    mockSetResponseHeader: vi.fn(),
    mockSendNoContent: vi.fn(),
    mockSendStream: vi.fn(),
    mockAuthenticateUserToken: vi.fn()
}));

vi.mock('fs', () => ({
    default: {
        existsSync: mockExistsSync,
        statSync: mockStatSync,
        createReadStream: mockCreateReadStream
    }
}));

vi.mock('../utils/paths', () => ({
    USERS_DIR: 'C:\\storage\\users',
    resolveMascotPath: () => 'C:\\storage\\users\\owner\\mascots\\mascot_a\\outfits\\body.png'
}));

vi.mock('../middleware/auth', () => ({
    authenticateUserToken: mockAuthenticateUserToken
}));

vi.mock('h3', async (importOriginal) => {
    const actual = await importOriginal<typeof import('h3')>();
    return {
        ...actual,
        getHeader: mockGetHeader,
        getCookie: mockGetCookie,
        setResponseHeader: mockSetResponseHeader,
        sendNoContent: mockSendNoContent,
        sendStream: mockSendStream
    };
});

const createRemoteEvent = () => ({
    context: { params: { path: 'users/owner/mascot_a/outfits/body.png' } },
    node: { req: { socket: { remoteAddress: '203.0.113.10' } } }
}) as any;

describe('マスコット画像配信キャッシュ', () => {
    const originalAllowAuthBypass = process.env.ALLOW_AUTH_BYPASS;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ALLOW_AUTH_BYPASS = 'false';
        mockGetCookie.mockReturnValue('');
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({
            isDirectory: () => false,
            size: 100,
            mtimeMs: 1000,
            mtime: new Date(1000)
        });
        mockSendNoContent.mockReturnValue({ statusCode: 304 });
    });

    afterAll(() => {
        if (originalAllowAuthBypass === undefined) {
            delete process.env.ALLOW_AUTH_BYPASS;
        } else {
            process.env.ALLOW_AUTH_BYPASS = originalAllowAuthBypass;
        }
    });

    it('createFileEtag_サイズと更新時刻から弱いETagを生成すること', () => {
        expect(createFileEtag(100, 1000)).toBe('W/"64-3e8"');
    });

    it('isRequestNotModified_IfNoneMatchをIfModifiedSinceより優先すること', () => {
        expect(isRequestNotModified('W/"different"', new Date(5000).toUTCString(), 'W/"64-3e8"', 1000)).toBe(false);
        expect(isRequestNotModified('"64-3e8"', undefined, 'W/"64-3e8"', 1000)).toBe(true);
    });

    it('未認証の場合はETagが一致してもstatや304判定より先に401を返すこと', async () => {
        mockGetHeader.mockImplementation((_event, name: string) => {
            if (name === 'host') return 'example.com';
            if (name === 'if-none-match') return 'W/"64-3e8"';
            return undefined;
        });

        await expect(mascotRouteHandler(createRemoteEvent())).rejects.toMatchObject({ statusCode: 401 });
        expect(mockStatSync).not.toHaveBeenCalled();
        expect(mockSendNoContent).not.toHaveBeenCalled();
    });

    it('認証・所有者確認後にETagが一致した場合は304を返すこと', async () => {
        mockGetHeader.mockImplementation((_event, name: string) => {
            if (name === 'host') return 'example.com';
            if (name === 'authorization') return 'Bearer valid-token';
            if (name === 'if-none-match') return 'W/"64-3e8"';
            return undefined;
        });
        mockAuthenticateUserToken.mockResolvedValue({ id: 'owner' });

        const result = await mascotRouteHandler(createRemoteEvent());

        expect(result).toEqual({ statusCode: 304 });
        expect(mockAuthenticateUserToken).toHaveBeenCalledWith('valid-token');
        expect(mockSendNoContent).toHaveBeenCalledWith(expect.anything(), 304);
        expect(mockSendStream).not.toHaveBeenCalled();
    });
});
