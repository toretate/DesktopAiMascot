import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { removeBackground } from '../services/remove-bg-service';

const router = Router();

// マスコットのアセットディレクトリ（ルートの mascots）へのパスを安全に解決
const MASCOTS_DIR = path.join(__dirname, '../../../mascots');

router.post('/remove-background', async (req, res) => {
    try {
        const { imagePath, mascotId, engine } = req.body;
        console.log(`[Server] Background removal request received for mascot: ${mascotId}, engine: ${engine}`);

        if (!imagePath) {
            return res.status(400).json({ success: false, error: 'imagePath is required' });
        }

        let inputBuffer: Buffer;
        let mimeType = 'image/png';

        if (imagePath.startsWith('data:image/')) {
            // Base64 DataURL → Buffer → Blob に変換して渡す
            const matches = imagePath.match(/^data:([a-zA-Z+/]+);base64,(.+)$/s);
            if (!matches || matches.length < 3) {
                return res.status(400).json({ success: false, error: 'Invalid data URL format' });
            }
            mimeType = matches[1];
            const base64Data = matches[2];
            inputBuffer = Buffer.from(base64Data, 'base64');
            console.log(`[Server] DataURL converted to Buffer (mimeType: ${mimeType}, size: ${inputBuffer.length} bytes)`);
        } else if (imagePath.startsWith('/mascots/')) {
            // サーバー静的ファイルパスからファイルを直接読み込む
            const filePath = path.join(MASCOTS_DIR, imagePath.replace('/mascots/', ''));
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ success: false, error: `File not found: ${filePath}` });
            }
            inputBuffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).replace('.', '').replace('jpg', 'jpeg');
            mimeType = `image/${ext}`;
            console.log(`[Server] File loaded as Buffer: ${filePath}`);
        } else {
            return res.status(400).json({ success: false, error: 'Unsupported image source format' });
        }

        console.log(`[Server] Processing background removal using engine: ${engine}...`);

        const outputBuffer = await removeBackground(inputBuffer, mimeType, engine);
        const base64Image = `data:image/png;base64,${outputBuffer.toString('base64')}`;

        console.log(`[Server] Background removal complete. Sending result...`);
        return res.json({ success: true, image: base64Image });
    } catch (error: any) {
        console.error('[Server] Background removal failed:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
