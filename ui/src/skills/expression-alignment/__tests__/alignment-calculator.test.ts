import { describe, test, expect } from 'vitest';
import { calculateAlignment, ALIGNMENT_CONSTANTS } from '../alignment-calculator';
import type { FaceDetectionResult } from '../face-region-detector';
import type { ContentBounds } from '../content-bounds-detector';

describe('AlignmentCalculator', () => {
    /**
     * テスト用のヘルパー: 典型的な FaceDetectionResult を作成する
     */
    function createFaceDetection(faceBox: { top: number; bottom: number; left: number; right: number }): FaceDetectionResult {
        return {
            faceBox,
            confidence: 0.6,
            method: 'heuristic',
            characterBox: { top: 0, bottom: 800, left: 100, right: 500 },
        };
    }

    /**
     * テスト用のヘルパー: 典型的な ContentBounds を作成する
     */
    function createContentBounds(
        imageWidth: number,
        imageHeight: number,
        contentWidth: number,
        contentHeight: number,
        centerX?: number,
        centerY?: number
    ): ContentBounds {
        const cx = centerX ?? imageWidth / 2;
        const cy = centerY ?? imageHeight / 2;
        return {
            box: {
                top: cy - contentHeight / 2,
                bottom: cy + contentHeight / 2,
                left: cx - contentWidth / 2,
                right: cx + contentWidth / 2,
            },
            imageWidth,
            imageHeight,
            centerX: cx,
            centerY: cy,
            contentWidth,
            contentHeight,
            detectedBackgroundColor: [255, 255, 255],
        };
    }

    test('calculateAlignment_結果がクランプ範囲内に収まる', () => {
        const face = createFaceDetection({ top: 50, bottom: 250, left: 150, right: 350 });
        const content = createContentBounds(256, 256, 200, 200);
        const baseSize = { width: 600, height: 800 };

        const result = calculateAlignment(face, content, baseSize);

        expect(result.offsetX).toBeGreaterThanOrEqual(ALIGNMENT_CONSTANTS.OFFSET_MIN);
        expect(result.offsetX).toBeLessThanOrEqual(ALIGNMENT_CONSTANTS.OFFSET_MAX);
        expect(result.offsetY).toBeGreaterThanOrEqual(ALIGNMENT_CONSTANTS.OFFSET_MIN);
        expect(result.offsetY).toBeLessThanOrEqual(ALIGNMENT_CONSTANTS.OFFSET_MAX);
        expect(result.scale).toBeGreaterThanOrEqual(ALIGNMENT_CONSTANTS.SCALE_MIN);
        expect(result.scale).toBeLessThanOrEqual(ALIGNMENT_CONSTANTS.SCALE_MAX);
    });

    test('calculateAlignment_顔がプレビュー中央にある場合はoffsetが0に近い', () => {
        // ベース画像 420x560（プレビュー領域と同じサイズ）で顔が中央にある場合
        const previewSize = { width: 420, height: 560 };
        const baseSize = { width: 420, height: 560 };

        // 顔がちょうど中央 (210, 280) にある
        const face = createFaceDetection({
            top: 230,
            bottom: 330,
            left: 160,
            right: 260,
        });

        const content = createContentBounds(140, 140, 120, 120);

        const result = calculateAlignment(face, content, baseSize, previewSize);

        // 顔中心 (210, 280) = プレビュー中心 (210, 280) なので offset は 0 に近いはず
        expect(Math.abs(result.offsetX)).toBeLessThan(20);
        expect(Math.abs(result.offsetY)).toBeLessThan(20);
    });

    test('calculateAlignment_顔が上部にある場合はoffsetYが負になる', () => {
        const baseSize = { width: 420, height: 560 };

        // 顔が上部（Y = 50〜150, 中心Y = 100）にある
        const face = createFaceDetection({
            top: 50,
            bottom: 150,
            left: 160,
            right: 260,
        });

        const content = createContentBounds(140, 140, 120, 120);

        const result = calculateAlignment(face, content, baseSize);

        // プレビュー中心Y = 280, 顔中心Y ≈ 100 → offsetY は負になるはず
        expect(result.offsetY).toBeLessThan(0);
    });

    test('calculateAlignment_表情画像が大きい場合はscaleが小さくなる', () => {
        // 顔領域を大きめにして、scale 差が丸め後も明確に出るようにする
        const face = createFaceDetection({
            top: 50,
            bottom: 350,
            left: 100,
            right: 400,
        });
        const baseSize = { width: 600, height: 800 };

        // 小さいコンテンツ（画像全体が有効領域）
        const smallContent = createContentBounds(140, 140, 130, 130);
        const resultSmall = calculateAlignment(face, smallContent, baseSize);

        // 大きいコンテンツ
        const largeContent = createContentBounds(512, 512, 480, 480);
        const resultLarge = calculateAlignment(face, largeContent, baseSize);

        // コンテンツが大きいほど scale が小さくなる（同じ顔サイズにフィットさせるため）
        expect(resultLarge.scale).toBeLessThan(resultSmall.scale);
    });

    test('calculateAlignment_scale値が小数第2位に丸められる', () => {
        const face = createFaceDetection({ top: 100, bottom: 200, left: 150, right: 250 });
        const content = createContentBounds(256, 256, 200, 200);
        const baseSize = { width: 600, height: 800 };

        const result = calculateAlignment(face, content, baseSize);

        // scale は小数第2位に丸められているはず
        const rounded = Math.round(result.scale * 100) / 100;
        expect(result.scale).toBe(rounded);
    });

    test('calculateAlignment_offsetXYは整数に丸められる', () => {
        const face = createFaceDetection({ top: 100, bottom: 200, left: 150, right: 250 });
        const content = createContentBounds(256, 256, 200, 200);
        const baseSize = { width: 600, height: 800 };

        const result = calculateAlignment(face, content, baseSize);

        expect(Number.isInteger(result.offsetX)).toBe(true);
        expect(Number.isInteger(result.offsetY)).toBe(true);
    });
});
