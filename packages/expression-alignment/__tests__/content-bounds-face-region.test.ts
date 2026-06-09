/**
 * step2: content-bounds-detector.ts / face-region-detector.ts / alignment-calculator.ts
 *
 * ユニットテスト（DOM 非依存・pure pixel）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectContentBounds, colorDistance, detectBackgroundColor } from '../src/content-bounds-detector';
import { detectFaceRegion, estimateFaceBox, FACE_HEURISTIC } from '../src/face-region-detector';
import { calculateAlignment } from '../src/alignment-calculator';
import { NodeCanvasImageLoader } from '../adapters/canvas-node';
import type { RasterImage, BoundingBox } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const assetsDir = resolve(repoRoot, '__tests__/expression-alignment/assets');

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function solidImage(w: number, h: number, r = 200, g = 150, b = 100, a = 255): RasterImage {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = a;
    }
    return { width: w, height: h, data };
}

/** 中央 cw×ch だけ不透明、それ以外透明な画像 */
function centeredOpaqueImage(W: number, H: number, cw: number, ch: number): RasterImage {
    const data = new Uint8ClampedArray(W * H * 4);
    const x0 = Math.floor((W - cw) / 2);
    const y0 = Math.floor((H - ch) / 2);
    for (let y = y0; y < y0 + ch; y++) {
        for (let x = x0; x < x0 + cw; x++) {
            const i = (y * W + x) * 4;
            data[i] = 100; data[i + 1] = 150; data[i + 2] = 200; data[i + 3] = 255;
        }
    }
    return { width: W, height: H, data };
}

// ---------------------------------------------------------------------------
// colorDistance
// ---------------------------------------------------------------------------

describe('colorDistance', () => {
    it('同じ色は 0', () => {
        expect(colorDistance(100, 100, 100, 100, 100, 100)).toBe(0);
    });

    it('黒と白は約 441', () => {
        expect(colorDistance(0, 0, 0, 255, 255, 255)).toBeCloseTo(441.67, 1);
    });
});

// ---------------------------------------------------------------------------
// detectBackgroundColor
// ---------------------------------------------------------------------------

