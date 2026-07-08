/**
 * Node 用 ImageLoader アダプタ（テスト・サーバ用途）。
 * `canvas` npm パッケージでファイルパス / data URL / Buffer URL をデコードする。
 *
 * 既存実装のハードコードパス eval require を排除し、
 * 通常の import で canvas を解決する。
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadImage as canvasLoadImage, createCanvas } from 'canvas';
import type { ImageLoader } from '../src/image-input';
import type { RasterImage } from '../src/types';

export class NodeCanvasImageLoader implements ImageLoader {
    async load(source: string): Promise<RasterImage> {
        let img;
        if (typeof source === 'string' && !source.startsWith('data:')) {
            const buf = readFileSync(source);
            img = await canvasLoadImage(buf);
        } else {
            img = await canvasLoadImage(source);
        }
        const width = img.width;
        const height = img.height;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height);
        return {
            width,
            height,
            data: new Uint8ClampedArray(imageData.data),
        };
    }
}

/**
 * RasterImage を PNG ファイルとして書き出す（テストの目視確認用）。
 * 合成結果（golden-iou テスト）の synthesized 画像出力に使う。
 * 出力先ディレクトリは自動生成する。
 */
export function savePng(image: RasterImage, filePath: string): void {
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(image.width, image.height);
    imageData.data.set(image.data);
    ctx.putImageData(imageData, 0, 0);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, canvas.toBuffer('image/png'));
}
