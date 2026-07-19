import fs from 'fs';
import path from 'path';
import { USERS_DIR } from './paths';

const BACKGROUND_FIELDS = [
    'chatBackgroundImage',
    'mascotBackgroundImage',
    'integratedBackgroundImage'
] as const;

const MIME_EXTENSIONS: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg'
};

/**
 * 設定に埋め込まれた背景画像をユーザー領域へ分離し、配信用URLへ置換する。
 */
export function externalizeConfigBackgroundImages<T extends Record<string, any>>(
    config: T,
    userId: string
): T {
    const normalized = { ...config };
    const backgroundDir = path.join(USERS_DIR, userId, 'mascots', '_settings', 'backgrounds');

    for (const field of BACKGROUND_FIELDS) {
        const value = normalized[field];
        if (typeof value !== 'string' || !value.startsWith('data:image/')) continue;

        const match = value.match(/^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=\r\n]+)$/);
        if (!match) {
            throw new Error(`${field} の画像データ形式が不正です。`);
        }

        const extension = MIME_EXTENSIONS[match[1]];
        const imageBuffer = Buffer.from(match[2], 'base64');
        fs.mkdirSync(backgroundDir, { recursive: true });

        const fileName = `${field}.${extension}`;
        const filePath = path.join(backgroundDir, fileName);
        const temporaryPath = `${filePath}.tmp`;
        fs.writeFileSync(temporaryPath, imageBuffer);
        fs.renameSync(temporaryPath, filePath);

        (normalized as Record<string, any>)[field] =
            `/mascots/users/${userId}/_settings/backgrounds/${fileName}?v=${Date.now()}`;
    }

    return normalized;
}
