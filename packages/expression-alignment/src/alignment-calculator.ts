/**
 * step2: 顔領域検出結果と表情画像の有効領域から位置合わせパラメータを算出するモジュール。
 *
 * UI 版 alignment-calculator.ts から移植し以下を変更:
 *   - faceFeatures 型を DetectedFaceFeatures(.centerX) → EyeCenters(.x/.y) に変更
 *   - AlignmentParams に rotation: 0 を付与（パッケージ型に準拠）
 *   - DOM / Node.js 依存なし
 */

import type { FaceDetectionResult } from './face-region-detector';
import type { ContentBounds } from './content-bounds-detector';
import type { EyeCenters } from './feature-island-detector';
import { clamp } from './types';

export interface AlignmentCalcParams {
    offsetX: number;
    offsetY: number;
    scale: number;
}

export interface PreviewSize {
    width: number;
    height: number;
}

export const CALC_CONSTANTS = {
    FACE_FIT_RATIO: 0.80,
    OFFSET_MIN: -250,
    OFFSET_MAX: 250,
    SCALE_MIN: 0.3,
    SCALE_MAX: 2.0,
    DEFAULT_PREVIEW: { width: 420, height: 560 } as PreviewSize,
    DEFAULT_EXPRESSION_BASE_SIZE: 140,
} as const;

/**
 * 顔検出結果と表情画像の有効領域から、位置合わせパラメータを算出する。
 *
 * EyeCenters が渡された場合は目の間隔を基準にした幾何学的アプローチ、
 * そうでない場合はバウンディングボックスベースのフォールバックを使う。
 */
export function calculateAlignment(
    faceDetection: FaceDetectionResult,
    contentBounds: ContentBounds,
    baseImageSize: { width: number; height: number },
    previewSize: PreviewSize = CALC_CONSTANTS.DEFAULT_PREVIEW,
    expressionBaseSize: number = CALC_CONSTANTS.DEFAULT_EXPRESSION_BASE_SIZE,
    eyeCenters?: EyeCenters | null,
    overrideScale?: number
): AlignmentCalcParams {
    const { faceBox } = faceDetection;

    // 1. 幾何学的アプローチ: 目中心が検出されている場合
    if (eyeCenters) {
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

        const eyeDistanceBase = faceWidth * 0.36;
        const eyeCenterXBase = faceBox.left + faceWidth * 0.50;
        const eyeCenterYBase = faceBox.top + faceHeight * 0.62;

        const targetEyeDistance = eyeDistanceBase * fitScale;
        const targetCenterX = eyeCenterXBase * fitScale + baseOffsetX;
        const targetCenterY = eyeCenterYBase * fitScale + baseOffsetY;

        // EyeCenters.left/right は Point {x, y}（UI 版の FeatureIsland.centerX とは異なる）
        const dx = eyeCenters.right.x - eyeCenters.left.x;
        const dy = eyeCenters.right.y - eyeCenters.left.y;
        const eyeDistanceExpr = Math.sqrt(dx * dx + dy * dy);
        const eyeCenterXExpr = (eyeCenters.left.x + eyeCenters.right.x) / 2;
        const eyeCenterYExpr = (eyeCenters.left.y + eyeCenters.right.y) / 2;

        const imgW = contentBounds.imageWidth;
        const imgH = contentBounds.imageHeight;
        const scaleFactorTo140 = imgW > imgH ? (expressionBaseSize / imgW) : (expressionBaseSize / imgH);
        const displayEyeDistance = eyeDistanceExpr * scaleFactorTo140;

        let rawScale = 1.0;
        if (overrideScale !== undefined) {
            rawScale = overrideScale;
        } else if (displayEyeDistance > 0) {
            rawScale = targetEyeDistance / displayEyeDistance;
        }

        const dxExpr = eyeCenterXExpr - imgW / 2;
        const dyExpr = eyeCenterYExpr - imgH / 2;
        const exprOffsetInPreviewX = dxExpr * scaleFactorTo140 * rawScale;
        const exprOffsetInPreviewY = dyExpr * scaleFactorTo140 * rawScale;

        const previewCenterX = previewSize.width / 2;
        const previewCenterY = previewSize.height / 2;

        return {
            offsetX: clamp(Math.round(targetCenterX - previewCenterX - exprOffsetInPreviewX), CALC_CONSTANTS.OFFSET_MIN, CALC_CONSTANTS.OFFSET_MAX),
            offsetY: clamp(Math.round(targetCenterY - previewCenterY - exprOffsetInPreviewY), CALC_CONSTANTS.OFFSET_MIN, CALC_CONSTANTS.OFFSET_MAX),
            scale: clamp(Math.round(rawScale * 100) / 100, CALC_CONSTANTS.SCALE_MIN, CALC_CONSTANTS.SCALE_MAX),
        };
    }

    // 2. フォールバック: バウンディングボックスベース
    const fitScale = Math.min(
        previewSize.width / baseImageSize.width,
        previewSize.height / baseImageSize.height
    );

    const fittedWidth = baseImageSize.width * fitScale;
    const fittedHeight = baseImageSize.height * fitScale;
    const baseOffsetX = (previewSize.width - fittedWidth) / 2;
    const baseOffsetY = (previewSize.height - fittedHeight) / 2;

    const faceCenterXInPreview = faceBox.left * fitScale + baseOffsetX + (faceBox.right - faceBox.left) * fitScale / 2;
    const faceCenterYInPreview = faceBox.top * fitScale + baseOffsetY + (faceBox.bottom - faceBox.top) * fitScale / 2;
    const faceHeightInPreview = (faceBox.bottom - faceBox.top) * fitScale;

    const previewCenterX = previewSize.width / 2;
    const previewCenterY = previewSize.height / 2;

    const rawOffsetX = faceCenterXInPreview - previewCenterX;
    const rawOffsetY = faceCenterYInPreview - previewCenterY;

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
        rawScale = (faceHeightInPreview * CALC_CONSTANTS.FACE_FIT_RATIO * sizeFactor) / displayContentHeight;
    } else {
        rawScale = 1.0;
    }

    const contentCenterXRatio = contentBounds.centerX / contentBounds.imageWidth - 0.5;
    const contentCenterYRatio = contentBounds.centerY / contentBounds.imageHeight - 0.5;
    let contentOffsetCorrectionX = contentCenterXRatio * expressionBaseSize * rawScale;
    let contentOffsetCorrectionY = contentCenterYRatio * expressionBaseSize * rawScale;

    if (contentBounds.contentHeight < 150) {
        if (contentCenterXRatio < 0) contentOffsetCorrectionX += 28;
        else if (contentCenterXRatio > 0) contentOffsetCorrectionX -= 32;
        contentOffsetCorrectionY -= 10;
    } else {
        const xOffsetAdjust = baseImageSize.width <= 420 ? 0 : 28;
        contentOffsetCorrectionX += xOffsetAdjust;
        contentOffsetCorrectionY += 4;
    }

    return {
        offsetX: clamp(Math.round(rawOffsetX - contentOffsetCorrectionX), CALC_CONSTANTS.OFFSET_MIN, CALC_CONSTANTS.OFFSET_MAX),
        offsetY: clamp(Math.round(rawOffsetY - contentOffsetCorrectionY), CALC_CONSTANTS.OFFSET_MIN, CALC_CONSTANTS.OFFSET_MAX),
        scale: clamp(Math.round(rawScale * 100) / 100, CALC_CONSTANTS.SCALE_MIN, CALC_CONSTANTS.SCALE_MAX),
    };
}
