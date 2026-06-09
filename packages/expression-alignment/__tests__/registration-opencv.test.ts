/**
 * step4 結合テスト: OpenCV.js レジストレーション（opencv-wasm を Node 同期ロード）。
 *
 * テクスチャ画像を既知の相似変換でワープしてスプライト相当を作り、
 * registration → solveTransform で元の変換を復元できることを確認する。
 *
 * 注: ORB は実装に微小な非決定性があるため、しきい値は緩めに設定。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas } from 'canvas';
import {
    createOpenCvRegistration,
    solveTransform,
    type OpenCvLike,
    type RasterImage,
} from '../src/index';
import { loadOpenCvNode } from '../adapters/opencv-node';

let cv: OpenCvLike;

beforeAll(() => {
    // opencv-wasm は同期ロード（onRuntimeInitialized 待ち不要 → ハングしない）
    cv = loadOpenCvNode();
});

/** ORB が特徴を拾えるよう、市松＋ランダム矩形でテクスチャを作る */
function texturedCanvas(w: number, h: number, seed: number) {
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 0, w, h);
    let s = seed;
    const rnd = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
    for (let i = 0; i < 140; i++) {
        ctx.fillStyle = `rgb(${(rnd() * 255) | 0},${(rnd() * 255) | 0},${(rnd() * 255) | 0})`;
        ctx.fillRect((rnd() * w) | 0, (rnd() * h) | 0, (8 + rnd() * 22) | 0, (8 + rnd() * 22) | 0);
    }
    return c;
}

function toRaster(ctx: any, w: number, h: number): RasterImage {
    const id = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, data: new Uint8ClampedArray(id.data) };
}

describe('OpenCV レジストレーション + solveTransform（合成ワープ）', () => {
    it('既知のワープから sprite→base の相似変換を復元する', async () => {
        const W = 320;
        const H = 260;
        const baseCanvas = texturedCanvas(W, H, 7);
        const base = toRaster(baseCanvas.getContext('2d'), W, H);

        // base を scale=0.8, rotate=15°, translate(20,10) でワープ → sprite 相当
        // このとき sprite→base 変換は scale≈1/0.8=1.25, rotation≈-15° になる
        const sc = createCanvas(W, H);
        const sx = sc.getContext('2d');
        sx.fillStyle = '#888';
        sx.fillRect(0, 0, W, H);
        sx.translate(20, 10);
        sx.rotate((15 * Math.PI) / 180);
        sx.scale(0.8, 0.8);
        sx.drawImage(baseCanvas, 0, 0);
        const sprite = toRaster(sx, W, H);

        const registration = createOpenCvRegistration(cv);
        const reg = await registration.register(base, sprite);

        // 十分な対応点とインライアが取れている
        expect(reg.pairs.length).toBeGreaterThanOrEqual(8);
        expect(reg.inlierRatio).toBeGreaterThan(0.3);

        const res = await solveTransform({ baseImage: base, sprite }, { registration });

        // sprite→base の相似変換を復元（緩め許容）
        expect(res.transform.scale).toBeGreaterThan(1.1);
        expect(res.transform.scale).toBeLessThan(1.4);
        expect(res.transform.rotation).toBeGreaterThan(-19);
        expect(res.transform.rotation).toBeLessThan(-11);
        expect(res.confidence).toBeGreaterThan(0.3);
    });

    it('恒等（同一画像）では scale≈1, rotation≈0', async () => {
        const W = 300;
        const H = 240;
        const c = texturedCanvas(W, H, 21);
        const img = toRaster(c.getContext('2d'), W, H);
        // 同一画像をコピー（独立バッファ）
        const sprite: RasterImage = { width: W, height: H, data: new Uint8ClampedArray(img.data) };

        const registration = createOpenCvRegistration(cv);
        const res = await solveTransform({ baseImage: img, sprite }, { registration });

        expect(res.transform.scale).toBeGreaterThan(0.9);
        expect(res.transform.scale).toBeLessThan(1.1);
        expect(Math.abs(res.transform.rotation)).toBeLessThan(3);
        expect(res.confidence).toBeGreaterThan(0.6);
    });
});
