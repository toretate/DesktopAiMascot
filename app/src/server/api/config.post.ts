import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { USERS_DIR } from '../utils/paths';
import { safeWriteFileSync } from '../utils/fs-helpers';
import { externalizeConfigBackgroundImages } from '../utils/config-background-images';

function getUserConfigPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'user_config.json');
}

export default defineEventHandler(async (event) => {
    try {
        console.log('[Server] Save config request received');
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: '認証情報が見つかりません。'
            });
        }

        const userId = event.context.user.id;
        const userConfigPath = getUserConfigPath(userId);
        const userDir = path.dirname(userConfigPath);

        // ユーザーディレクトリの自動生成
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        const requestConfig = await readBody(event);
        const newConfig = externalizeConfigBackgroundImages(requestConfig, userId);

        // マスコット配列が含まれている場合は、システム設定から取り除く（個別JSONで管理するため）
        if (newConfig && 'mascots' in newConfig) {
            delete newConfig.mascots;
        }

        // user_config.json に安全にアトミック保存
        safeWriteFileSync(userConfigPath, JSON.stringify(newConfig, null, 4));
        console.log(`[Server] Configuration saved successfully to user_config.json for user: ${userId}`);
        
        return { success: true, config: newConfig };
    } catch (error: any) {
        console.error('[Server] Failed to save config:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
