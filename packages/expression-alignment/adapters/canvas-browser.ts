/**
 * ブラウザ / WebView 用 ImageLoader アダプタ。
 * Electron renderer・Web版・Capacitor/RN/Flutter+WebView の全プラットフォームで共用する。
 *
 * 画像を Image 要素で読み込み、Canvas に描画して RGBA を取り出す。
 */

import type { ImageLoader } from '../src/image-input';
import type { RasterImage } from '../src/types';

function loadHTMLImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // data URL / blob URL では不要だが、外部 URL に備えて付与
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = source;
    });
}

export class BrowserImageLoader implements ImageLoader {
    async load(source: string): Promise<RasterImage> {
        const img = await loadHTMLImage(source);
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('[expression-alignment] Canvas 2D コンテキストの取得に失敗しました');
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height);
        return {
            width,
            height,
            data: imageData.data,
        };
    }
}
