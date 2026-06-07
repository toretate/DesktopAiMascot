// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { detectFaceFeatures, FeatureIsland } from '../feature-island-detector';

// document.createElement('canvas') をモックしてテスト実行時に JSDOM 環境下で canvas 動作するようにする
if (typeof document !== 'undefined') {
    const { createCanvas } = eval("require('c:\\\\workspace\\\\workspace-win\\\\DesktopAiMascot\\\\ui\\\\node_modules\\\\canvas')");
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName: string, options?: any) {
        if (tagName.toLowerCase() === 'canvas') {
            return createCanvas(1, 1);
        }
        return originalCreateElement.apply(this, arguments as any);
    } as any;
}

describe('FeatureIslandDetector', () => {
    test('detectFaceFeatures_透明のみの画像からは島が検出されないこと', async () => {
        const { createCanvas } = eval("require('c:\\\\workspace\\\\workspace-win\\\\DesktopAiMascot\\\\ui\\\\node_modules\\\\canvas')");
        const canvas = createCanvas(10, 10);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, 10, 10);
        const emptyDataUrl = canvas.toDataURL('image/png');
        const res = await detectFaceFeatures(emptyDataUrl);
        expect(res.allIslands.length).toBe(0);
        expect(res.leftEye).toBeNull();
        expect(res.rightEye).toBeNull();
        expect(res.mouth).toBeNull();
    });

    test('detectFaceFeatures_3つの非透明領域（目・目・口）から正確に左右の目と口の重心が同定されること', async () => {
        // Canvas を作成して目・目・口のダミーピクセルを描画し、Data URL 化してテストする
        const { createCanvas } = eval("require('c:\\\\workspace\\\\workspace-win\\\\DesktopAiMascot\\\\ui\\\\node_modules\\\\canvas')");
        const canvas = createCanvas(100, 100);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, 100, 100);

        ctx.fillStyle = 'rgba(0, 0, 0, 255)';
        // 左目 (X: 20〜30, Y: 30〜40)
        ctx.fillRect(20, 30, 10, 10);
        // 右目 (X: 70〜80, Y: 30〜40)
        ctx.fillRect(70, 30, 10, 10);
        // 口 (X: 40〜60, Y: 70〜80)
        ctx.fillRect(40, 70, 20, 10);

        const dataUrl = canvas.toDataURL('image/png');
        const res = await detectFaceFeatures(dataUrl);

        expect(res.allIslands.length).toBe(3);
        
        // 左右の目と口が正しく同定できているか
        expect(res.leftEye).not.toBeNull();
        expect(res.rightEye).not.toBeNull();
        expect(res.mouth).not.toBeNull();

        // 座標関係のチェック
        expect(res.leftEye!.centerX).toBeCloseTo(24.5, 0);
        expect(res.leftEye!.centerY).toBeCloseTo(34.5, 0);
        expect(res.rightEye!.centerX).toBeCloseTo(74.5, 0);
        expect(res.mouth!.centerY).toBeCloseTo(74.5, 0);
        expect(res.leftEye!.centerX).toBeLessThan(res.rightEye!.centerX);
    });
});
