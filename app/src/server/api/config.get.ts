import { defineEventHandler, createError } from 'h3';
import fs from 'fs';
import path from 'path';
import { CONFIG_TEMPLATE_PATH, USERS_DIR, PROJECT_ROOT } from '../utils/paths';

function getUserConfigPath(userId: string): string {
    return path.join(USERS_DIR, userId, 'config.json');
}

function migrateUserAssets(userId: string, config: any): { migrated: boolean; config: any } {
    let migrated = false;

    if (!config || !Array.isArray(config.mascots)) {
        return { migrated, config };
    }


    for (const mascot of config.mascots) {
        const mascotId = mascot.id;
        if (!mascotId) continue;

        // 古いアセットの物理ディレクトリ: ui/src/public/mascots/<mascotId>
        const oldMascotDir = path.join(PROJECT_ROOT, 'ui/src/public/mascots', mascotId);
        // 新しいアセットの物理ディレクトリ: storage/users/<userId>/mascots/<mascotId>
        const newMascotDir = path.join(USERS_DIR, userId, 'mascots', mascotId);

        // コピー処理
        if (fs.existsSync(oldMascotDir) && !fs.existsSync(newMascotDir)) {
            try {
                fs.mkdirSync(path.dirname(newMascotDir), { recursive: true });
                fs.cpSync(oldMascotDir, newMascotDir, { recursive: true });
                console.log(`[Migration] 古いマスコットアセットをコピーしました: ${oldMascotDir} -> ${newMascotDir}`);
                migrated = true;
            } catch (err: any) {
                console.error(`[Migration] ${mascotId} のアセットコピーに失敗しました:`, err.message);
            }
        }

        const replacePath = (oldPath: string): string => {
            const prefix = `/mascots/${mascotId}/`;
            if (oldPath && oldPath.startsWith(prefix)) {
                migrated = true;
                const newPath = `/mascots/users/${userId}/${mascotId}/${oldPath.substring(prefix.length)}`;
                console.log(`[Migration] パスを置換しました: ${oldPath} -> ${newPath}`);
                return newPath;
            }
            return oldPath;
        };

        if (mascot.avatar) {
            mascot.avatar = replacePath(mascot.avatar);
        }

        if (mascot.assets && Array.isArray(mascot.assets.outfits)) {
            for (const outfit of mascot.assets.outfits) {
                if (outfit.path) {
                    outfit.path = replacePath(outfit.path);
                }
            }
        }

        if (mascot.assets && Array.isArray(mascot.assets.expressions)) {
            for (const expr of mascot.assets.expressions) {
                if (expr.path) {
                    expr.path = replacePath(expr.path);
                }
            }
        }

        if (mascot.assets && Array.isArray(mascot.assets.poses)) {
            for (const pose of mascot.assets.poses) {
                if (pose.path) {
                    pose.path = replacePath(pose.path);
                }
            }
        }
    }

    return { migrated, config };
}

export default defineEventHandler(async (event) => {
    try {
        console.log('[Server] Load config request received');
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

        // 設定ファイルが存在しない場合のマイグレーション／テンプレート処理
        if (!fs.existsSync(userConfigPath)) {
            if (fs.existsSync(CONFIG_TEMPLATE_PATH)) {
                fs.copyFileSync(CONFIG_TEMPLATE_PATH, userConfigPath);
                console.log(`[Server] ルートの config.json をユーザー用設定として初期化コピーしました: ${userId}`);
            } else {
                fs.writeFileSync(userConfigPath, JSON.stringify({}, null, 4), 'utf8');
                console.log(`[Server] 空の config.json を作成しました: ${userId}`);
            }
        }

        const data = fs.readFileSync(userConfigPath, 'utf8');
        let config = JSON.parse(data);

        // 古い共有アセットパスをユーザー個別アセットにマイグレーションする
        const migrationResult = migrateUserAssets(userId, config);
        if (migrationResult.migrated) {
            fs.writeFileSync(userConfigPath, JSON.stringify(migrationResult.config, null, 4), 'utf8');
            console.log(`[Server] config.json のアセットパスをマイグレーションして保存しました: ${userId}`);
            config = migrationResult.config;
        }

        return { success: true, config };
    } catch (error: any) {
        console.error('[Server] Failed to load config:', error.message);
        throw createError({
            statusCode: 500,
            statusMessage: error.message
        });
    }
});
