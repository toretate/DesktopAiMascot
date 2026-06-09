/**
 * step5: feature-island-detector テスト
 *
 * 1. ユニットテスト: crossCheckEyeMidpoint（純粋数値計算）
 * 2. ゴールデンテスト: detectEyeCenters（実 expr_*.png アセット）
 *    - 目ペアが検出できること
 *    - 眼間距離・Y位置・左右関係の幾何学的制約を満たすこと
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectEyeCenters, crossCheckEyeMidpoint } from '../src/feature-island-detector';
import { NodeCanvasImageLoader } from '../adapters/canvas-node';
import type { RasterImage } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const assetsDir = resolve(repoRoot, '__tests__/expression-alignment/assets');

// ---------------------------------------------------------------------------
// ユニットテスト: crossCheckEyeMidpoint
// ---------------------------------------------------------------------------

describe('crossCheckEyeMidpoint', () => {
    const eyeCenters = {
        left: { x: 50, y: 60 },
        right: { x: 110, y: 62 },
        midpoint: { x: 80, y: 61 },
        interocularDist: 60,
        confidence: 0.8,
    };

    it('drift=0 のとき 1.0 を返す', () => {
        expect(crossCheckEyeMidpoint(eyeCenters, { x: 80, y: 61 }, 20)).toBe(1.0);
    });

    it('drift >= tolerance のとき 0 を返す', () => {
        expect(crossCheckEyeMidpoint(eyeCenters, { x: 200, y: 61 }, 20)).toBe(0);
    });

    it('drift = tolerance/2 のとき 0.5 に近い値を返す', () => {
        // 眼間中点(80,61) から真横に 10px ずれた点 → drift=10, tolerance=20 → 0.5
        const result = crossCheckEyeMidpoint(eyeCenters, { x: 90, y: 61 }, 20);
        expect(result).toBeCloseTo(0.5, 5);
    });

    it('負値にはならない', () => {
        const result = crossCheckEyeMidpoint(eyeCenters, { x: 1000, y: 1000 }, 10);
        expect(result).toBeGreaterThanOrEqual(0);
    });
});

// ---------------------------------------------------------------------------
// ゴールデンテスト: detectEyeCenters (outfit_1, 5表情)
// ---------------------------------------------------------------------------

const EMOTIONS = ['喜び', '嫌悪', '好奇心', '怒り', '混乱'] as const;

let loader: NodeCanvasImageLoader;
const sprites: Partial<Record<string, RasterImage>> = {};

beforeAll(async () => {
    loader = new NodeCanvasImageLoader();
    for (const emotion of EMOTIONS) {
        const path = resolve(assetsDir, `outfit_1/expr_${emotion}.png`);
        sprites[emotion] = await loader.load(path);
    }
});

describe('detectEyeCenters - outfit_1', () => {
    for (const emotion of EMOTIONS) {
        describe(`emotion: ${emotion}`, () => {
            it('目ペアを検出できる（non-null）', () => {
                const sprite = sprites[emotion]!;
                const result = detectEyeCenters(sprite);
                expect(result).not.toBeNull();
            });

            it('left.x < right.x（左右順序が正しい）', () => {
                const sprite = sprites[emotion]!;
                const result = detectEyeCenters(sprite);
                expect(result).not.toBeNull();
                expect(result!.left.x).toBeLessThan(result!.right.x);
            });

            it('眼間距離がスプライト幅の 25〜75%', () => {
                const sprite = sprites[emotion]!;
                const result = detectEyeCenters(sprite);
                expect(result).not.toBeNull();
                expect(result!.interocularDist).toBeGreaterThan(sprite.width * 0.25);
                expect(result!.interocularDist).toBeLessThan(sprite.width * 0.75);
            });

            it('眼間中点 Y がスプライト高の 10〜60% の範囲', () => {
                const sprite = sprites[emotion]!;
                const result = detectEyeCenters(sprite);
                expect(result).not.toBeNull();
                expect(result!.midpoint.y).toBeGreaterThan(sprite.height * 0.10);
                expect(result!.midpoint.y).toBeLessThan(sprite.height * 0.60);
            });

            it('眼間中点 X がスプライト中央付近（中央 ±40%）', () => {
                const sprite = sprites[emotion]!;
                const result = detectEyeCenters(sprite);
                expect(result).not.toBeNull();
                const cx = sprite.width / 2;
                expect(Math.abs(result!.midpoint.x - cx)).toBeLessThan(cx * 0.8);
            });

            it('confidence > 0', () => {
                const sprite = sprites[emotion]!;
                const result = detectEyeCenters(sprite);
                expect(result).not.toBeNull();
                expect(result!.confidence).toBeGreaterThan(0);
            });
        });
    }
});
