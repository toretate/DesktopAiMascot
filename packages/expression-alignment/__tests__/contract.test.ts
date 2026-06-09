/**
 * スキャフォルドのスモークテスト。
 * - 純粋ユーティリティ（clamp / 定数）の動作
 * - Node アダプタが実アセットを RasterImage にデコードできること
 * - solveTransform 骨格が NotImplementedError を投げること（現状の明示）
 *
 * 実画像 IoU 回帰テスト（golden-iou.test.ts）は solveTransform 実装後に追加する（仕様書 第12章 step7）。
 */

import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { clamp, ALIGNMENT_CONSTANTS, solveTransform, NotImplementedError } from '../src/index';
import type { RasterImage } from '../src/index';
import { NodeCanvasImageLoader, savePng } from '../adapters/canvas-node';

const here = dirname(fileURLToPath(import.meta.url));
// packages/expression-alignment/__tests__ → リポジトリルート
const repoRoot = resolve(here, '../../..');
const baseImagePath = resolve(repoRoot, '__tests__/expression-alignment/assets/outfit_1/outfit_1.png');
// 合成・目視確認用の画像出力先（gitignore 済み）
const resultDir = resolve(here, 'result');

describe('純粋ユーティリティ', () => {
    it('clamp が範囲内に収める', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-3, 0, 10)).toBe(0);
        expect(clamp(99, 0, 10)).toBe(10);
    });

    it('クランプ定数が仕様どおり', () => {
        expect(ALIGNMENT_CONSTANTS.SCALE_MIN).toBe(0.3);
        expect(ALIGNMENT_CONSTANTS.SCALE_MAX).toBe(2.0);
        expect(ALIGNMENT_CONSTANTS.OFFSET_MIN).toBe(-250);
        expect(ALIGNMENT_CONSTANTS.OFFSET_MAX).toBe(250);
    });
});

describe('NodeCanvasImageLoader', () => {
    it('実アセットを RGBA の RasterImage にデコードできる', async () => {
        // アセットが存在しない環境ではスキップ（CI 構成により配置が変わる可能性に配慮）
        if (!existsSync(baseImagePath)) {
            console.warn(`[contract.test] アセット未配置のためスキップ: ${baseImagePath}`);
            return;
        }
        const loader = new NodeCanvasImageLoader();
        const img: RasterImage = await loader.load(baseImagePath);
        expect(img.width).toBeGreaterThan(0);
        expect(img.height).toBeGreaterThan(0);
        expect(img.data.length).toBe(img.width * img.height * 4);
    });
});

describe('PNG 出力（合成結果の目視確認基盤）', () => {
    it('RasterImage を PNG として result/ に書き出し、再読込で同寸になる', async () => {
        // solveTransform 実装後は「合成結果(synthesized)」をここに出力する（golden-iou テスト）。
        // 現段階では出力経路が機能することを担保する。
        const width = 32;
        const height = 24;
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
            data[i * 4] = (i * 7) % 256; // R
            data[i * 4 + 1] = (i * 13) % 256; // G
            data[i * 4 + 2] = (i * 23) % 256; // B
            data[i * 4 + 3] = 255; // A
        }
        const img: RasterImage = { width, height, data };

        const outPath = resolve(resultDir, 'png-output-smoke.png');
        savePng(img, outPath);
        expect(existsSync(outPath)).toBe(true);

        const reloaded = await new NodeCanvasImageLoader().load(outPath);
        expect(reloaded.width).toBe(width);
        expect(reloaded.height).toBe(height);
    });
});

describe('solveTransform（骨格）', () => {
    it('本体未実装のため NotImplementedError を投げる', async () => {
        const dummy: RasterImage = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
        await expect(solveTransform({ baseImage: dummy, sprite: dummy })).rejects.toBeInstanceOf(
            NotImplementedError
        );
    });

    it('baseImage / sprite が欠けると検証エラー', async () => {
        // @ts-expect-error 必須引数欠落の検証
        await expect(solveTransform({})).rejects.toThrow(/必須/);
    });
});
