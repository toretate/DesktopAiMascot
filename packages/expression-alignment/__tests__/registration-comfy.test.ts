import { describe, it, expect } from 'vitest';
import { ComfyLandmarkRegistrationProvider } from '../src/registration-comfy';
import { solveTransform } from '../src/solve-transform';
import type { ComfyFaceDetection } from '../src/registration-comfy';
import type { RasterImage } from '../src/types';

describe('ComfyLandmarkRegistrationProvider', () => {
    // 仮想の画像オブジェクト（ピクセルデータはテストに不要なため空）
    const dummyImage: RasterImage = {
        width: 100,
        height: 100,
        data: new Uint8ClampedArray(0),
    };

    it('register_正常なランドマークから対応点を正しく構築できること', async () => {
        // 通常のベース検出データ
        const baseDetection: ComfyFaceDetection = {
            image_width: 100,
            image_height: 100,
            face_bbox: { x: 10, y: 10, w: 80, h: 80 },
            left_eye_bbox: { x: 20, y: 30, w: 10, h: 10 },
            right_eye_bbox: { x: 50, y: 30, w: 10, h: 10 },
            mouth_bbox: { x: 30, y: 60, w: 20, h: 10 },
            landmarks: [
                { x: 25, y: 35 }, // 左目中心相当
                { x: 55, y: 35 }, // 右目中心相当
                { x: 40, y: 65 }, // 口中心相当
            ],
        };

        // スプライト（拡大・平行移動された状態を想定）
        // スケール2倍、右に10、下に20平行移動
        const spriteDetection: ComfyFaceDetection = {
            image_width: 200,
            image_height: 200,
            face_bbox: { x: 30, y: 40, w: 160, h: 160 },
            left_eye_bbox: { x: 50, y: 80, w: 20, h: 20 },
            right_eye_bbox: { x: 110, y: 80, w: 20, h: 20 },
            mouth_bbox: { x: 70, y: 140, w: 40, h: 20 },
            landmarks: [
                { x: 60, y: 90 },
                { x: 120, y: 90 },
                { x: 90, y: 150 },
            ],
        };

        const provider = new ComfyLandmarkRegistrationProvider(baseDetection, spriteDetection);
        const result = await provider.register(dummyImage, dummyImage);

        expect(result.pairs).toHaveLength(3);
        expect(result.pairs[0]).toEqual({
            src: { x: 60, y: 90 },
            dst: { x: 25, y: 35 },
        });
        expect(result.inlierRatio).toBe(1.0);
    });

    it('register_ランドマークが空のときバウンディングボックスの中心点をフォールバックに使用すること', async () => {
        const baseDetection: ComfyFaceDetection = {
            image_width: 100,
            image_height: 100,
            face_bbox: { x: 10, y: 10, w: 80, h: 80 },
            left_eye_bbox: { x: 20, y: 30, w: 10, h: 10 },
            right_eye_bbox: { x: 50, y: 30, w: 10, h: 10 },
            mouth_bbox: { x: 30, y: 60, w: 20, h: 10 },
            landmarks: [], // 空
        };

        const spriteDetection: ComfyFaceDetection = {
            image_width: 100,
            image_height: 100,
            face_bbox: { x: 10, y: 10, w: 80, h: 80 },
            left_eye_bbox: { x: 20, y: 30, w: 10, h: 10 },
            right_eye_bbox: { x: 50, y: 30, w: 10, h: 10 },
            mouth_bbox: { x: 30, y: 60, w: 20, h: 10 },
            landmarks: [], // 空
        };

        const provider = new ComfyLandmarkRegistrationProvider(baseDetection, spriteDetection);
        const result = await provider.register(dummyImage, dummyImage);

        // 左右の目と口の計3つの中心点ペアができるはず
        expect(result.pairs).toHaveLength(3);
        // 左目の中心: (20 + 5, 30 + 5) = (25, 35)
        expect(result.pairs[0]).toEqual({
            src: { x: 25, y: 35 },
            dst: { x: 25, y: 35 },
        });
    });

    it('solveTransform_ComfyUI検出データを用いて位置合わせ相似変換パラメータを正しく算出できること', async () => {
        // ベース顔（通常状態）
        const baseDetection: ComfyFaceDetection = {
            image_width: 100,
            image_height: 100,
            face_bbox: { x: 10, y: 10, w: 80, h: 80 },
            left_eye_bbox: { x: 20, y: 30, w: 10, h: 10 },
            right_eye_bbox: { x: 50, y: 30, w: 10, h: 10 },
            mouth_bbox: { x: 30, y: 60, w: 20, h: 10 },
            landmarks: [
                { x: 25, y: 35 },
                { x: 55, y: 35 },
                { x: 40, y: 65 },
            ],
        };

        // スプライト（スケール0.5倍、tx=10, ty=5 平行移動状態）
        // dst = scale * src + (tx, ty)
        // 逆算：src = (dst - (tx, ty)) / scale
        // src0 = (25 - 10)/0.5 = 30, (35 - 5)/0.5 = 60
        // src1 = (55 - 10)/0.5 = 90, (35 - 5)/0.5 = 60
        // src2 = (40 - 10)/0.5 = 60, (65 - 5)/0.5 = 120
        const spriteDetection: ComfyFaceDetection = {
            image_width: 200,
            image_height: 200,
            face_bbox: { x: 20, y: 20, w: 160, h: 160 },
            left_eye_bbox: { x: 25, y: 55, w: 10, h: 10 },
            right_eye_bbox: { x: 85, y: 55, w: 10, h: 10 },
            mouth_bbox: { x: 55, y: 115, w: 10, h: 10 },
            landmarks: [
                { x: 30, y: 60 },
                { x: 90, y: 60 },
                { x: 60, y: 120 },
            ],
        };

        const provider = new ComfyLandmarkRegistrationProvider(baseDetection, spriteDetection);
        const result = await solveTransform(
            {
                baseImage: dummyImage,
                sprite: dummyImage,
            },
            {
                registration: provider,
            }
        );

        expect(result.transform.scale).toBeCloseTo(0.5, 5);
        expect(result.transform.tx).toBeCloseTo(10, 5);
        expect(result.transform.ty).toBeCloseTo(5, 5);
        expect(result.transform.rotation).toBeCloseTo(0, 5);
        expect(result.confidence).toBeGreaterThan(0.9);
    });
});
