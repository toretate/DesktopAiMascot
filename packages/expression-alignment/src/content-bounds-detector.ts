/**
 * step2: 表情画像の有効領域（非透明・非背景ピクセル）のバウンディングボックス検出。
 *
 * DOM 非依存版。`imageSource: string` ではなく `RasterImage` を直接受け取ることで
 * document.createElement('canvas') / eval require を完全に排除している。
 */

import type { RasterImage, BoundingBox } from './types';

/** 有効領域の検出結果 */
export interface ContentBounds {
    box: BoundingBox;
    imageWidth: number;
    imageHeight: number;
    centerX: number;
    centerY: number;
    contentWidth: number;
    contentHeight: number;
    detectedBackgroundColor: [number, number, number] | null;
}

/** 2色間のユークリッド距離（色差） */
export function colorDistance(
    r1: number, g1: number, b1: number,
    r2: number, g2: number, b2: number
): number {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * 画像四隅のピクセルをサンプリングして背景色を自動検出する。
 * 四隅の少なくとも 3 つで均一な色が検出された場合にその平均色を返す。
 */
export function detectBackgroundColor(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    sampleSize: number = 5
): [number, number, number] | null {
    if (width < sampleSize * 2 || height < sampleSize * 2) return null;

    const corners = [
        { startX: 0, startY: 0 },
        { startX: width - sampleSize, startY: 0 },
        { startX: 0, startY: height - sampleSize },
        { startX: width - sampleSize, startY: height - sampleSize },
    ];

    const cornerColors: Array<{ r: number; g: number; b: number }> = [];

    for (const corner of corners) {
        let totalR = 0, totalG = 0, totalB = 0, count = 0;
        for (let y = corner.startY; y < corner.startY + sampleSize && y < height; y++) {
            for (let x = corner.startX; x < corner.startX + sampleSize && x < width; x++) {
                const idx = (y * width + x) * 4;
                if (data[idx + 3] < 10) continue;
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
            });
        }
    }

    if (cornerColors.length < 3) return null;

    const avgR = Math.round(cornerColors.reduce((s, c) => s + c.r, 0) / cornerColors.length);
    const avgG = Math.round(cornerColors.reduce((s, c) => s + c.g, 0) / cornerColors.length);
    const avgB = Math.round(cornerColors.reduce((s, c) => s + c.b, 0) / cornerColors.length);

    for (const c of cornerColors) {
        if (colorDistance(c.r, c.g, c.b, avgR, avgG, avgB) > 40) return null;
    }

    return [avgR, avgG, avgB];
}

/**
 * RasterImage から有効領域（非透明・非背景）のバウンディングボックスを検出する。
 *
 * 下端 20% はラベル・枠線等を含むため走査対象外とする。
 */
export function detectContentBounds(
    image: RasterImage,
    backgroundColorThreshold: number = 30,
    alphaThreshold: number = 10
): ContentBounds {
    const { width, height, data } = image;

    const bgColor = detectBackgroundColor(data, width, height);

    const ignoreBottomHeight = Math.round(height * 0.20);
    const scanHeight = height - ignoreBottomHeight;

    const isValidPixel = (x: number, y: number): boolean => {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] < alphaThreshold) return false;
        if (bgColor) {
            const dist = colorDistance(data[idx], data[idx + 1], data[idx + 2], bgColor[0], bgColor[1], bgColor[2]);
            if (dist < backgroundColorThreshold && data[idx + 3] > 240) return false;
        }
        return true;
    };

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let found = false;

    for (let y = 0; y < scanHeight; y++) {
        for (let x = 0; x < width; x++) {
            if (isValidPixel(x, y)) { minY = y; found = true; break; }
        }
        if (found) break;
    }

    if (found) {
        found = false;
        for (let y = scanHeight - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                if (isValidPixel(x, y)) { maxY = y; found = true; break; }
            }
            if (found) break;
        }

        found = false;
        for (let x = 0; x < width; x++) {
            for (let y = minY; y <= maxY; y++) {
                if (isValidPixel(x, y)) { minX = x; found = true; break; }
            }
            if (found) break;
        }

        found = false;
        for (let x = width - 1; x >= 0; x--) {
            for (let y = minY; y <= maxY; y++) {
                if (isValidPixel(x, y)) { maxX = x; found = true; break; }
            }
            if (found) break;
        }
    }

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
