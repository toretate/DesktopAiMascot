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
