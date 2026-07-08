/**
 * step9: packages/expression-alignment を UI から呼び出すラッパー。
 *
 * 2実行モード:
 *   - autoAlignSingle: 1表情を位置合わせ（SharedTransform あり/なし両対応）
 *   - autoAlignBatch:  シート全表情を一括位置合わせ（通常で A を確立 → 各表情に再利用）
 *
 * confidence ゲート:
 *   - confidence >= CONFIDENCE_THRESHOLD → 自動適用（呼び出し側が直接適用）
 *   - confidence <  CONFIDENCE_THRESHOLD → プリセットとして渡し、手動エディタで確認
 */

import {
    solveTransform,
    pixelTransformToEditor,
    createOpenCvRegistration,
    ComfyLandmarkRegistrationProvider,
    clamp,
    ALIGNMENT_CONSTANTS,
    type SharedTransform,
    type AlignmentMethod,
    type RasterImage,
    type BoundingBox,
    type ComfyFaceDetection,
} from '@desktop-ai-mascot/expression-alignment';
import { loadOpenCvBrowser } from '@desktop-ai-mascot/expression-alignment/adapters/opencv-browser';

// ---------------------------------------------------------------------------
// ローカル顔検出 API
// ---------------------------------------------------------------------------

/**
 * /api/detect-face-mask を呼び出し、ベース画像の顔領域 BoundingBox を返す。
 * URL から origin + /mascots/... パスを抽出してサーバに渡す。
 * 失敗時は null（solveTransform が内部推定にフォールバック）。
 */
async function detectFaceRegionFromServer(baseImageUrl: string): Promise<BoundingBox | null> {
    try {
        const url = new URL(baseImageUrl);
        const imagePath = url.pathname;
        if (!imagePath.startsWith('/mascots/')) return null;

        const response = await fetch(`${url.origin}/api/detect-face-mask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagePath }),
        });
        if (!response.ok) return null;

        const data = await response.json();
        if (!data.success || !data.mask) return null;

        const { centerX, centerY, radiusX, radiusY } = data.mask;
        return {
            top: Math.round(centerY - radiusY),
            bottom: Math.round(centerY + radiusY),
            left: Math.round(centerX - radiusX),
            right: Math.round(centerX + radiusX),
        };
    } catch {
        return null;
    }
}

/**
 * サーバから指定された画像の ComfyUI 検出結果 JSON を取得する。
 */
async function fetchComfyDetection(imageUrl: string): Promise<ComfyFaceDetection | null> {
    try {
        const url = new URL(imageUrl, window.location.origin);
        const imagePath = url.pathname;
        if (!imagePath.startsWith('/mascots/')) return null;

        const response = await fetch(`${url.origin}/api/get-comfy-detection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imagePath }),
        });
        if (!response.ok) return null;

        const data = await response.json();
        if (data.success && data.exists) {
            return data.data;
        }
        return null;
    } catch {
        return null;
    }
}

/** 確信度がこの値以上なら自動適用、未満なら手動確認を促す */
export const CONFIDENCE_THRESHOLD = 0.5;

/** UI エディタ座標系の出力 */
export interface AutoAlignV2Result {
    params: {
        offsetX: number;
        offsetY: number;
        scale: number;
        rotation: number;
    };
    confidence: number;
    method: AlignmentMethod;
    /** 新たに確立された SharedTransform（A 未確立の場合のみ設定） */
    shared?: SharedTransform;
}

// ---------------------------------------------------------------------------
// 内部ユーティリティ
// ---------------------------------------------------------------------------

/** URL または Data URL を RasterImage に変換（ブラウザ Canvas 使用） */
async function loadRasterImage(url: string): Promise<RasterImage> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, w, h);
    return { width: w, height: h, data: id.data as Uint8ClampedArray };
}

const PREVIEW_W = 420;
const PREVIEW_H = 560;

