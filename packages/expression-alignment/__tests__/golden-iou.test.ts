/**
 * step7 ゴールデン IoU テスト：実アセット + 合成画像出力 + 数値回帰。
 *
 * パイプライン:
 *   1. expr_*.png で registration → 拡大率・位置推定
 *   2. expr_*.png からフレーム/ラベルを BFS で除去 → 顔マスク生成
 *   3. マスク精度を _trimmed.png（正解）と比較（recall=1.0 を確認）
 *   4. outfit + 顔マスクスプライト で合成 PNG 出力
 *   5. 合成結果を expr_*_OK.png（人手正解）と IoU 比較
 *
 * 対象: outfit_1, outfit_2
 * 出力: __tests__/result/{outfit_1,outfit_2}/
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas } from 'canvas';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    createOpenCvRegistration,
    solveTransform,
    pixelTransformToEditor,
    type OpenCvLike,
    type RasterImage,
} from '../src/index';
import { loadOpenCvNode } from '../adapters/opencv-node';
import { NodeCanvasImageLoader, savePng } from '../adapters/canvas-node';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const assetsDir = resolve(repoRoot, '__tests__/expression-alignment/assets');

const PREVIEW_W = 420;
const PREVIEW_H = 420;

// outfit ごとのテスト設定
const OUTFIT_CONFIGS = [
    {
        id: 'outfit_1',
        emotions: ['喜び', '嫌悪', '好奇心', '怒り', '混乱'],
        // emotion → trimmed ファイル名（typo がある場合は上書き）
        trimmedName: (_emotion: string) => `expr_${_emotion}_trimmed.png`,
    },
    {
        id: 'outfit_2',
        emotions: ['喜び', '嫌悪', '好奇心', '怒り', '混乱'],
        // outfit_2 の好奇心は typo "trimed"
        trimmedName: (emotion: string) =>
            emotion === '好奇心' ? `expr_${emotion}_trimed.png` : `expr_${emotion}_trimmed.png`,
    },
] as const;

let cv: OpenCvLike;
let loader: NodeCanvasImageLoader;

beforeAll(() => {
    cv = loadOpenCvNode();
    loader = new NodeCanvasImageLoader();
});

// ---------------------------------------------------------------------------
// 画像ユーティリティ
// ---------------------------------------------------------------------------

function makeCanvas(img: RasterImage) {
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(img.width, img.height);
    id.data.set(img.data);
    ctx.putImageData(id, 0, 0);
    return c;
}

// ---------------------------------------------------------------------------
// 顔マスク抽出（BFS フラッドフィル）
// ---------------------------------------------------------------------------

/**
 * expr_*.png（フレーム・ラベル付きスプライト）から顔コンテンツだけを抽出する。
 *
 * アルゴリズム:
 *   1. 下端から near-white 行が続く「ラベル領域」を検出
 *   2. 画像境界から始まる BFS で r,g,b > 245 の「白い背景」を背景としてマーク
 *      - フレーム内白背景: 254,254,253 → マーク対象
 *      - キャラクターの白/銀髪: 220-240台 → 閾値未満でマーク対象外
 *      - キャラクターの目の白: 暗いアウトラインで囲まれているため BFS が到達しない
 *   3. 外枠 near-black ピクセルもマーク
 *   4. 背景でないピクセルを顔コンテンツとして alpha を保持して出力
 *
 * recall=1.0: trimmed の全 face ピクセルを包含する。
 * tight な bbox 検出（maskIoU 向上）は step5（顔アイランド検出）で行う。
 */
