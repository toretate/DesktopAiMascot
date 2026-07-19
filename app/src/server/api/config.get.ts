import { defineEventHandler, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { USERS_DIR, PROJECT_ROOT } from '../utils/paths';
import { safeWriteFileSync } from '../utils/fs-helpers';
import { createInitialConfig } from '../../config/config-template';
import { externalizeConfigBackgroundImages } from '../utils/config-background-images';

function getUserConfigPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'user_config.json');
}

function getOldUserConfigPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'config.json');
}

function getMascotConfigPath(userId: string, mascotId: string): string {
    return path.join(USERS_DIR, userId, 'mascots', mascotId, 'mascot_config.json');
}

/**
 * 古い共有アセットパスをユーザー個別アセットにマイグレーションし、必要に応じてファイルをコピーする
 */
function migrateMascotAssets(userId: string, mascot: any): any {
    if (!mascot || !mascot.id) return mascot;
    const mascotId = mascot.id;

    // 古いアセットの物理ディレクトリ: ui/src/public/mascots/<mascotId>
    const oldMascotDir = path.join(PROJECT_ROOT, 'ui/src/public/mascots', mascotId);
    // 新しいアセットの物理ディレクトリ: storage/users/<userId>/mascots/<mascotId>
    const newMascotDir = path.join(USERS_DIR, userId, 'mascots', mascotId);

    // ディレクトリコピー
    if (fs.existsSync(oldMascotDir) && !fs.existsSync(newMascotDir)) {
        try {
            fs.mkdirSync(path.dirname(newMascotDir), { recursive: true });
            fs.cpSync(oldMascotDir, newMascotDir, { recursive: true });
            console.log(`[Migration] 古いマスコットアセットをコピーしました: ${oldMascotDir} -> ${newMascotDir}`);
        } catch (err: any) {
            console.error(`[Migration] ${mascotId} のアセットコピーに失敗しました:`, err.message);
        }
    }

    const replacePath = (oldPath: string): string => {
        const prefix = `/mascots/${mascotId}/`;
        if (oldPath && oldPath.startsWith(prefix)) {
            return `/mascots/users/${userId}/${mascotId}/${oldPath.substring(prefix.length)}`;
        }
        return oldPath;
    };

    if (mascot.avatar) {
        mascot.avatar = replacePath(mascot.avatar);
    }

    if (mascot.assets && Array.isArray(mascot.assets.outfits)) {
        for (const outfit of mascot.assets.outfits) {
            if (outfit.path) outfit.path = replacePath(outfit.path);
        }
    }

    if (mascot.assets && Array.isArray(mascot.assets.expressions)) {
        for (const expr of mascot.assets.expressions) {
            if (expr.path) expr.path = replacePath(expr.path);
        }
    }

    if (mascot.assets && Array.isArray(mascot.assets.poses)) {
        for (const pose of mascot.assets.poses) {
            if (pose.path) pose.path = replacePath(pose.path);
        }
    }

    return mascot;
}

export default defineEventHandler(async (event) => {
    try {
        console.log('[Server] Load user config request received');
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: '認証情報が見つかりません。'
            });
        }

        const userId = event.context.user.id;
        const userConfigPath = getUserConfigPath(userId);
        const oldUserConfigPath = getOldUserConfigPath(userId);
        const userDir = path.dirname(userConfigPath);

        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        let config: any = null;
        let imported = false;

        // 1. user_config.json の読み込みを試みる
        if (fs.existsSync(userConfigPath)) {
            try {
                const fileData = fs.readFileSync(userConfigPath, 'utf8');
                const parsedConfig = JSON.parse(fileData);
                config = externalizeConfigBackgroundImages(parsedConfig, userId);
                if (JSON.stringify(config) !== JSON.stringify(parsedConfig)) {
                    safeWriteFileSync(userConfigPath, JSON.stringify(config, null, 4));
                }
            } catch (e: any) {
                console.error(`[Server] user_config.json のロードに失敗しました: ${e.message}`);
            }
        }

        // 2. なければ、旧 config.json からの移行を試みる
        if (!config && fs.existsSync(oldUserConfigPath)) {
            try {
                console.log(`[Server] 旧 config.json から分割 JSON への移行を開始します: ${userId}`);
                const data = fs.readFileSync(oldUserConfigPath, 'utf8');
                const rawConfig = JSON.parse(data);

                // マスコットデータを分離して個別保存
                if (rawConfig && Array.isArray(rawConfig.mascots)) {
                    for (let mascot of rawConfig.mascots) {
                        mascot = migrateMascotAssets(userId, mascot);
                        const mascotPath = getMascotConfigPath(userId, mascot.id);
                        safeWriteFileSync(mascotPath, JSON.stringify(mascot, null, 4));
                    }
                    delete rawConfig.mascots;
                }

                config = rawConfig;
                safeWriteFileSync(userConfigPath, JSON.stringify(config, null, 4));
                imported = true;
                console.log(`[Server] 旧 config.json からの移行が成功しました: ${userId}`);
            } catch (e: any) {
                console.error(`[Server] 旧 config.json からの移行に失敗しました: ${e.message}`);
            }
        }

        // 3. 移行データもない場合、秘密情報を含まない専用テンプレートから初期化
        if (!config) {
            try {
                console.log(`[Server] 専用テンプレートから設定を初期化します: ${userId}`);
                const initialConfig = createInitialConfig();

                // マスコットデータを分離して個別保存
                if (Array.isArray(initialConfig.mascots)) {
                    for (let mascot of initialConfig.mascots) {
                        mascot = migrateMascotAssets(userId, mascot);
                        const mascotPath = getMascotConfigPath(userId, mascot.id);
                        safeWriteFileSync(mascotPath, JSON.stringify(mascot, null, 4));
                    }
                    delete (initialConfig as Partial<typeof initialConfig>).mascots;
                }

                config = initialConfig;
                safeWriteFileSync(userConfigPath, JSON.stringify(config, null, 4));
            } catch (e: any) {
                console.error(`[Server] 専用テンプレートからの初期化に失敗しました: ${e.message}`);
                config = {};
            }
        }

        // 二重移行防止のため、古い config.json をリネーム退避
        if (imported && fs.existsSync(oldUserConfigPath)) {
            try {
                fs.renameSync(oldUserConfigPath, oldUserConfigPath + '.imported');
                console.log(`[Server] 旧 config.json を config.json.imported に退避しました`);
            } catch (e: any) {
                console.error(`[Server] 旧 config.json のリネームに失敗しました: ${e.message}`);
            }
        }

        // 軽量なシステム設定のみを返却
        return { success: true, config };
    } catch (error: any) {
        console.error('[Server] Failed to load config:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
