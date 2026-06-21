/**
 * 表情画像の有効領域（非透明・非背景ピクセル）のバウンディングボックスを検出するモジュール
 */

/** バウンディングボックス */
export interface BoundingBox {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/** 有効領域の検出結果 */
export interface ContentBounds {
    /** バウンディングボックス (px) */
    box: BoundingBox;
    /** 画像の幅 (px) */
    imageWidth: number;
    /** 画像の高さ (px) */
    imageHeight: number;
    /** 有効領域の中心X (px) */
    centerX: number;
    /** 有効領域の中心Y (px) */
    centerY: number;
    /** 有効領域の幅 (px) */
    contentWidth: number;
    /** 有効領域の高さ (px) */
    contentHeight: number;
    /** 自動検出された背景色 [R, G, B]。検出不能の場合は null */
    detectedBackgroundColor: [number, number, number] | null;
}

/**
 * 2色間のユークリッド距離（色差）を計算する
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * 画像四隅のピクセルをサンプリングして背景色を自動検出する
 *
 * @param data ImageData のピクセルデータ (RGBA)
 * @param width 画像幅
 * @param height 画像高さ
 * @param sampleSize サンプリング領域のサイズ（デフォルト: 5px）
 * @returns 背景色 [R, G, B]。検出不能の場合は null
 */
function detectBackgroundColor(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    sampleSize: number = 5
): [number, number, number] | null {
    if (width < sampleSize * 2 || height < sampleSize * 2) {
        return null;
    }

    // 四隅の領域を定義
    const corners = [
        { startX: 0, startY: 0 },                                             // 左上
        { startX: width - sampleSize, startY: 0 },                           // 右上
        { startX: 0, startY: height - sampleSize },                          // 左下
        { startX: width - sampleSize, startY: height - sampleSize },          // 右下
    ];

    const cornerColors: Array<{ r: number; g: number; b: number; count: number }> = [];

    for (const corner of corners) {
        let totalR = 0, totalG = 0, totalB = 0;
        let count = 0;

        for (let y = corner.startY; y < corner.startY + sampleSize && y < height; y++) {
            for (let x = corner.startX; x < corner.startX + sampleSize && x < width; x++) {
                const idx = (y * width + x) * 4;
                const alpha = data[idx + 3];
                // 完全に透明なピクセルはスキップ
                if (alpha < 10) continue;
                totalR += data[idx];
                totalG += data[idx + 1];
                totalB += data[idx + 2];
                count++;
            }
        }

        if (count > 0) {
            cornerColors.push({
                r: Math.round(totalR / count),
                g: Math.round(totalG / count),
                b: Math.round(totalB / count),
                count,
            });
        }
    }

    // 四隅のうち少なくとも3つで色がサンプリングできた場合に背景色として採用
    if (cornerColors.length < 3) {
        return null;
    }

    // 全隅の平均色を算出
    const avgR = Math.round(cornerColors.reduce((s, c) => s + c.r, 0) / cornerColors.length);
    const avgG = Math.round(cornerColors.reduce((s, c) => s + c.g, 0) / cornerColors.length);
    const avgB = Math.round(cornerColors.reduce((s, c) => s + c.b, 0) / cornerColors.length);

    // 各隅と平均色の色差が閾値以内であることを確認（一致度チェック）
    const maxCornerDeviation = 40;
    for (const c of cornerColors) {
        if (colorDistance(c.r, c.g, c.b, avgR, avgG, avgB) > maxCornerDeviation) {
            // 隅の色がバラバラ → 背景色を特定できない
            return null;
        }
    }

    return [avgR, avgG, avgB];
}

/**
 * 画像の有効領域（非透明・非背景のバウンディングボックス）を検出する。
 * ブラウザの Canvas API を使用する。
 *
 * @param imageSource 画像パスまたは Base64 Data URL
 * @param backgroundColorThreshold 背景色との色差閾値（デフォルト: 30）
 * @param alphaThreshold 透明判定の alpha 閾値（デフォルト: 10）
 */
export async function detectContentBounds(
    imageSource: string,
    backgroundColorThreshold: number = 30,
    alphaThreshold: number = 10
): Promise<ContentBounds> {
    const img = await loadImage(imageSource);
    const { width, height } = img;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('[ContentBoundsDetector] Canvas 2D コンテキストの取得に失敗しました');
    }

