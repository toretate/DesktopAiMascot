/**
 * 顔領域検出結果と表情画像の有効領域情報をもとに、
 * 表情エディタの offsetX, offsetY, scale パラメータを算出するモジュール
 */

import type { FaceDetectionResult } from './face-region-detector';
import type { ContentBounds } from './content-bounds-detector';
import type { DetectedFaceFeatures } from './feature-island-detector';

/** 算出された位置合わせパラメータ */
export interface AlignmentParams {
    /** 横方向オフセット (px) — エディタ座標系 */
    offsetX: number;
    /** 縦方向オフセット (px) — エディタ座標系 */
    offsetY: number;
    /** 拡大率 — 140px 基準の倍率 */
    scale: number;
}

/** プレビュー領域のサイズ設定 */
export interface PreviewSize {
    width: number;
    height: number;
}

/** パラメータ算出の定数 */
export const ALIGNMENT_CONSTANTS = {
    /** 表情画像を顔領域の何割にフィットさせるか */
    FACE_FIT_RATIO: 0.80,
    /** offset の最小値 */
    OFFSET_MIN: -250,
    /** offset の最大値 */
    OFFSET_MAX: 250,
    /** scale の最小値 */
    SCALE_MIN: 0.3,
    /** scale の最大値 */
    SCALE_MAX: 2.0,
    /** デフォルトのプレビュー領域サイズ */
    DEFAULT_PREVIEW: { width: 420, height: 560 } as PreviewSize,
    /** 表情画像の基本描画サイズ (px) */
    DEFAULT_EXPRESSION_BASE_SIZE: 140,
} as const;

/**
 * 値を指定範囲にクランプする
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * 顔検出結果と表情画像の有効領域から、位置合わせパラメータを算出する
 *
 * @param faceDetection 顔検出結果
 * @param contentBounds 表情画像の有効領域情報
 * @param baseImageSize ベース画像のネイティブピクセルサイズ
 * @param previewSize プレビュー領域のサイズ
 * @param expressionBaseSize 表情画像の基本描画サイズ
 * @param faceFeatures 表情画像から検出された目・口の特徴
 * @param overrideScale スケールを強制指定する場合
 * @returns 算出された位置合わせパラメータ (offsetX, offsetY, scale)
 */
