/**
 * 表情スプライト自動位置合わせライブラリの共通型定義。
 * framework / DOM に依存しない純粋な型のみを置く。
 */

/** RGBA ピクセル配列を持つデコード済みラスタ画像（DOM/Node 非依存） */
export interface RasterImage {
    width: number;
    height: number;
    /** 長さ = width * height * 4 の RGBA 配列 */
    data: Uint8ClampedArray;
}

/** 矩形領域（ピクセル座標） */
export interface BoundingBox {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/** 2D 点（ピクセル座標） */
export interface Point {
    x: number;
    y: number;
}

/**
 * スプライト↔ベース画像の対応点。
 * src = スプライト（表情）側のピクセル座標、dst = ベース（マスコット）側のピクセル座標。
 */
export interface PointPair {
    src: Point;
    dst: Point;
}

/**
 * スプライト→ベースのピクセル空間相似変換（4自由度）。
 * dst = scale * R(rotation) * src + (tx, ty)
 * ※エディタ座標系（offset/scale）への変換は別レイヤ（UI 結線時 step9）で行う。
 */
export interface SimilarityTransform {
    /** 等方スケール */
    scale: number;
    /** 回転（度） */
    rotation: number;
    /** 平行移動 X（ベース画像ピクセル） */
    tx: number;
    /** 平行移動 Y（ベース画像ピクセル） */
    ty: number;
}

/** レジストレーション（画像→対応点）の結果 */
export interface RegistrationResult {
    /** スプライト↔ベースの対応点 */
    pairs: PointPair[];
    /** インライア率 0..1（confidence 算出に使用） */
    inlierRatio: number;
}

/**
 * 画像ペアから対応点を抽出する戦略（責務: step4 の OpenCV.js レジストレーション）。
 * solveTransform から注入し、step3 ではモックでユニットテストする。
 */
export interface RegistrationProvider {
    register(
        baseImage: RasterImage,
        sprite: RasterImage,
        faceRegion?: BoundingBox
    ): Promise<RegistrationResult>;
}

/** solveTransform の依存（注入） */
export interface SolveTransformDeps {
    registration: RegistrationProvider;
}

/** solveTransform の結果（ピクセル空間の変換 ＋ 共有変換A ＋ 確信度） */
export interface SolveTransformResult {
    /** スプライト→ベースのピクセル空間相似変換（責務 A の scale/rotation ＋ B の平行移動） */
    transform: SimilarityTransform;
    /**
     * この結果で確立 or 使用した共有変換 A（scale/rotation/mask）。
     * 呼び出し側がキャッシュ方針（基準=通常のみ更新）に従って永続化する。
     */
    shared: SharedTransform;
    /** 0..1 の確信度。低い場合は手動エディタへフォールバックする */
    confidence: number;
    /** 確信度算出に用いた手法 */
    method: AlignmentMethod;
}

/**
 * 顔マスク。共有変換 A の一部としてシート単位で持つ。
 * 現時点では楕円フェザーマスクのパラメータを表す（実装は後続ステップ）。
 */
export interface FaceMask {
    /** マスク中心 X（スプライトのピクセル座標） */
    centerX: number;
    /** マスク中心 Y（スプライトのピクセル座標） */
    centerY: number;
    /** 楕円の X 半径（px） */
    radiusX: number;
    /** 楕円の Y 半径（px） */
    radiusY: number;
    /** 境界フェザー量（px） */
    feather: number;
}

/**
 * エディタへ反映する位置合わせパラメータ。
 * 既存 MascotAsset の offsetX/offsetY/scale に rotation を追加したもの。
 */
export interface AlignmentParams {
    /** 横方向オフセット (px) */
    offsetX: number;
    /** 縦方向オフセット (px) */
    offsetY: number;
    /** 拡大率 */
    scale: number;
    /** 回転 (度)。未対応時は 0 */
    rotation: number;
}

/**
 * シート（衣装×ポーズ）単位で共有する変換（責務 A）。
 * scale / rotation / mask を保持し、キャッシュ対象となる。
 */
export interface SharedTransform {
    scale: number;
    rotation: number;
    mask?: FaceMask;
    /** ベース画像中の顔領域（推定済みなら保持） */
    faceRegion?: BoundingBox;
}

/** 位置合わせの確信度算出に使った手法 */
export type AlignmentMethod = 'registration' | 'feature-island' | 'bbox-fallback';

/** solveTransform の入力 */
export interface SolveTransformInput {
    /** マスコット画像（顔クロップ済み、または全身） */
    baseImage: RasterImage;
    /** 対象スプライト（通常 or 個別表情、ラベル除去済み前提） */
    sprite: RasterImage;
    /** 既知の顔領域（無ければライブラリ内で推定） */
    faceRegion?: BoundingBox;
    /**
     * 単体実行モードでキャッシュ済みの共有変換 A。
     * 渡された場合は scale/rotation を流用し、配置 B（offset）のみ算出する。
     */
    sharedTransform?: SharedTransform;
}

/** solveTransform の結果（責務 B の配置 ＋ 確信度） */
export interface AlignmentResult extends AlignmentParams {
    /** 0..1 の確信度。低い場合は手動エディタへフォールバックする */
    confidence: number;
    /** 確信度算出に用いた手法 */
    method: AlignmentMethod;
    /** 顔マスク（算出できた場合） */
    mask?: FaceMask;
}

/** 算出パラメータのクランプ・既定値 */
export const ALIGNMENT_CONSTANTS = {
    OFFSET_MIN: -250,
    OFFSET_MAX: 250,
    SCALE_MIN: 0.3,
    SCALE_MAX: 2.0,
    /** 回転は当面 ±45 度までを想定（横向き対応は段階導入） */
    ROTATION_MIN: -45,
    ROTATION_MAX: 45,
} as const;

/** 値を指定範囲にクランプする */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
