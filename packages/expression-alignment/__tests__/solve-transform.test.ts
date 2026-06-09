/**
 * step3 ユニットテスト（画像なし・対応点を直接入力）。
 * - 相似変換の最小二乗推定（scale/rotation/translation の復元）
 * - scale/rotation 固定の平行移動推定
 * - solveTransform の A/B 分離・2モード分岐・confidence
 */

import { describe, it, expect } from 'vitest';
import {
    estimateSimilarityTransform,
    estimateTranslation,
    applyTransform,
    residualRms,
    solveTransform,
    type PointPair,
    type Point,
    type RasterImage,
    type RegistrationProvider,
    type SimilarityTransform,
    type SharedTransform,
} from '../src/index';

const DEG = 180 / Math.PI;

/** 既知の相似変換で src → dst を生成する */
function makePairs(srcPoints: Point[], t: SimilarityTransform): PointPair[] {
    return srcPoints.map((src) => ({ src, dst: applyTransform(t, src) }));
}

/** images に依存しないモック RegistrationProvider */
function mockRegistration(pairs: PointPair[], inlierRatio = 1): RegistrationProvider {
    return {
        async register() {
            return { pairs, inlierRatio };
        },
    };
}

const dummy: RasterImage = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
const SRC: Point[] = [
    { x: 10, y: 20 },
    { x: 80, y: 30 },
    { x: 40, y: 90 },
    { x: 120, y: 110 },
];

describe('estimateSimilarityTransform', () => {
    it('既知の scale/rotation/translation を復元する', () => {
        const truth: SimilarityTransform = { scale: 1.5, rotation: 20, tx: 30, ty: -10 };
        const pairs = makePairs(SRC, truth);
        const est = estimateSimilarityTransform(pairs);
        expect(est.scale).toBeCloseTo(1.5, 6);
        expect(est.rotation).toBeCloseTo(20, 6);
        expect(est.tx).toBeCloseTo(30, 6);
        expect(est.ty).toBeCloseTo(-10, 6);
        expect(residualRms(est, pairs)).toBeCloseTo(0, 6);
    });

    it('純粋な拡大（回転・移動なし）も解ける', () => {
        const truth: SimilarityTransform = { scale: 2, rotation: 0, tx: 0, ty: 0 };
        const est = estimateSimilarityTransform(makePairs(SRC, truth));
        expect(est.scale).toBeCloseTo(2, 6);
        expect(est.rotation).toBeCloseTo(0, 6);
    });

    it('ノイズがあっても最小二乗で近い値になり残差は有限', () => {
        const truth: SimilarityTransform = { scale: 1.0, rotation: 0, tx: 0, ty: 0 };
        const pairs = makePairs(SRC, truth);
        pairs[0].dst.x += 2; // 微小ノイズ
        pairs[1].dst.y -= 2;
        const est = estimateSimilarityTransform(pairs);
        expect(est.scale).toBeCloseTo(1.0, 1);
        expect(residualRms(est, pairs)).toBeGreaterThan(0);
    });

    it('2 点未満は例外', () => {
        expect(() => estimateSimilarityTransform([{ src: SRC[0], dst: SRC[0] }])).toThrow(/2 点以上/);
    });
});

describe('estimateTranslation', () => {
    it('scale/rotation を固定して平行移動のみ復元する', () => {
        const truth: SimilarityTransform = { scale: 1.5, rotation: 20, tx: 30, ty: -10 };
        const pairs = makePairs(SRC, truth);
        const { tx, ty } = estimateTranslation(pairs, 1.5, 20);
        expect(tx).toBeCloseTo(30, 6);
        expect(ty).toBeCloseTo(-10, 6);
    });
});

describe('solveTransform: A 確立モード（sharedTransform なし）', () => {
    it('フル相似変換を解き、shared に scale/rotation を返す', async () => {
        const truth: SimilarityTransform = { scale: 1.5, rotation: 12, tx: 25, ty: 5 };
        const pairs = makePairs(SRC, truth);
        const res = await solveTransform(
            { baseImage: dummy, sprite: dummy, faceRegion: { top: 0, bottom: 100, left: 0, right: 100 } },
            { registration: mockRegistration(pairs, 1) }
        );
        expect(res.method).toBe('registration');
        expect(res.transform.scale).toBeCloseTo(1.5, 6);
        expect(res.transform.rotation).toBeCloseTo(12, 6);
        expect(res.shared.scale).toBeCloseTo(1.5, 6);
        expect(res.shared.rotation).toBeCloseTo(12, 6);
        expect(res.shared.faceRegion).toEqual({ top: 0, bottom: 100, left: 0, right: 100 });
        expect(res.confidence).toBeGreaterThan(0.99); // inlier=1, 残差≈0
    });

    it('対応点が 2 点未満なら拒否', async () => {
        const pairs: PointPair[] = [{ src: SRC[0], dst: SRC[0] }];
        await expect(
            solveTransform({ baseImage: dummy, sprite: dummy }, { registration: mockRegistration(pairs) })
        ).rejects.toThrow(/2 点以上/);
    });
});