function extractFaceMask(sprite: RasterImage): RasterImage {
    const W = sprite.width;
    const H = sprite.height;

    // 1. ラベル開始行の検出（下から上へ走査し、彩度のある顔コンテンツ行が現れたら停止）
    //
    // 旧アルゴリズム（near-white ≥70% + break）の問題:
    //   - 下枠が near-black → 最初の行で即 break → labelStartY=H（ラベル除外なし）
    //   - テキスト行（[disgust] 等）が near-white 70% 未満 → 途中で break しラベルが残る
    //
    // 新アルゴリズム: 「彩度あり（saturation>20, 30<max<235）」ピクセルが
    //   ≥5% の行 = 顔コンテンツ行とみなしそこで停止。
    //   ラベル背景（近白）・テキスト（近黒）・枠線（近黒）はすべて彩度 0 → スキップ。
    let labelStartY = H;
    for (let y = H - 1; y >= 0; y--) {
        let nColorful = 0;
        for (let x = 0; x < W; x++) {
            const i4 = (y * W + x) * 4;
            const r = sprite.data[i4], g = sprite.data[i4 + 1], b = sprite.data[i4 + 2];
            const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
            const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
            if (maxC - minC > 20 && maxC < 235 && maxC > 30) nColorful++;
        }
        if (nColorful / W >= 0.05) {
            break; // 顔コンテンツ行に到達 → ここで停止
        }
        labelStartY = y;
    }

    // 2. BFS: 境界から r,g,b > 245 の非常に明るい白ピクセルを背景としてマーク
    const bg = new Uint8Array(W * H).fill(0);
    const queue: number[] = [];

    const seedIfBrightWhite = (x: number, y: number) => {
        if (x < 0 || x >= W || y < 0 || y >= labelStartY) return;
        const idx = y * W + x;
        if (bg[idx]) return;
        const i4 = idx * 4;
        if (sprite.data[i4] > 245 && sprite.data[i4 + 1] > 245 && sprite.data[i4 + 2] > 245) {
            bg[idx] = 1;
            queue.push(idx);
        }
    };

    for (let x = 0; x < W; x++) {
        for (let dy = 0; dy < 2; dy++) seedIfBrightWhite(x, dy);
        for (let dy = 0; dy < 2; dy++) seedIfBrightWhite(x, labelStartY - 1 - dy);
    }
    for (let y = 0; y < labelStartY; y++) {
        for (let dx = 0; dx < 2; dx++) seedIfBrightWhite(dx, y);
        for (let dx = 0; dx < 2; dx++) seedIfBrightWhite(W - 1 - dx, y);
    }

    while (queue.length > 0) {
        const idx = queue.pop()!;
        const bx = idx % W;
        const by = Math.floor(idx / W);
        seedIfBrightWhite(bx - 1, by);
        seedIfBrightWhite(bx + 1, by);
        seedIfBrightWhite(bx, by - 1);
        seedIfBrightWhite(bx, by + 1);
    }

    // ラベル行を背景に
    for (let y = labelStartY; y < H; y++) {
        for (let x = 0; x < W; x++) bg[y * W + x] = 1;
    }

    // 外枠 2px の near-black を背景に（ボーダーライン）
    const BORDER = 2;
    for (let y = 0; y < labelStartY; y++) {
        for (let x = 0; x < W; x++) {
            if (x < BORDER || x >= W - BORDER || y < BORDER || y >= labelStartY - BORDER) {
                const i4 = (y * W + x) * 4;
                if (sprite.data[i4] < 25 && sprite.data[i4 + 1] < 25 && sprite.data[i4 + 2] < 25) {
                    bg[y * W + x] = 1;
                }
            }
        }
    }

    // 3. 背景でないピクセルを顔マスクとして出力
    const out = new Uint8ClampedArray(W * H * 4).fill(0);
    for (let i = 0; i < W * H; i++) {
        if (!bg[i]) {
            const i4 = i * 4;
            out[i4] = sprite.data[i4];
            out[i4 + 1] = sprite.data[i4 + 1];
            out[i4 + 2] = sprite.data[i4 + 2];
            out[i4 + 3] = sprite.data[i4 + 3];
        }
    }

    return { width: W, height: H, data: out };
}

// ---------------------------------------------------------------------------
// IoU ユーティリティ
// ---------------------------------------------------------------------------

/** スプライト/キャラクター領域ピクセル判定。グレー背景 #888 と白背景を除外。 */
function isSpritePixel(r: number, g: number, b: number, a: number): boolean {
    if (a < 200) return false;
    if (Math.abs(r - 136) < 25 && Math.abs(g - 136) < 25 && Math.abs(b - 136) < 25) return false;
    if (r > 245 && g > 245 && b > 245) return false;
    return true;
}

