/**
 * 相似変換（平行移動＋回転＋等方スケール）の最小二乗推定。
 * 画像・DOM に依存しない純粋関数のみ。対応点 → 変換を解く。
 *
 * モデル: dst ≈ scale * R(θ) * src + t   （R(θ) = [[cosθ,-sinθ],[sinθ,cosθ]]）
 * 解法: 2D 相似変換の閉形式最小二乗（Umeyama に相当）。
 */

import type { Point, PointPair, SimilarityTransform } from './types';

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/**
 * 対応点群から相似変換（scale, rotation, tx, ty）を最小二乗推定する。
 * 2 点以上の対応が必要。
 */
export function estimateSimilarityTransform(pairs: PointPair[]): SimilarityTransform {
    const n = pairs.length;
    if (n < 2) {
        throw new Error('[expression-alignment] 相似変換の推定には 2 点以上の対応が必要です');
    }

    // 重心
    let mpx = 0;
    let mpy = 0;
    let mqx = 0;
    let mqy = 0;
    for (const { src, dst } of pairs) {
        mpx += src.x;
        mpy += src.y;
        mqx += dst.x;
        mqy += dst.y;
    }
    mpx /= n;
    mpy /= n;
    mqx /= n;
    mqy /= n;

    // 中心化した相関量
    // a = Σ(p'·q'),  b = Σ(p' × q'),  varP = Σ|p'|²
    let a = 0;
    let b = 0;
    let varP = 0;
    for (const { src, dst } of pairs) {
        const px = src.x - mpx;
        const py = src.y - mpy;
        const qx = dst.x - mqx;
        const qy = dst.y - mqy;
        a += px * qx + py * qy;
        b += px * qy - py * qx;
        varP += px * px + py * py;
    }

    if (varP === 0) {
        throw new Error('[expression-alignment] 対応点(src)が一点に縮退しており変換を推定できません');
    }

    const scale = Math.sqrt(a * a + b * b) / varP;
    const theta = Math.atan2(b, a);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    // t = mean_q - s·R(θ)·mean_p
    const tx = mqx - scale * (cos * mpx - sin * mpy);
    const ty = mqy - scale * (sin * mpx + cos * mpy);

    return { scale, rotation: theta * DEG_PER_RAD, tx, ty };
}

/**
 * scale/rotation を固定したまま、平行移動 (tx, ty) のみを最小二乗推定する。
 * 単体実行モードで共有変換 A（scale/rotation）を流用して配置 B だけ求める用途。
 * 1 点以上の対応が必要。
 */
export function estimateTranslation(
    pairs: PointPair[],
    scale: number,
    rotationDeg: number
): { tx: number; ty: number } {
    const n = pairs.length;
    if (n < 1) {
        throw new Error('[expression-alignment] 平行移動の推定には 1 点以上の対応が必要です');
    }
    const theta = rotationDeg * RAD_PER_DEG;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    let tx = 0;
    let ty = 0;
    for (const { src, dst } of pairs) {
        const rx = scale * (cos * src.x - sin * src.y);
        const ry = scale * (sin * src.x + cos * src.y);
        tx += dst.x - rx;
        ty += dst.y - ry;
    }
    return { tx: tx / n, ty: ty / n };
}

/** 相似変換を点に適用する */
export function applyTransform(t: SimilarityTransform, p: Point): Point {
    const theta = t.rotation * RAD_PER_DEG;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    return {
        x: t.scale * (cos * p.x - sin * p.y) + t.tx,
        y: t.scale * (sin * p.x + cos * p.y) + t.ty,
    };
}

/**
 * ピクセル空間の相似変換をエディタ座標系に変換（step9 の先行実装）。
 *
 * ピクセル空間：dst = scale·R(rotation)·src + (tx, ty)
 * エディタ：スプライト（140px基本）を offsetX/Y で移動、scale で拡大し、rotation で回転
 *
 * 変換過程：
 *   1. スプライト元座標（0, 0）～(W, H) を PixelSpace に当てはめる
 *   2. その結果をベース画像座標 → プレビュー座標へ map（base fitscale）
 *   3. プレビュー中央（210,210）を origin とする editor 座標へ
 *   4. 140px 基準にスケール + offset + rotation
 *
 * 簡易版：スプライト中心をランドマークとして、
 *   - offset = preview座標での「スプライト中心」- preview中央(210,210)
 *   - scale/rotation = PixelSpace から直結（ただし base fitscale を考慮）
 *
 * @param t PixelSpace 相似変換
 * @param spriteSize スプライトのピクセルサイズ {width, height}
 * @param baseFitScale ベース画像のプレビュー fitscale（base_w / preview_w等）
 * @param expressionBaseSize エディタの基本描画サイズ（通常140px）
 * @returns エディタ座標系の { offsetX, offsetY, scale, rotation }
 */
export interface PixelToEditorParams {
    spriteWidth: number;
    spriteHeight: number;
    baseFitScale: number; // base → preview の scale（min(previewW/baseW, previewH/baseH)）
    baseWidth?: number; // ベース画像の元幅（プレビュー内 x オフセット計算用）
    expressionBaseSize?: number; // 通常140
    previewCenterX?: number; // 通常210
    previewCenterY?: number; // 通常210
    previewWidth?: number; // 通常420
}

export function pixelTransformToEditor(
    t: SimilarityTransform,
    p: PixelToEditorParams
): { offsetX: number; offsetY: number; scale: number; rotation: number } {
    const {
        spriteWidth,
        spriteHeight,
        baseFitScale,
        baseWidth = 0,
        expressionBaseSize = 140,
        previewCenterX = 210,
        previewCenterY = 210,
        previewWidth = 420,
    } = p;

    // スプライト中心（ピクセル座標）
    const spriteCenter: Point = { x: spriteWidth / 2, y: spriteHeight / 2 };

    // PixelSpace で変換したスプライト中心（ベース座標系）
    const transformedCenter = applyTransform(t, spriteCenter);

    // ベース画像がプレビューキャンバス内で中央寄せされる場合の x オフセット
    const baseOffsetX = baseWidth > 0 ? (previewWidth - baseWidth * baseFitScale) / 2 : 0;

    // ベース座標 → プレビュー座標（fitscale + canvas 内オフセット）
    const previewX = transformedCenter.x * baseFitScale + baseOffsetX;
    const previewY = transformedCenter.y * baseFitScale;

    // プレビュー中央を origin とするエディタ座標
    const offsetX = previewX - previewCenterX;
    const offsetY = previewY - previewCenterY;

    // contain-fit は最大辺を 140px に収めるので max を使う
    // sprite_px → preview_px = t.scale × baseFitScale
    // drawn_px  → preview_px = drawScale = 140 / max(W, H)
    // editorScale = t.scale × baseFitScale / drawScale = t.scale × baseFitScale × max(W,H) / 140
    const displayScale = t.scale * baseFitScale * Math.max(spriteWidth, spriteHeight) / expressionBaseSize;

    return {
        offsetX: Math.round(offsetX),
        offsetY: Math.round(offsetY),
        scale: Math.round(displayScale * 100) / 100,
        rotation: Math.round(t.rotation * 100) / 100,
    };
}

/** 変換適用後の dst との二乗平均平方根残差（フィットの良さ） */
export function residualRms(t: SimilarityTransform, pairs: PointPair[]): number {
    if (pairs.length === 0) return 0;
    let sum = 0;
    for (const { src, dst } of pairs) {
        const pr = applyTransform(t, src);
        const dx = pr.x - dst.x;
        const dy = pr.y - dst.y;
        sum += dx * dx + dy * dy;
    }
    return Math.sqrt(sum / pairs.length);
}