    ctx.drawImage(img, 0, 0);

    let imgData: ImageData;
    try {
        imgData = ctx.getImageData(0, 0, width, height);
    } catch (e) {
        throw new Error('[ContentBoundsDetector] getImageData に失敗しました（CORS制約の可能性）');
    }

    const data = imgData.data;

    // 背景色の自動検出
    const bgColor = detectBackgroundColor(data, width, height);

    const ignoreBottomHeight = Math.round(height * 0.20);
    const scanHeight = height - ignoreBottomHeight;

    const isValidPixel = (x: number, y: number): boolean => {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        if (a < alphaThreshold) return false;
        if (bgColor) {
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const dist = colorDistance(r, g, b, bgColor[0], bgColor[1], bgColor[2]);
            if (dist < backgroundColorThreshold && a > 240) {
                return false;
            }
        }
        return true;
    };

    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    let found = false;
    // 1. minY を検出 (上から下へスキャン)
    for (let y = 0; y < scanHeight; y++) {
        for (let x = 0; x < width; x++) {
            if (isValidPixel(x, y)) {
                minY = y;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (found) {
        // 2. maxY を検出 (下から上へスキャン)
        found = false;
        for (let y = scanHeight - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                if (isValidPixel(x, y)) {
                    maxY = y;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        // 3. minX を検出 (左から右へスキャン)
        found = false;
        for (let x = 0; x < width; x++) {
            for (let y = minY; y <= maxY; y++) {
                if (isValidPixel(x, y)) {
                    minX = x;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }

        // 4. maxX を検出 (右から左へスキャン)
        found = false;
        for (let x = width - 1; x >= 0; x--) {
            for (let y = minY; y <= maxY; y++) {
                if (isValidPixel(x, y)) {
                    maxX = x;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }

    // 有効ピクセルが見つからなかった場合は画像全体をフォールバック
    if (maxX < minX || maxY < minY) {
        return {
            box: { top: 0, bottom: height, left: 0, right: width },
            imageWidth: width,
            imageHeight: height,
            centerX: width / 2,
            centerY: height / 2,
            contentWidth: width,
            contentHeight: height,
            detectedBackgroundColor: bgColor,
        };
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    return {
        box: { top: minY, bottom: maxY, left: minX, right: maxX },
        imageWidth: width,
        imageHeight: height,
        centerX: minX + contentWidth / 2,
        centerY: minY + contentHeight / 2,
        contentWidth,
        contentHeight,
        detectedBackgroundColor: bgColor,
    };
}

/**
 * 画像ソースから HTMLImageElement を読み込むユーティリティ
 */
export function loadImage(imageSource: string): Promise<HTMLImageElement> {
    // Vitest テスト環境の場合、JSDOM の Image ローダーは遅くハングしやすいため、
    // Node の canvas パッケージから Image を読み込んで使用します。
    if (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) {
        try {
            const { Image: NodeImage } = eval("require('c:\\\\workspace\\\\workspace-win\\\\DesktopAiMascot\\\\ui\\\\node_modules\\\\canvas')");
            return new Promise((resolve, reject) => {
                const img = new NodeImage();
                img.onload = () => resolve(img as any);
                img.onerror = (e: any) => reject(e);
                img.src = imageSource;
            });
        } catch (err) {
            console.warn('[ContentBoundsDetector] Test env Node canvas Image loading failed, falling back to window.Image:', err);
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`[ContentBoundsDetector] 画像の読み込みに失敗しました: ${imageSource.substring(0, 80)}`));
        img.src = imageSource;
    });
}

/**
 * colorDistance をテスト用に公開するエクスポート
 */
export { colorDistance, detectBackgroundColor };
