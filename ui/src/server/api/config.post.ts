import { defineEventHandler, readBody, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { CONFIG_TEMPLATE_PATH, USERS_DIR, MASCOTS_DIR } from '../utils/paths';

function getUserConfigPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'config.json');
}

function saveBase64Image(base64Data: string, userId: string, mascotId: string, assetType: string, assetId: string): string {
    const matches = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return base64Data; // Base64ではない、または不正な形式の場合はそのまま返す
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');

    // ユーザー別のディレクトリパスを作成
    const targetDir = path.join(MASCOTS_DIR, 'users', userId, mascotId, assetType);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `${assetId}.${ext}`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, dataBuffer);
    console.log(`[Server] Saved asset to ${filePath}`);

    // 静的配信用の相対URLパスを返す (/mascots/users/<userId>/...)
    return `/mascots/users/${userId}/${mascotId}/${assetType}/${filename}`;
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

        const newConfig = await readBody(event);

        // Base64画像データの抽出と保存・置換
        if (newConfig && Array.isArray(newConfig.mascots)) {
            for (const mascot of newConfig.mascots) {
                const mascotId = mascot.id;
                if (!mascotId) continue;

                // avatar の処理
                if (mascot.avatar && mascot.avatar.startsWith('data:image/')) {
                    mascot.avatar = saveBase64Image(mascot.avatar, userId, mascotId, 'avatar', 'avatar');
                }

                // assets.outfits の処理
                if (mascot.assets && Array.isArray(mascot.assets.outfits)) {
                    for (const outfit of mascot.assets.outfits) {
                        if (outfit.path && outfit.path.startsWith('data:image/')) {
                            outfit.path = saveBase64Image(outfit.path, userId, mascotId, 'outfits', outfit.id);
                        }
                    }
                }

                // assets.expressions の処理
                if (mascot.assets && Array.isArray(mascot.assets.expressions)) {
                    for (const expr of mascot.assets.expressions) {
                        if (expr.path && expr.path.startsWith('data:image/')) {
                            expr.path = saveBase64Image(expr.path, userId, mascotId, 'expressions', expr.id);
                        }
                    }
                }

                // assets.poses の処理
                if (mascot.assets && Array.isArray(mascot.assets.poses)) {
                    for (const pose of mascot.assets.poses) {
                        if (pose.path && pose.path.startsWith('data:image/')) {
                            pose.path = saveBase64Image(pose.path, userId, mascotId, 'poses', pose.id);
                        }
                    }
                }
            }
        }

        fs.writeFileSync(userConfigPath, JSON.stringify(newConfig, null, 4), 'utf8');
        console.log(`[Server] config.json saved successfully for user: ${userId}`);
        return { success: true, config: newConfig };
    } catch (error: any) {
        console.error('[Server] Failed to save config:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
