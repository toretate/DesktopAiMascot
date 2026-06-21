import { describe, test, expect } from 'vitest';
import { estimateFaceBox, FACE_HEURISTIC } from '../face-region-detector';
import type { BoundingBox } from '../content-bounds-detector';

describe('FaceRegionDetector', () => {
    describe('estimateFaceBox', () => {
        test('estimateFaceBox_標準的なキャラクター領域から顔を正しく推定する', () => {
            // 幅400px、高さ800pxのキャラクター領域（左上が(50, 50)）
            const characterBox: BoundingBox = {
                top: 50,
                bottom: 850,
                left: 50,
                right: 450,
            };

            const faceBox = estimateFaceBox(characterBox);

            const charHeight = 800;
            const charWidth = 400;

            // 顔の上端: キャラクター上端 + 高さの 10% = 50 + 80 = 130
            expect(faceBox.top).toBe(Math.round(50 + charHeight * FACE_HEURISTIC.FACE_TOP_RATIO));
            // 顔の下端: キャラクター上端 + 高さの 35% = 50 + 280 = 330
            expect(faceBox.bottom).toBe(Math.round(50 + charHeight * FACE_HEURISTIC.FACE_BOTTOM_RATIO));

            // 顔幅: キャラクター幅の 50% = 200px
            const expectedFaceWidth = charWidth * FACE_HEURISTIC.FACE_WIDTH_RATIO;
            const charCenterX = 50 + charWidth / 2; // = 250
            expect(faceBox.left).toBe(Math.round(charCenterX - expectedFaceWidth / 2));
            expect(faceBox.right).toBe(Math.round(charCenterX + expectedFaceWidth / 2));
        });

        test('estimateFaceBox_正方形のキャラクター領域でも正しく動作する', () => {
            const characterBox: BoundingBox = {
                top: 0,
                bottom: 500,
                left: 0,
                right: 500,
            };

            const faceBox = estimateFaceBox(characterBox);

            // 顔の中心は水平方向で中央（250）になるべき
            const faceCenterX = (faceBox.left + faceBox.right) / 2;
            expect(faceCenterX).toBe(250);

            // 顔の上端は上部にあるべき
            expect(faceBox.top).toBeLessThan(faceBox.bottom);
            expect(faceBox.top).toBeLessThan(250);
        });

        test('estimateFaceBox_非常に小さいキャラクター領域でもクラッシュしない', () => {
            const characterBox: BoundingBox = {
                top: 0,
                bottom: 10,
                left: 0,
                right: 10,
            };

            const faceBox = estimateFaceBox(characterBox);

            expect(faceBox.top).toBeLessThanOrEqual(faceBox.bottom);
            expect(faceBox.left).toBeLessThanOrEqual(faceBox.right);
        });
    });
});