/** ピクセル空間変換 → エディタ座標変換 + クランプ */
function toEditorParams(
    transform: ReturnType<typeof pixelTransformToEditor>,
): AutoAlignV2Result['params'] {
    return {
        offsetX: clamp(transform.offsetX, ALIGNMENT_CONSTANTS.OFFSET_MIN, ALIGNMENT_CONSTANTS.OFFSET_MAX),
        offsetY: clamp(transform.offsetY, ALIGNMENT_CONSTANTS.OFFSET_MIN, ALIGNMENT_CONSTANTS.OFFSET_MAX),
        scale: clamp(transform.scale, ALIGNMENT_CONSTANTS.SCALE_MIN, ALIGNMENT_CONSTANTS.SCALE_MAX),
        rotation: clamp(transform.rotation, ALIGNMENT_CONSTANTS.ROTATION_MIN, ALIGNMENT_CONSTANTS.ROTATION_MAX),
    };
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/**
 * 単体モード: 1表情を位置合わせする。
 *
 * sharedTransform（責務 A: scale/rotation/mask）が確立済みなら渡すことで
 * 平行移動（B）のみを再計算し、A の上書きを防ぐ（D4準拠）。
 *
 * @param baseImageUrl  マスコット本体画像の URL
 * @param spriteUrl     表情スプライト画像の URL
 * @param sharedTransform  シートキャッシュ済みの SharedTransform（省略可）
 */
export async function autoAlignSingle(
    baseImageUrl: string,
    spriteUrl: string,
    sharedTransform?: SharedTransform,
): Promise<AutoAlignV2Result> {
    console.log('[autoAlignSingle] Started. Loading images...');
    const [baseImage, sprite, faceRegion, baseComfy, spriteComfy] = await Promise.all([
        loadRasterImage(baseImageUrl),
        loadRasterImage(spriteUrl),
        detectFaceRegionFromServer(baseImageUrl),
        fetchComfyDetection(baseImageUrl),
        fetchComfyDetection(spriteUrl),
    ]);
    console.log('[autoAlignSingle] Images loaded. base w/h:', baseImage.width, baseImage.height, 'sprite w/h:', sprite.width, sprite.height);

    if (faceRegion) {
        console.log('[auto-align-v2] サーバー顔検出成功:', faceRegion);
    }

    let registration;
    if (baseComfy && spriteComfy) {
        console.log('[autoAlignSingle] ComfyUI detection JSON found. Using ComfyLandmarkRegistrationProvider');
        registration = new ComfyLandmarkRegistrationProvider(baseComfy, spriteComfy);
    } else {
        console.log('[autoAlignSingle] ComfyUI detection JSON not found. Falling back to OpenCV');
        const cv = await loadOpenCvBrowser();
        registration = createOpenCvRegistration(cv);
    }

    console.log('[autoAlignSingle] Solving transform...');
    const result = await solveTransform({ baseImage, sprite, sharedTransform, faceRegion: faceRegion ?? undefined }, { registration });
    console.log('[autoAlignSingle] Transform solved. Confidence:', result.confidence);

    const baseFitScale = Math.min(PREVIEW_W / baseImage.width, PREVIEW_H / baseImage.height);
    const raw = pixelTransformToEditor(result.transform, {
        spriteWidth: sprite.width,
        spriteHeight: sprite.height,
        baseFitScale,
        baseWidth: baseImage.width,
    });

    console.log('[autoAlignSingle] Editor params calculated. Returning result...');
    return {
        params: toEditorParams(raw),
        confidence: result.confidence,
        method: result.method,
        shared: result.shared,
    };
}

/**
 * バッチモード: シート全表情を一括位置合わせする。
 *
 * 1. isNeutral=true の表情（または先頭）で SharedTransform A を確立。
 * 2. 残りの表情は sharedTransform=A を渡し、平行移動 B のみ算出（D4準拠）。
 * 3. 各スプライトに画像がない場合はスキップ。
 *
 * @param baseImageUrl  マスコット本体画像の URL
 * @param sprites       表情スプライト配列 { id, url, isNeutral? }
 */
export async function autoAlignBatch(
    baseImageUrl: string,
    sprites: Array<{ id: string; url: string; isNeutral?: boolean }>,
): Promise<Map<string, AutoAlignV2Result>> {
    console.log('[autoAlignBatch] Started. Sprites count:', sprites.length);
    const results = new Map<string, AutoAlignV2Result>();
    if (sprites.length === 0) {
        console.log('[autoAlignBatch] Sprites list is empty.');
        return results;
    }

    const [baseImage, faceRegion, baseComfy] = await Promise.all([
        loadRasterImage(baseImageUrl),
        detectFaceRegionFromServer(baseImageUrl),
        fetchComfyDetection(baseImageUrl),
    ]);
    if (faceRegion) {
        console.log('[auto-align-v2] バッチ: サーバー顔検出成功:', faceRegion);
    }

    const baseFitScale = Math.min(PREVIEW_W / baseImage.width, PREVIEW_H / baseImage.height);

    // 通常(neutral) スプライトで SharedTransform A を確立
    const neutral = sprites.find(s => s.isNeutral) ?? sprites[0];
    console.log('[autoAlignBatch] Neutral sprite chosen:', neutral.id, 'url:', neutral.url);
    const [neutralSprite, neutralComfy] = await Promise.all([
        loadRasterImage(neutral.url),
        fetchComfyDetection(neutral.url),
    ]);
    console.log('[autoAlignBatch] Neutral sprite loaded. w:', neutralSprite.width, 'h:', neutralSprite.height);

    let neutralRegistration;
    if (baseComfy && neutralComfy) {
        console.log('[autoAlignBatch] Using ComfyLandmarkRegistrationProvider for Neutral sprite');
        neutralRegistration = new ComfyLandmarkRegistrationProvider(baseComfy, neutralComfy);
    } else {
        console.log('[autoAlignBatch] ComfyUI detection not found. Using OpenCV for Neutral sprite');
        const cv = await loadOpenCvBrowser();
        neutralRegistration = createOpenCvRegistration(cv);
    }

    console.log('[autoAlignBatch] Solving transform for Neutral sprite...');
    const neutralResult = await solveTransform(
        { baseImage, sprite: neutralSprite, faceRegion: faceRegion ?? undefined },
        { registration: neutralRegistration },
    );
    console.log('[autoAlignBatch] Neutral sprite transform solved. Confidence:', neutralResult.confidence);
    const sharedA = neutralResult.shared;

    const neutralRaw = pixelTransformToEditor(neutralResult.transform, {
        spriteWidth: neutralSprite.width,
        spriteHeight: neutralSprite.height,
        baseFitScale,
        baseWidth: baseImage.width,
    });
    results.set(neutral.id, {
        params: toEditorParams(neutralRaw),
        confidence: neutralResult.confidence,
        method: neutralResult.method,
        shared: neutralResult.shared,
    });

    // 残りの表情: A を固定して B（平行移動）のみ解く
    console.log('[autoAlignBatch] Aligning remaining sprites...');
    for (const s of sprites) {
        if (s.id === neutral.id) continue;
        try {
            console.log('[autoAlignBatch] Loading sprite:', s.id, 'url:', s.url);
            const [sprite, spriteComfy] = await Promise.all([
                loadRasterImage(s.url),
                fetchComfyDetection(s.url),
            ]);
            console.log('[autoAlignBatch] Sprite loaded. Solving transform with sharedTransform...');

            let registration;
            if (baseComfy && spriteComfy) {
                console.log(`[autoAlignBatch] Using ComfyLandmarkRegistrationProvider for sprite: ${s.id}`);
                registration = new ComfyLandmarkRegistrationProvider(baseComfy, spriteComfy);
            } else {
                console.log(`[autoAlignBatch] Using OpenCV for sprite: ${s.id}`);
                const cv = await loadOpenCvBrowser();
                registration = createOpenCvRegistration(cv);
            }

            const r = await solveTransform(
                { baseImage, sprite, sharedTransform: sharedA },
                { registration },
            );
            console.log('[autoAlignBatch] Sprite solved. Confidence:', r.confidence);
            const raw = pixelTransformToEditor(r.transform, {
                spriteWidth: sprite.width,
                spriteHeight: sprite.height,
                baseFitScale,
                baseWidth: baseImage.width,
            });
            results.set(s.id, {
                params: toEditorParams(raw),
                confidence: r.confidence,
                method: r.method,
            });
        } catch (err) {
            console.warn(`[auto-align-v2] ID=${s.id} の位置合わせに失敗しました:`, err);
        }
    }

    console.log('[autoAlignBatch] All alignment completed. Results size:', results.size);
    return results;
}
