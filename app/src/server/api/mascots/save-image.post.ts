import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'node:fs';
import path from 'node:path';
import { resolveMascotPath } from '../../utils/paths';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { mascotId, filename, base64Data } = body as { mascotId?: string; filename?: string; base64Data?: string };

        if (!mascotId || !filename || !base64Data) {
            throw createError({
                statusCode: 400,
                statusMessage: 'mascotId, filename and base64Data are required'
            });
        }

        let userId = 'usr_local_dev_bypass';
        if (event.context.user) {
            userId = event.context.user.id;
        }

        // 保存先パスを解決
        const requestPath = `/mascots/users/${userId}/${mascotId}/${filename}`;
        const absPath = resolveMascotPath(requestPath);

        // ディレクトリ作成
        fs.mkdirSync(path.dirname(absPath), { recursive: true });

        // Base64デコードとファイル保存
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, 'base64');

        fs.writeFileSync(absPath, buffer);

        console.log(`[Server] Saved mascot image: ${absPath}`);
        return { success: true, path: requestPath };
    } catch (error: any) {
        console.error('[Server] save-image failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