describe('detectBackgroundColor', () => {
    it('全ピクセル同色の画像は背景色を返す', () => {
        const img = solidImage(20, 20, 240, 240, 240);
        const bg = detectBackgroundColor(img.data, img.width, img.height);
        expect(bg).not.toBeNull();
        expect(bg![0]).toBeCloseTo(240, 0);
    });

    it('透明画像（全 α=0）は null を返す', () => {
        const img = solidImage(20, 20, 240, 240, 240, 0);
        const bg = detectBackgroundColor(img.data, img.width, img.height);
        expect(bg).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// detectContentBounds
// ---------------------------------------------------------------------------

describe('detectContentBounds', () => {
    it('中央の不透明領域を正しく検出する', () => {
        const W = 100, H = 100, cw = 60, ch = 50;
        const img = centeredOpaqueImage(W, H, cw, ch);
        const result = detectContentBounds(img);
        // 上端 20% (20px) は除外されるが、中央の上端 25px はその範囲に収まっている
        expect(result.contentWidth).toBeGreaterThan(0);
        expect(result.contentHeight).toBeGreaterThan(0);
    });

    it('全透明画像はフォールバックで画像全体を返す', () => {
        const img = solidImage(50, 50, 0, 0, 0, 0);
        const result = detectContentBounds(img);
        expect(result.imageWidth).toBe(50);
        expect(result.imageHeight).toBe(50);
        expect(result.box.top).toBe(0);
        expect(result.box.bottom).toBe(50);
    });

    it('全不透明画像の中心座標が画像中心付近', () => {
        const img = solidImage(100, 80);
        const result = detectContentBounds(img);
        // 下端 20% 除外後の上端は 0、下端は 64
        expect(result.centerX).toBeCloseTo(50, 0);
        // 下端 20% 除外あり
        expect(result.centerY).toBeLessThan(80);
    });
});

// ---------------------------------------------------------------------------
// estimateFaceBox
// ---------------------------------------------------------------------------

describe('estimateFaceBox', () => {
    it('キャラクターボックスから顔ボックスを推定する', () => {
        const charBox: BoundingBox = { top: 0, bottom: 400, left: 50, right: 250 };
        const faceBox = estimateFaceBox(charBox);
        // Y 方向: 0 + 400*0.09=36 〜 0 + 400*0.35=140
        expect(faceBox.top).toBe(36);
        expect(faceBox.bottom).toBe(140);
        // X 方向: 幅 200 の中央 100 から ±50
        expect(faceBox.left).toBe(100);
        expect(faceBox.right).toBe(200);
    });

    it('FACE_HEURISTIC 定数が正しい値', () => {
        expect(FACE_HEURISTIC.FACE_TOP_RATIO).toBe(0.09);
        expect(FACE_HEURISTIC.FACE_BOTTOM_RATIO).toBe(0.35);
        expect(FACE_HEURISTIC.FACE_WIDTH_RATIO).toBe(0.50);
    });
});

// ---------------------------------------------------------------------------
// detectFaceRegion（ゴールデンテスト: outfit_1 ベース画像）
// ---------------------------------------------------------------------------

describe('detectFaceRegion（outfit_1 ベース画像）', () => {
    let loader: NodeCanvasImageLoader;
    let baseImage: RasterImage;

    beforeAll(async () => {
        loader = new NodeCanvasImageLoader();
        baseImage = await loader.load(resolve(assetsDir, 'outfit_1/outfit_1.png'));
    });

    it('characterBox が画像全体より小さい（キャラクター領域を検出）', () => {
        const result = detectFaceRegion(baseImage);
        const charBox = result.characterBox;
        expect(charBox.top).toBeGreaterThan(0);
        expect(charBox.bottom).toBeLessThan(baseImage.height);
    });

    it('faceBox がキャラクターボックス内に収まる', () => {
        const result = detectFaceRegion(baseImage);
        expect(result.faceBox.top).toBeGreaterThanOrEqual(result.characterBox.top);
        expect(result.faceBox.bottom).toBeLessThanOrEqual(result.characterBox.bottom);
    });

    it('confidence は 0.6', () => {
        const result = detectFaceRegion(baseImage);
        expect(result.confidence).toBe(0.6);
    });
});

// ---------------------------------------------------------------------------
// calculateAlignment（ユニットテスト）
// ---------------------------------------------------------------------------

describe('calculateAlignment', () => {
    const faceDetection = {
        faceBox: { top: 50, bottom: 150, left: 100, right: 300 },
        confidence: 0.6,
        method: 'heuristic' as const,
        characterBox: { top: 0, bottom: 400, left: 50, right: 350 },
    };
    const contentBounds = {
        box: { top: 10, bottom: 110, left: 10, right: 110 },
        imageWidth: 120,
        imageHeight: 120,
        centerX: 60,
        centerY: 60,
        contentWidth: 100,
        contentHeight: 100,
        detectedBackgroundColor: null,
    };
    const baseImageSize = { width: 420, height: 560 };

    it('結果に offsetX / offsetY / scale が含まれる', () => {
        const result = calculateAlignment(faceDetection, contentBounds, baseImageSize);
        expect(typeof result.offsetX).toBe('number');
        expect(typeof result.offsetY).toBe('number');
        expect(typeof result.scale).toBe('number');
    });

    it('scale は SCALE_MIN〜SCALE_MAX の範囲内', () => {
        const result = calculateAlignment(faceDetection, contentBounds, baseImageSize);
        expect(result.scale).toBeGreaterThanOrEqual(0.3);
        expect(result.scale).toBeLessThanOrEqual(2.0);
    });

    it('overrideScale を渡すと scale がそれになる', () => {
        const result = calculateAlignment(faceDetection, contentBounds, baseImageSize, undefined, undefined, null, 1.5);
        expect(result.scale).toBe(1.5);
    });
});
