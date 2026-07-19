import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { testUsersDir } = vi.hoisted(() => ({
    testUsersDir: `${process.cwd()}\\src\\server\\__tests__\\tmp-config-background-users`
}));

vi.mock('../utils/paths', () => ({
    USERS_DIR: testUsersDir
}));

import { externalizeConfigBackgroundImages } from '../utils/config-background-images';

describe('externalizeConfigBackgroundImages', () => {
    afterEach(() => {
        fs.rmSync(testUsersDir, { recursive: true, force: true });
    });

    it('externalizeConfigBackgroundImages_Base64画像をファイルへ分離すること', () => {
        const config = externalizeConfigBackgroundImages({
            integratedBackgroundImage: 'data:image/png;base64,aW1hZ2U='
        }, 'user-1');

        expect(config.integratedBackgroundImage).toMatch(
            /^\/mascots\/users\/user-1\/_settings\/backgrounds\/integratedBackgroundImage\.png\?v=\d+$/
        );
        expect(fs.readFileSync(path.join(
            testUsersDir,
            'user-1',
            'mascots',
            '_settings',
            'backgrounds',
            'integratedBackgroundImage.png'
        ), 'utf8')).toBe('image');
    });

    it('externalizeConfigBackgroundImages_通常のURLは変更しないこと', () => {
        const config = externalizeConfigBackgroundImages({
            integratedBackgroundImage: '/mascots/users/user-1/background.png'
        }, 'user-1');

        expect(config.integratedBackgroundImage).toBe('/mascots/users/user-1/background.png');
    });
});
