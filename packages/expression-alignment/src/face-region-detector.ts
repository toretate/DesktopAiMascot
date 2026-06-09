/**
 * step2: ベース画像（衣装全身像）の顔領域検出。
 *
 * DOM 非依存版。`imageSource: string` + Canvas API を廃止し、
 * RasterImage のピクセルデータを直接走査するよう移植した。
 * detectFaceRegionWithAI（外部 API 依存）は step9 の UI 結線時に呼び出す。
 */

import type { RasterImage, BoundingBox } from './types';
import { colorDistance, detectBackgroundColor } from './content-bounds-detector';

/** 顔領域検出結果 */
export interface FaceDetectionResult {
    faceBox: BoundingBox;
    confidence: number;
    method: 'heuristic' | 'ai';
    characterBox: BoundingBox;
}

/** ヒューリスティック定数（キャラクターイラストの一般的な比率） */
export const FACE_HEURISTIC = {
    FACE_TOP_RATIO: 0.09,
    FACE_BOTTOM_RATIO: 0.35,
    FACE_WIDTH_RATIO: 0.50,
} as const;

/**
 * RasterImage ピクセルデータからキャラクター全体の非透明領域 BoundingBox を抽出する。
 * UI 版の extractCharacterBox（Canvas 依存）を DOM なしで再実装。
 */
function extractCharacterBox(image: RasterImage): BoundingBox {
    const { width, height, data } = image;
    const alphaThreshold = 10;

    const bgColor = detectBackgroundColor(data, width, height);

    const isValid = (x: number, y: number): boolean => {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] < alphaThreshold) return false;
        if (bgColor) {
            const dist = colorDistance(data[idx], data[idx + 1], data[idx + 2], bgColor[0], bgColor[1], bgColor[2]);
            if (dist < 10) return false;
        }
        return true;
    };

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (isValid(x, y)) { minY = y; found = true; break; }
        }
        if (found) break;
    }

    if (!found) return { top: 0, bottom: height, left: 0, right: width };

    found = false;
    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            if (isValid(x, y)) { maxY = y; found = true; break; }
        }
        if (found) break;
    }

    found = false;
    for (let x = 0; x < width; x++) {
        for (let y = minY; y <= maxY; y++) {
            if (isValid(x, y)) { minX = x; found = true; break; }
        }
        if (found) break;
    }

    found = false;
    for (let x = width - 1; x >= 0; x--) {
        for (let y = minY; y <= maxY; y++) {
            if (isValid(x, y)) { maxX = x; found = true; break; }
        }
        if (found) break;
    }

    if (maxX < minX || maxY < minY) return { top: 0, bottom: height, left: 0, right: width };

    return { top: minY, bottom: maxY, left: minX, right: maxX };
}

/**
 * キャラクターのバウンディングボックスから顔領域を推定する（純粋関数）。
 * 上端から FACE_TOP_RATIO〜FACE_BOTTOM_RATIO の範囲、横は中央 50% を顔と推定する。
 */
export function estimateFaceBox(characterBox: BoundingBox): BoundingBox {
    const charWidth = characterBox.right - characterBox.left;
    const charHeight = characterBox.bottom - characterBox.top;
    const charCenterX = characterBox.left + charWidth / 2;

    const faceTop = characterBox.top + charHeight * FACE_HEURISTIC.FACE_TOP_RATIO;
    const faceBottom = characterBox.top + charHeight * FACE_HEURISTIC.FACE_BOTTOM_RATIO;
    const faceWidth = charWidth * FACE_HEURISTIC.FACE_WIDTH_RATIO;

    return {
        top: Math.round(faceTop),
        bottom: Math.round(faceBottom),
        left: Math.round(charCenterX - faceWidth / 2),
        right: Math.round(charCenterX + faceWidth / 2),
    };
}

/**
 * ベース画像（衣装全身像）からヒューリスティックで顔領域を検出する。
 *
 * @param image ベース画像の RasterImage
 * @returns 顔領域の検出結果
 */
export function detectFaceRegion(image: RasterImage): FaceDetectionResult {
    const characterBox = extractCharacterBox(image);
    const faceBox = estimateFaceBox(characterBox);

    return {
        faceBox,
        confidence: 0.6,
        method: 'heuristic',
        characterBox,
    };
}