/** 2 画像の非背景ピクセル IoU（合成結果 vs OK 比較用）*/
function computeSpriteIoU(img1: RasterImage, img2: RasterImage): number {
    if (img1.width !== img2.width || img1.height !== img2.height) return 0;
    let intersection = 0;
    let union = 0;
    for (let i = 0; i < img1.data.length; i += 4) {
        const is1 = isSpritePixel(img1.data[i], img1.data[i + 1], img1.data[i + 2], img1.data[i + 3]);
        const is2 = isSpritePixel(img2.data[i], img2.data[i + 1], img2.data[i + 2], img2.data[i + 3]);
        if (is1 && is2) intersection++;
        if (is1 || is2) union++;
    }
    return union > 0 ? intersection / union : 0;
}

// ---------------------------------------------------------------------------
// 合成ヘルパー
// ---------------------------------------------------------------------------

/** _OK.png を 420×420 プレビューに配置（synthesized と同じ座標系）*/
function padToPreview(img: RasterImage, offsetX: number, offsetY: number): RasterImage {
    const cvs = createCanvas(PREVIEW_W, PREVIEW_H);
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
    ctx.drawImage(makeCanvas(img), offsetX, offsetY);
    const out = ctx.getImageData(0, 0, PREVIEW_W, PREVIEW_H);
    return { width: PREVIEW_W, height: PREVIEW_H, data: new Uint8ClampedArray(out.data) };
}

