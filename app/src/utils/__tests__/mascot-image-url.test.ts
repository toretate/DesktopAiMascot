import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMascotImageUrl } from '../mascot-image-url';

describe('resolveMascotImageUrl', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('アセット単位の版数クエリを保持して絶対URLへ変換すること', () => {
        expect(resolveMascotImageUrl('/mascots/users/user/mascot/outfits/body.png?v=asset-2', {
            serverHost: '127.0.0.1',
            serverPort: 3000,
            absoluteMascotUrl: true
        })).toBe('http://127.0.0.1:3000/mascots/users/user/mascot/outfits/body.png?v=asset-2');
    });

    it('Data URLとBlob URLは変更しないこと', () => {
        const options = { serverHost: 'localhost', serverPort: 3000, absoluteMascotUrl: true };
        expect(resolveMascotImageUrl('data:image/png;base64,abc', options)).toBe('data:image/png;base64,abc');
        expect(resolveMascotImageUrl('blob:http://localhost/image', options)).toBe('blob:http://localhost/image');
    });

    it('Web版では閲覧中のサーバーを画像配信元として使用すること', () => {
        vi.stubGlobal('window', {
            electronAPI: { isWeb: true },
            location: { origin: 'http://192.168.10.103:3000' }
        });

        expect(resolveMascotImageUrl('/mascots/users/user/mascot/body.png', {
            serverHost: 'localhost',
            serverPort: 3000,
            absoluteMascotUrl: true
        })).toBe('http://192.168.10.103:3000/mascots/users/user/mascot/body.png');
    });

    it('Electron版では設定された外部サーバーを使用すること', () => {
        vi.stubGlobal('window', {
            electronAPI: { isWeb: false },
            location: { origin: 'file://' }
        });

        expect(resolveMascotImageUrl('/mascots/users/user/mascot/body.png', {
            serverHost: '192.168.10.103',
            serverPort: 3000,
            absoluteMascotUrl: true
        })).toBe('http://192.168.10.103:3000/mascots/users/user/mascot/body.png');
    });
});