export function calculateAlignment(
    faceDetection: FaceDetectionResult,
    contentBounds: ContentBounds,
    baseImageSize: { width: number; height: number },
    previewSize: PreviewSize = ALIGNMENT_CONSTANTS.DEFAULT_PREVIEW,
    expressionBaseSize: number = ALIGNMENT_CONSTANTS.DEFAULT_EXPRESSION_BASE_SIZE,
    faceFeatures?: DetectedFaceFeatures,
    overrideScale?: number
): AlignmentParams {
    const { faceBox } = faceDetection;

    // 1. 幾何学的アプローチ: 左右の目の重心が検出されている場合、目口を基準にフィットさせる
    if (faceFeatures && faceFeatures.leftEye && faceFeatures.rightEye) {
        const { leftEye, rightEye } = faceFeatures;

        // ベース画像をプレビュー領域に object-fit: contain でフィットさせた場合のスケール比率
        const fitScale = Math.min(
            previewSize.width / baseImageSize.width,
            previewSize.height / baseImageSize.height
        );

        const fittedWidth = baseImageSize.width * fitScale;
        const fittedHeight = baseImageSize.height * fitScale;
        const baseOffsetX = (previewSize.width - fittedWidth) / 2;
        const baseOffsetY = (previewSize.height - fittedHeight) / 2;

        const faceWidth = faceBox.right - faceBox.left;
        const faceHeight = faceBox.bottom - faceBox.top;

        // アニメ風二次元キャラの顔領域における理想的な目の間隔と中心位置
        const eyeDistanceBase = faceWidth * 0.36;
        const eyeCenterXBase = faceBox.left + faceWidth * 0.50;
        const eyeCenterYBase = faceBox.top + faceHeight * 0.62;

        // プレビュー座標系における理想の目の間隔と中心位置
        const targetEyeDistance = eyeDistanceBase * fitScale;
        const targetCenterX = eyeCenterXBase * fitScale + baseOffsetX;
        const targetCenterY = eyeCenterYBase * fitScale + baseOffsetY;

        // 表情画像側の目の間隔と中心
        const dx = rightEye.centerX - leftEye.centerX;
        const dy = rightEye.centerY - leftEye.centerY;
        const eyeDistanceExpr = Math.sqrt(dx * dx + dy * dy);
        
        const eyeCenterXExpr = (leftEye.centerX + rightEye.centerX) / 2;
        const eyeCenterYExpr = (leftEye.centerY + rightEye.centerY) / 2;

        // 表情画像が expressionBaseSize (140px) に contain フィットされたときの倍率
        const imgW = contentBounds.imageWidth;
        const imgH = contentBounds.imageHeight;
        const scaleFactorTo140 = imgW > imgH ? (expressionBaseSize / imgW) : (expressionBaseSize / imgH);

        const displayEyeDistance = eyeDistanceExpr * scaleFactorTo140;

        // スケールの決定
        let rawScale = 1.0;
        if (overrideScale !== undefined) {
            rawScale = overrideScale;
        } else if (displayEyeDistance > 0) {
            rawScale = targetEyeDistance / displayEyeDistance;
        }

        // 表情画像中心からのズレ量（140px基準にスケール適用したもの）
        const dxExpr = eyeCenterXExpr - imgW / 2;
        const dyExpr = eyeCenterYExpr - imgH / 2;
        const exprOffsetInPreviewX = dxExpr * scaleFactorTo140 * rawScale;
        const exprOffsetInPreviewY = dyExpr * scaleFactorTo140 * rawScale;

        // プレビュー中心からの offset
        const previewCenterX = previewSize.width / 2;
        const previewCenterY = previewSize.height / 2;

        const rawOffsetX = targetCenterX - previewCenterX - exprOffsetInPreviewX;
        const rawOffsetY = targetCenterY - previewCenterY - exprOffsetInPreviewY;

        // クランプと丸め
        const offsetX = clamp(
            Math.round(rawOffsetX),
            ALIGNMENT_CONSTANTS.OFFSET_MIN,
            ALIGNMENT_CONSTANTS.OFFSET_MAX
        );
        const offsetY = clamp(
            Math.round(rawOffsetY),
            ALIGNMENT_CONSTANTS.OFFSET_MIN,
            ALIGNMENT_CONSTANTS.OFFSET_MAX
        );
        const scale = clamp(
            Math.round(rawScale * 100) / 100,
            ALIGNMENT_CONSTANTS.SCALE_MIN,
            ALIGNMENT_CONSTANTS.SCALE_MAX
        );

        return { offsetX, offsetY, scale };
    }

    // 2. フォールバック: バウンディングボックスベースでのアプローチ
    // ベース画像をプレビュー領域に object-fit: contain でフィットさせた場合のスケール比率
    const fitScale = Math.min(
        previewSize.width / baseImageSize.width,
        previewSize.height / baseImageSize.height
    );

    // フィット後のベース画像サイズとオフセット（中央配置）
    const fittedWidth = baseImageSize.width * fitScale;
    const fittedHeight = baseImageSize.height * fitScale;
    const baseOffsetX = (previewSize.width - fittedWidth) / 2;
    const baseOffsetY = (previewSize.height - fittedHeight) / 2;

    // 顔領域のプレビュー座標系への変換
    const faceCenterXInPreview = faceBox.left * fitScale + baseOffsetX + (faceBox.right - faceBox.left) * fitScale / 2;
    const faceCenterYInPreview = faceBox.top * fitScale + baseOffsetY + (faceBox.bottom - faceBox.top) * fitScale / 2;
    const faceHeightInPreview = (faceBox.bottom - faceBox.top) * fitScale;

    // プレビュー中心座標
    const previewCenterX = previewSize.width / 2;
    const previewCenterY = previewSize.height / 2;

    // offset の算出: 顔中心とプレビュー中心の差分
    const rawOffsetX = faceCenterXInPreview - previewCenterX;
    const rawOffsetY = faceCenterYInPreview - previewCenterY;

    // scale の算出
    const contentHeightRatio = contentBounds.contentHeight / contentBounds.imageHeight;
    const displayContentHeight = contentHeightRatio * expressionBaseSize;

    let rawScale: number;
    if (overrideScale !== undefined) {
        rawScale = overrideScale;
    } else if (displayContentHeight > 0) {
        const baseTargetHeight = 210.0;
        const sizeFactor = contentBounds.imageHeight <= 140 
            ? 1.0 
            : Math.min(1.0, contentBounds.contentHeight / baseTargetHeight);
        
        const targetFaceHeight = faceHeightInPreview * ALIGNMENT_CONSTANTS.FACE_FIT_RATIO * sizeFactor;
        rawScale = targetFaceHeight / displayContentHeight;
    } else {
        rawScale = 1.0;
    }

    // 表情画像の中心が有効コンテンツの中心からずれている場合のオフセット補正
    const contentCenterXRatio = contentBounds.centerX / contentBounds.imageWidth - 0.5;
    const contentCenterYRatio = contentBounds.centerY / contentBounds.imageHeight - 0.5;
    
    let contentOffsetCorrectionX = contentCenterXRatio * expressionBaseSize * rawScale;
    let contentOffsetCorrectionY = contentCenterYRatio * expressionBaseSize * rawScale;

    if (contentBounds.contentHeight < 150) {
        if (contentCenterXRatio < 0) {
            contentOffsetCorrectionX += 28;
        } else if (contentCenterXRatio > 0) {
            contentOffsetCorrectionX -= 32;
        }
        contentOffsetCorrectionY -= 10;
    } else {
        const xOffsetAdjust = baseImageSize.width <= 420 ? 0 : 28;
        contentOffsetCorrectionX += xOffsetAdjust;
        contentOffsetCorrectionY += 4;
    }

    // クランプ
    const offsetX = clamp(
        Math.round(rawOffsetX - contentOffsetCorrectionX),
        ALIGNMENT_CONSTANTS.OFFSET_MIN,
        ALIGNMENT_CONSTANTS.OFFSET_MAX
    );
    const offsetY = clamp(
        Math.round(rawOffsetY - contentOffsetCorrectionY),
        ALIGNMENT_CONSTANTS.OFFSET_MIN,
        ALIGNMENT_CONSTANTS.OFFSET_MAX
    );
    const scale = clamp(
        Math.round(rawScale * 100) / 100,
        ALIGNMENT_CONSTANTS.SCALE_MIN,
        ALIGNMENT_CONSTANTS.SCALE_MAX
    );

    return { offsetX, offsetY, scale };
}

