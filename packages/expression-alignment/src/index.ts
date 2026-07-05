/**
 * @desktop-ai-mascot/expression-alignment
 *
 * マスコット表情スプライト自動位置合わせライブラリ。
 * framework / DOM 非依存・決定論的。コアと型のみを公開する。
 * 画像デコードのアダプタは ./adapters/* から個別に import する。
 */

export * from './types';
export * from './similarity';
export type { ImageLoader } from './image-input';
export { solveTransform, NotImplementedError } from './solve-transform';
export {
    createOpenCvRegistration,
    type OpenCvLike,
    type OpenCvRegistrationOptions,
} from './registration-opencv';
export {
    detectEyeCenters,
    crossCheckEyeMidpoint,
    type FeatureIsland,
    type EyeCenters,
} from './feature-island-detector';
export { applyEllipseFeatherMask, estimateFaceMask } from './mask';
export {
    detectContentBounds,
    colorDistance,
    detectBackgroundColor,
    type ContentBounds,
} from './content-bounds-detector';
export {
    detectFaceRegion,
    estimateFaceBox,
    FACE_HEURISTIC,
    type FaceDetectionResult,
} from './face-region-detector';
export {
    calculateAlignment,
    CALC_CONSTANTS,
    type AlignmentCalcParams,
    type PreviewSize,
} from './alignment-calculator';
export {
    ComfyLandmarkRegistrationProvider,
    type ComfyFaceDetection,
} from './registration-comfy';