/** outfit + 顔マスクスプライトを合成して 420×420 プレビューを返す */
function synthesizeComposite(
    baseImg: RasterImage,
    spriteImg: RasterImage,
    editorParams: { offsetX: number; offsetY: number; scale: number; rotation: number },
    baseFitScale: number
): RasterImage {
    const cvs = createCanvas(PREVIEW_W, PREVIEW_H);
    const ctx = cvs.getContext('2d');

    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

    const fittedW = baseImg.width * baseFitScale;
    const fittedH = baseImg.height * baseFitScale;
    ctx.drawImage(makeCanvas(baseImg), (PREVIEW_W - fittedW) / 2, (PREVIEW_H - fittedH) / 2, fittedW, fittedH);

    ctx.save();
    ctx.translate(PREVIEW_W / 2 + editorParams.offsetX, PREVIEW_H / 2 + editorParams.offsetY);
    ctx.rotate((editorParams.rotation * Math.PI) / 180);
    ctx.scale(editorParams.scale, editorParams.scale);

    const aspect = spriteImg.width / spriteImg.height;
    const drawW = aspect > 1 ? 140 : 140 * aspect;
    const drawH = aspect > 1 ? 140 / aspect : 140;
    ctx.drawImage(makeCanvas(spriteImg), -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const imgData = ctx.getImageData(0, 0, PREVIEW_W, PREVIEW_H);
    return { width: PREVIEW_W, height: PREVIEW_H, data: new Uint8ClampedArray(imgData.data) };
}

// ---------------------------------------------------------------------------
// テスト（outfit ループ）
// ---------------------------------------------------------------------------

for (const outfit of OUTFIT_CONFIGS) {
    const outfitDir = resolve(assetsDir, outfit.id);
    const resultDir = resolve(here, 'result', outfit.id);

    describe(`Golden IoU テスト（${outfit.id}）`, () => {
        it('顔マスク精度: extractFaceMask が _trimmed.png の顔領域を包含する', async () => {
            // _trimmed.png は顔の bounding box（長方形塗りつぶし）。
            // extractFaceMask はフレーム/ラベル除去後の広い領域を返すため recall=1.0、
            // tight な bbox 検出は step5（顔アイランド検出）で改善する。
            const recallValues: number[] = [];

            for (const emotion of outfit.emotions) {
                const spriteRaster = await loader.load(resolve(outfitDir, `expr_${emotion}.png`));
                const trimmedRaster = await loader.load(resolve(outfitDir, outfit.trimmedName(emotion)));

                const faceMask = extractFaceMask(spriteRaster);
                savePng(faceMask, resolve(resultDir, `expr_${emotion}_face_mask.png`));

                let trimmedTotal = 0;
                let covered = 0;
                for (let i = 3; i < trimmedRaster.data.length; i += 4) {
                    if (trimmedRaster.data[i] > 0) {
                        trimmedTotal++;
                        if (faceMask.data[i] > 0) covered++;
                    }
                }
                const recall = trimmedTotal > 0 ? covered / trimmedTotal : 0;
                recallValues.push(recall);
                console.log(`[${outfit.id}][顔マスク] ${emotion}: recall=${recall.toFixed(3)} (${covered}/${trimmedTotal}px)`);
                expect(recall).toBeGreaterThan(0.95);
            }

            const avgRecall = recallValues.reduce((s, v) => s + v, 0) / recallValues.length;
            console.log(`[${outfit.id}] Average recall: ${avgRecall.toFixed(3)}`);
            expect(avgRecall).toBeGreaterThan(0.95);
        });

        it('顔マスク合成結果が _OK.png と十分な IoU を持つ', async () => {
            const baseRaster = await loader.load(resolve(outfitDir, `${outfit.id}.png`));
            const baseFitScale = Math.min(PREVIEW_W / baseRaster.width, PREVIEW_H / baseRaster.height);
            const baseOffsetX = (PREVIEW_W - baseRaster.width * baseFitScale) / 2;
            const baseOffsetY = (PREVIEW_H - baseRaster.height * baseFitScale) / 2;

            console.log(`[${outfit.id}] base=${baseRaster.width}×${baseRaster.height} fitScale=${baseFitScale.toFixed(3)} offset=(${baseOffsetX},${baseOffsetY})`);

            const results: { emotion: string; confidence: number; compositeIoU: number }[] = [];

            for (const emotion of outfit.emotions) {
                const spriteRaster = await loader.load(resolve(outfitDir, `expr_${emotion}.png`));
                const okRaster = await loader.load(resolve(outfitDir, `expr_${emotion}_OK.png`));

                // 1. Registration: expr_*.png で変換推定
                const registration = createOpenCvRegistration(cv);
                const res = await solveTransform(
                    { baseImage: baseRaster, sprite: spriteRaster },
                    { registration }
                );

                const editorParams = pixelTransformToEditor(res.transform, {
                    spriteWidth: spriteRaster.width,
                    spriteHeight: spriteRaster.height,
                    baseFitScale,
                    baseWidth: baseRaster.width,
                    expressionBaseSize: 140,
                    previewCenterX: PREVIEW_W / 2,
                    previewCenterY: PREVIEW_H / 2,
                    previewWidth: PREVIEW_W,
                });

                // 2. 顔マスク生成 + 合成
                const faceMask = extractFaceMask(spriteRaster);
                const synthesized = synthesizeComposite(baseRaster, faceMask, editorParams, baseFitScale);
                savePng(synthesized, resolve(resultDir, `expr_${emotion}_synthesized.png`));

                // 3. OK と比較
                const paddedOk = padToPreview(okRaster, baseOffsetX, baseOffsetY);
                savePng(paddedOk, resolve(resultDir, `expr_${emotion}_OK_padded.png`));
                const compositeIoU = computeSpriteIoU(synthesized, paddedOk);

                results.push({ emotion, confidence: res.confidence, compositeIoU });
                console.log(
                    `[${outfit.id}][${emotion}]`
                    + ` px: scale=${res.transform.scale.toFixed(3)} rot=${res.transform.rotation.toFixed(1)}°`
                    + ` | ed: off=(${editorParams.offsetX},${editorParams.offsetY}) scale=${editorParams.scale.toFixed(3)}`
                    + ` | conf=${res.confidence.toFixed(3)} compositeIoU=${compositeIoU.toFixed(3)}`
                );

                expect(compositeIoU).toBeGreaterThan(0.5);
            }

            const avg = results.reduce((s, r) => s + r.compositeIoU, 0) / results.length;
            console.log(`[${outfit.id}] Average compositeIoU: ${avg.toFixed(3)}`);
            expect(avg).toBeGreaterThan(0.6);
        });
    });
}