describe('solveTransform: 単体モード（sharedTransform あり）', () => {
    it('共有 scale/rotation を流用し、平行移動のみ算出する', async () => {
        const truth: SimilarityTransform = { scale: 1.5, rotation: 20, tx: 30, ty: -10 };
        const pairs = makePairs(SRC, truth);
        const shared: SharedTransform = { scale: 1.5, rotation: 20 };

        const res = await solveTransform(
            { baseImage: dummy, sprite: dummy, sharedTransform: shared },
            { registration: mockRegistration(pairs, 1) }
        );
        // scale/rotation は共有値そのまま
        expect(res.transform.scale).toBe(1.5);
        expect(res.transform.rotation).toBe(20);
        // 平行移動は対応点から復元
        expect(res.transform.tx).toBeCloseTo(30, 6);
        expect(res.transform.ty).toBeCloseTo(-10, 6);
    });

    it('D4: 基準以外の単体実行で共有変換 A を上書きしない', async () => {
        const pairs = makePairs(SRC, { scale: 1.5, rotation: 20, tx: 30, ty: -10 });
        // わざと「真の変換」と異なる共有値（scale=0.9, rotation=5）を渡す
        const shared: SharedTransform = { scale: 0.9, rotation: 5, mask: undefined };
        const res = await solveTransform(
            { baseImage: dummy, sprite: dummy, sharedTransform: shared },
            { registration: mockRegistration(pairs, 1) }
        );
        // shared は渡したものと同一（scale/rotation 不変）
        expect(res.shared).toBe(shared);
        expect(res.shared.scale).toBe(0.9);
        expect(res.shared.rotation).toBe(5);
        // transform も共有 scale/rotation を採用
        expect(res.transform.scale).toBe(0.9);
        expect(res.transform.rotation).toBe(5);
    });

    it('単体モードは 1 点でも平行移動を算出できる', async () => {
        const pairs: PointPair[] = [{ src: { x: 10, y: 10 }, dst: { x: 40, y: 0 } }];
        const res = await solveTransform(
            { baseImage: dummy, sprite: dummy, sharedTransform: { scale: 1, rotation: 0 } },
            { registration: mockRegistration(pairs, 1) }
        );
        expect(res.transform.tx).toBeCloseTo(30, 6);
        expect(res.transform.ty).toBeCloseTo(-10, 6);
    });
});

describe('solveTransform: confidence', () => {
    it('インライア率が confidence に反映される（残差≈0 のとき confidence≈inlierRatio）', async () => {
        const pairs = makePairs(SRC, { scale: 1, rotation: 0, tx: 0, ty: 0 });
        const res = await solveTransform(
            { baseImage: dummy, sprite: dummy },
            { registration: mockRegistration(pairs, 0.5) }
        );
        expect(res.confidence).toBeCloseTo(0.5, 6);
    });

    it('残差が大きいほど confidence が下がる', async () => {
        const pairs = makePairs(SRC, { scale: 1, rotation: 0, tx: 0, ty: 0 });
        // dst を大きくずらして残差を増やす（フィット不能なノイズ）
        pairs[0].dst.x += 40;
        pairs[2].dst.y -= 40;
        const res = await solveTransform(
            { baseImage: dummy, sprite: dummy },
            { registration: mockRegistration(pairs, 1) }
        );
        expect(res.confidence).toBeLessThan(0.9);
    });
});

describe('solveTransform: 入力検証・既定 provider', () => {
    it('baseImage / sprite が欠けると検証エラー', async () => {
        // @ts-expect-error 必須引数欠落の検証
        await expect(solveTransform({})).rejects.toThrow(/必須/);
    });

    it('既定 provider（未注入）は NotImplementedError', async () => {
        await expect(solveTransform({ baseImage: dummy, sprite: dummy })).rejects.toThrow(
            /未実装/
        );
    });
});
