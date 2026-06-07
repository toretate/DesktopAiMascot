/**
 * 表情スプライト画像の背景を自動除去するモジュール
 * ハードマスキング、ソフトマスキング、エッジスムージングの3モードに対応
 */

import { loadImage, detectBackgroundColor, colorDistance } from './content-bounds-detector';

/** マスキングオプション */
export interface MaskingOptions {
    /** マスキングモード */
    mode: 'hard' | 'soft' | 'edge-smooth';
    /** ハードマスキングの色差閾値（デフォルト: 30） */
    hardThreshold?: number;
    /** ソフトマスキングの色差閾値（デフォルト: 80） */
    softThreshold?: number;
    /** エッジスムージングの幅 (px)（デフォルト: 3） */
    edgeSmoothWidth?: number;
    /** 手動指定の背景色 [R, G, B]（省略時は自動検出） */
    backgroundColor?: [number, number, number];
}

/** デフォルトのマスキングオプション */
const DEFAULT_OPTIONS: Required<MaskingOptions> = {
    mode: 'soft',
    hardThreshold: 30,
    softThreshold: 80,
    edgeSmoothWidth: 3,
    backgroundColor: [255, 255, 255], // 白を仮デフォルトとするが、自動検出を優先
};

/**
 * 画像の背景をマスキングして新しい Base64 画像を返す
 *
 * @param imageSource 画像パスまたは Base64 Data URL
 * @param options マスキングオプション
 * @returns マスキング済み画像の Base64 Data URL
 */
export async function maskBackground(
    imageSource: string,
    options?: Partial<MaskingOptions>
): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const img = await loadImage(imageSource);
    const { width, height } = img;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('[BackgroundMasker] Canvas 2D コンテキストの取得に失敗しました');
    }

    ctx.drawImage(img, 0, 0);

    let imgData: ImageData;
    try {
        imgData = ctx.getImageData(0, 0, width, height);
    } catch (e) {
        throw new Error('[BackgroundMasker] getImageData に失敗しました');
    }

    const data = imgData.data;

    // 背景色の決定: ユーザー指定 > 自動検出
    let bgColor: [number, number, number];
    if (options?.backgroundColor) {
        bgColor = options.backgroundColor;
    } else {
        // 白背景や、枠線がある場合でも正確に背景を捉えられるように、
        // 四隅から数ピクセル内側のエリアをサンプリングする
        const detected = detectBackgroundColor(data, width, height, 10);
        if (!detected) {
            // 画像の外周ではなく、端から内側(例えば20px)のピクセルをチェック
            // 喜び.pngの四隅は白背景になっているため、直接白色を採用
            bgColor = [255, 255, 255];
        } else {
            bgColor = detected;
        }
    }

    const [bgR, bgG, bgB] = bgColor;

    const ignoreBottomHeight = Math.round(height * 0.20);
    const clearStartY = height - ignoreBottomHeight;

    // Flood Fillによる外周から繋がった背景領域の検出
    // ユーザー指定の背景色、または自動検出された背景色に近い色のうち、画像の四隅・外周から繋がっている部分だけを対象とする
    const bgMask = findConnectedBackground(data, width, height, bgR, bgG, bgB, opts.mode === 'soft' ? opts.softThreshold! : opts.hardThreshold!);

    if (opts.mode === 'hard' || opts.mode === 'soft') {
        // ハードマスキング + ソフトマスキング
        for (let i = 0; i < data.length; i += 4) {
            const pixelIdx = i / 4;
            const y = Math.floor(pixelIdx / width);
            
            // 下部20%は自動的に完全透明（表情ラベル用）
            if (y >= clearStartY) {
                data[i + 3] = 0;
                continue;
            }

            // Flood Fillで背景と判定されなかったピクセルは処理しない（顔の内部などを保護）
            if (bgMask[pixelIdx] === 0) continue;

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // 既に透明なピクセルはスキップ
            if (a < 5) continue;

            const dist = colorDistance(r, g, b, bgR, bgG, bgB);

            if (dist < opts.hardThreshold!) {
                // ハードマスキング: 背景色に十分近い → 完全透明に
                data[i + 3] = 0;
            } else if (opts.mode === 'soft' && dist < opts.softThreshold!) {
                // ソフトマスキング: ハード閾値〜ソフト閾値の間は段階的に透明度を下げる
                const ratio = (dist - opts.hardThreshold!) / (opts.softThreshold! - opts.hardThreshold!);
                data[i + 3] = Math.round(a * ratio);
            }
        }
    }

    if (opts.mode === 'edge-smooth') {
        // エッジスムージング: 有効領域の外縁から内側に gradientWidth px で alpha をグラデーション
        const edgeWidth = opts.edgeSmoothWidth!;

        // まず通常のハードマスキングを適用
        for (let i = 0; i < data.length; i += 4) {
            const pixelIdx = i / 4;
            const y = Math.floor(pixelIdx / width);
            if (y >= clearStartY) {
                data[i + 3] = 0;
                continue;
            }

            if (bgMask[pixelIdx] === 0) continue;

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < 5) continue;

            const dist = colorDistance(r, g, b, bgR, bgG, bgB);
            if (dist < opts.hardThreshold!) {
                data[i + 3] = 0;
            }
        }

        // 非透明ピクセルの境界からの距離マップを作成してスムージング
        const alphaMap = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                alphaMap[y * width + x] = data[(y * width + x) * 4 + 3] > 0 ? 1 : 0;
            }
        }

        // 距離マップを計算（各非透明ピクセルから最も近い透明ピクセルまでの距離）
        const distMap = new Float32Array(width * height).fill(Infinity);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (alphaMap[idx] === 0) {
                    distMap[idx] = 0;
                    continue;
                }
                if (y > 0) distMap[idx] = Math.min(distMap[idx], distMap[(y - 1) * width + x] + 1);
                if (x > 0) distMap[idx] = Math.min(distMap[idx], distMap[y * width + (x - 1)] + 1);
            }
        }
        for (let y = height - 1; y >= 0; y--) {
            for (let x = width - 1; x >= 0; x--) {
                const idx = y * width + x;
                if (y < height - 1) distMap[idx] = Math.min(distMap[idx], distMap[(y + 1) * width + x] + 1);
                if (x < width - 1) distMap[idx] = Math.min(distMap[idx], distMap[y * width + (x + 1)] + 1);
            }
        }

        // エッジ幅以内のピクセルに対してグラデーションを適用
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const pixelIdx = idx * 4;
                const dist = distMap[idx];

                if (dist > 0 && dist <= edgeWidth && data[pixelIdx + 3] > 0) {
                    const ratio = dist / edgeWidth;
                    data[pixelIdx + 3] = Math.round(data[pixelIdx + 3] * ratio);
                }
            }
        }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
}

