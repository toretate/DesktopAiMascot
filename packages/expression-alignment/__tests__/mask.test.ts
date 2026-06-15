/**
 * step6: mask.ts テスト
 *
 * 1. ユニットテスト: applyEllipseFeatherMask（純粋ピクセル計算）
 * 2. ゴールデンテスト: estimateFaceMask + 楕円マスク IoU vs _trimmed.png
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEllipseFeatherMask, estimateFaceMask } from '../src/mask';
import { NodeCanvasImageLoader, savePng } from '../adapters/canvas-node';
import type { RasterImage, FaceMask } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const assetsDir = resolve(repoRoot, '__tests__/expression-alignment/assets');

// ---------------------------------------------------------------------------
// ユニットテスト: applyEllipseFeatherMask
// ---------------------------------------------------------------------------

/** 指定サイズの全ピクセル不透明な RasterImage を生成 */
function solidImage(w: number, h: number, r = 200, g = 150, b = 100): RasterImage {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = 255;
    }
    return { width: w, height: h, data };
}

describe('applyEllipseFeatherMask', () => {
    const W = 100, H = 100;
    const mask: FaceMask = { centerX: 50, centerY: 50, radiusX: 30, radiusY: 20, feather: 0 };

    it('中心ピクセルは不透明のまま', () => {
        const img = solidImage(W, H);
        const out = applyEllipseFeatherMask(img, mask);
        const i = (50 * W + 50) * 4;
        expect(out.data[i + 3]).toBe(255);
    });

    it('楕円の外側は完全透明になる', () => {
        const img = solidImage(W, H);
        const out = applyEllipseFeatherMask(img, mask);
        // 角 (0,0): d = sqrt((50/30)^2 + (50/20)^2) >> 1 → 透明
        expect(out.data[3]).toBe(0);
        // (0, 50): d = sqrt((50/30)^2 + 0) = 1.67 >> 1 → 透明
        const i2 = (50 * W + 0) * 4;
        expect(out.data[i2 + 3]).toBe(0);
    });

    it('楕円の内側は不透明のまま（feather=0 のハードエッジ）', () => {
        const img = solidImage(W, H);
        const out = applyEllipseFeatherMask(img, mask);
        // (50, 60): d = sqrt(0 + (10/20)^2) = 0.5 < 1 → 不透明
        const i = (60 * W + 50) * 4;
        expect(out.data[i + 3]).toBe(255);
    });

    it('feather > 0 のとき境界付近はアルファが中間値', () => {
        const softMask: FaceMask = { centerX: 50, centerY: 50, radiusX: 30, radiusY: 20, feather: 5 };
        const img = solidImage(W, H);
        const out = applyEllipseFeatherMask(img, softMask);
        // 楕円境界の内側フェザー帯にあるピクセル: 部分透明
        // (50, 68): cy+18 → d = 18/20 = 0.9 → フェザー帯内
        const i = (68 * W + 50) * 4;
        expect(out.data[i + 3]).toBeGreaterThan(0);
        expect(out.data[i + 3]).toBeLessThan(255);
    });

    it('既に透明なピクセルは変化しない', () => {
        const img = solidImage(W, H);
        // 中心を透明にしておく
        img.data[(50 * W + 50) * 4 + 3] = 0;
        const out = applyEllipseFeatherMask(img, mask);
        expect(out.data[(50 * W + 50) * 4 + 3]).toBe(0);
    });

    it('入力画像を変更しない（新しい配列を返す）', () => {
        const img = solidImage(W, H);
        const origAlpha = img.data[3];
        applyEllipseFeatherMask(img, mask);
        expect(img.data[3]).toBe(origAlpha); // 角 (0,0) は変更されていない
    });
});

// ---------------------------------------------------------------------------
// ゴールデンテスト: estimateFaceMask + 楕円マスク IoU vs _trimmed.png
// ---------------------------------------------------------------------------

const CASES_OUTFIT1 = [
    { em: '喜び', trimmed: 'expr_喜び_trimmed.png' },
    { em: '嫌悪', trimmed: 'expr_嫌悪_trimmed.png' },
    { em: '好奇心', trimmed: 'expr_好奇心_trimmed.png' },
    { em: '怒り', trimmed: 'expr_怒り_trimmed.png' },
    { em: '混乱', trimmed: 'expr_混乱_trimmed.png' },
] as const;

