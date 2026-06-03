import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../middlewares/auth-middleware';

const router = Router();

const CONFIG_PATH = path.join(__dirname, '../../../config.json');
const MASCOTS_DIR = path.join(__dirname, '../../../mascots');

// Base64 DataURL をデコードしてファイルに保存し、静的URLパスを返す関数
function saveBase64Image(base64Data: string, mascotId: string, assetType: string, assetId: string): string {
    const matches = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return base64Data; // Base64ではない、または不正な形式の場合はそのまま返す
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');

    // ディレクトリパスを作成
    const targetDir = path.join(MASCOTS_DIR, mascotId, assetType);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `${assetId}.${ext}`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, dataBuffer);
    console.log(`[Server] Saved asset to ${filePath}`);

    // 静的配信用の相対URLパスを返す (/mascots/...)
    return `/mascots/${mascotId}/${assetType}/${filename}`;
}

// 設定データをロードするエンドポイント
router.get('/config', authMiddleware, (req, res) => {
    try {
        console.log('[Server] Load config request received');
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return res.json({ success: true, config: JSON.parse(data) });
        } else {
            console.log('[Server] config.json does not exist. Returning empty object.');
            return res.json({ success: true, config: {} });
        }
    } catch (error: any) {
        console.error('[Server] Failed to load config:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 設定データをセーブするエンドポイント
router.post('/config', authMiddleware, (req, res) => {
    try {
        console.log('[Server] Save config request received');
        const newConfig = req.body;

        // Base64画像データの抽出と保存・置換
        if (newConfig && Array.isArray(newConfig.mascots)) {
            for (const mascot of newConfig.mascots) {
                const mascotId = mascot.id;
                if (!mascotId) continue;

                // avatar の処理
                if (mascot.avatar && mascot.avatar.startsWith('data:image/')) {
                    mascot.avatar = saveBase64Image(mascot.avatar, mascotId, 'avatar', 'avatar');
                }

                // assets.outfits の処理
                if (mascot.assets && Array.isArray(mascot.assets.outfits)) {
                    for (const outfit of mascot.assets.outfits) {
                        if (outfit.path && outfit.path.startsWith('data:image/')) {
                            outfit.path = saveBase64Image(outfit.path, mascotId, 'outfits', outfit.id);
                        }
                    }
                }

                // assets.expressions の処理
                if (mascot.assets && Array.isArray(mascot.assets.expressions)) {
                    for (const expr of mascot.assets.expressions) {
                        if (expr.path && expr.path.startsWith('data:image/')) {
                            expr.path = saveBase64Image(expr.path, mascotId, 'expressions', expr.id);
                        }
                    }
                }

                // assets.poses の処理
                if (mascot.assets && Array.isArray(mascot.assets.poses)) {
                    for (const pose of mascot.assets.poses) {
                        if (pose.path && pose.path.startsWith('data:image/')) {
                            pose.path = saveBase64Image(pose.path, mascotId, 'poses', pose.id);
                        }
                    }
                }
            }
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 4), 'utf8');
        console.log('[Server] config.json saved successfully');
        return res.json({ success: true, config: newConfig });
    } catch (error: any) {
        console.error('[Server] Failed to save config:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