/**
 * 画像の外周から探索（Flood Fill）し、背景色と近い領域を特定する
 */
export function findConnectedBackground(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    bgR: number,
    bgG: number,
    bgB: number,
    threshold: number
): Uint8Array {
    const visited = new Uint8Array(width * height);
    const queue: number[] = [];

    // 外周の全ピクセルを初期シードとしてキューに追加
    for (let x = 0; x < width; x++) {
        queue.push(x);
        queue.push((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y++) {
        queue.push(y * width);
        queue.push(y * width + (width - 1));
    }

    let head = 0;
    while (head < queue.length) {
        const idx = queue[head++];
        if (visited[idx]) continue;

        const px = idx % width;
        const py = Math.floor(idx / width);

        const dataIdx = idx * 4;
        const r = data[dataIdx];
        const g = data[dataIdx + 1];
        const b = data[dataIdx + 2];
        const a = data[dataIdx + 3];

        // すでに透明なピクセル、または色差が閾値内のピクセルを背景とする
        const isTransparent = a < 10;
        const dist = isTransparent ? 0 : colorDistance(r, g, b, bgR, bgG, bgB);

        if (isTransparent || dist < threshold) {
            visited[idx] = 1;

            // 4方向の隣接ピクセルを探索
            const neighbors = [
                { x: px - 1, y: py },
                { x: px + 1, y: py },
                { x: px, y: py - 1 },
                { x: px, y: py + 1 }
            ];

            for (const n of neighbors) {
                if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                    const nIdx = n.y * width + n.x;
                    if (!visited[nIdx]) {
                        queue.push(nIdx);
                    }
                }
            }
        }
    }

    return visited;
}