// outfit_2 の「好奇心」はファイル名が _trimed.png（1文字欠け）
const CASES_OUTFIT2 = [
    { em: '喜び', trimmed: 'expr_喜び_trimmed.png' },
    { em: '嫌悪', trimmed: 'expr_嫌悪_trimmed.png' },
    { em: '好奇心', trimmed: 'expr_好奇心_trimed.png' },
    { em: '怒り', trimmed: 'expr_怒り_trimmed.png' },
    { em: '混乱', trimmed: 'expr_混乱_trimmed.png' },
] as const;

let loader: NodeCanvasImageLoader;
const sprites1: Record<string, RasterImage> = {};
const trimmed1: Record<string, RasterImage> = {};
const sprites2: Record<string, RasterImage> = {};
const trimmed2: Record<string, RasterImage> = {};

beforeAll(async () => {
    loader = new NodeCanvasImageLoader();
    for (const c of CASES_OUTFIT1) {
        sprites1[c.em] = await loader.load(resolve(assetsDir, `outfit_1/expr_${c.em}.png`));
        trimmed1[c.em] = await loader.load(resolve(assetsDir, `outfit_1/${c.trimmed}`));
    }
    for (const c of CASES_OUTFIT2) {
        sprites2[c.em] = await loader.load(resolve(assetsDir, `outfit_2/expr_${c.em}.png`));
        trimmed2[c.em] = await loader.load(resolve(assetsDir, `outfit_2/${c.trimmed}`));
    }
});

/** α > 0 ピクセルを「有効」とした IoU */
function maskIoU(img1: RasterImage, img2: RasterImage): number {
    if (img1.width !== img2.width || img1.height !== img2.height) return 0;
    let intersection = 0;
    let union = 0;
    for (let i = 3; i < img1.data.length; i += 4) {
        const a = img1.data[i] > 0;
        const b = img2.data[i] > 0;
        if (a && b) intersection++;
        if (a || b) union++;
    }
    return union > 0 ? intersection / union : 0;
}

describe('estimateFaceMask + 楕円マスク IoU（outfit_1）', () => {
    for (const c of CASES_OUTFIT1) {
        it(`${c.em}: 楕円マスク IoU vs _trimmed.png > 0.60`, async () => {
            const sprite = sprites1[c.em];
            const trimmedImg = trimmed1[c.em];

            const faceMask = estimateFaceMask(sprite);
            console.log(
                `[outfit_1/${c.em}] cx=${faceMask.centerX.toFixed(1)} cy=${faceMask.centerY.toFixed(1)} rx=${faceMask.radiusX.toFixed(1)} ry=${faceMask.radiusY.toFixed(1)}`
            );

            const ellipseMasked = applyEllipseFeatherMask(sprite, faceMask);

            const resultDir = resolve(here, 'result/outfit_1');
            savePng(ellipseMasked, resolve(resultDir, `expr_${c.em}_ellipse_mask.png`));

            const iou = maskIoU(ellipseMasked, trimmedImg);
            console.log(`[outfit_1/${c.em}] ellipse maskIoU=${iou.toFixed(3)}`);

            expect(iou).toBeGreaterThan(0.60);
        });
    }
});

describe('estimateFaceMask + 楕円マスク IoU（outfit_2）', () => {
    for (const c of CASES_OUTFIT2) {
        it(`${c.em}: 楕円マスク IoU vs _trimmed.png > 0.60`, async () => {
            const sprite = sprites2[c.em];
            const trimmedImg = trimmed2[c.em];

            const faceMask = estimateFaceMask(sprite);
            console.log(
                `[outfit_2/${c.em}] cx=${faceMask.centerX.toFixed(1)} cy=${faceMask.centerY.toFixed(1)} rx=${faceMask.radiusX.toFixed(1)} ry=${faceMask.radiusY.toFixed(1)}`
            );

            const ellipseMasked = applyEllipseFeatherMask(sprite, faceMask);

            const resultDir = resolve(here, 'result/outfit_2');
            savePng(ellipseMasked, resolve(resultDir, `expr_${c.em}_ellipse_mask.png`));

            const iou = maskIoU(ellipseMasked, trimmedImg);
            console.log(`[outfit_2/${c.em}] ellipse maskIoU=${iou.toFixed(3)}`);

            expect(iou).toBeGreaterThan(0.60);
        });
    }
});
