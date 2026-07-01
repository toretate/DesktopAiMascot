import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'node:fs';
import path from 'node:path';
import { resolveMascotPath } from '../../utils/paths';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        const { mascotId, imageBase64 } = body as { mascotId?: string; imageBase64?: string };

        if (!mascotId || !imageBase64) {
            throw createError({
                statusCode: 400,
                statusMessage: 'mascotId and imageBase64 are required'
            });
        }

        // noface.png の保存先ファイルパスを解決
        const requestPath = `/mascots/users/usr_local_dev_bypass/${mascotId}/noface.png`;
        const absPath = resolveMascotPath(requestPath);

        // ディレクトリ作成
        fs.mkdirSync(path.dirname(absPath), { recursive: true });

        // Base64デコードとファイル保存
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        fs.writeFileSync(absPath, buffer);

        console.log(`[Server] Saved noface image: ${absPath}`);
        return { success: true, path: requestPath };
    } catch (error: any) {
        console.error('[Server] save-noface failed:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
