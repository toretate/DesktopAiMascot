import type {
    BoundingBox,
    Point,
    PointPair,
    RegistrationProvider,
    RegistrationResult,
    RasterImage,
} from './types';

/** ComfyUI カスタムノードが出力する顔・表情パーツ検出結果の JSON スキーマ定義 */
export interface ComfyFaceDetection {
    image_width: number;
    image_height: number;
    face_bbox: { x: number; y: number; w: number; h: number };
    left_eye_bbox: { x: number; y: number; w: number; h: number };
    right_eye_bbox: { x: number; y: number; w: number; h: number };
    mouth_bbox: { x: number; y: number; w: number; h: number };
    landmarks: Point[];
}

/**
 * ComfyUI のランドマーク検出結果を利用して対応点ペアを構築するプロバイダー。
 */
export class ComfyLandmarkRegistrationProvider implements RegistrationProvider {
    private baseDetection: ComfyFaceDetection;
    private spriteDetection: ComfyFaceDetection;

    constructor(baseDetection: ComfyFaceDetection, spriteDetection: ComfyFaceDetection) {
        this.baseDetection = baseDetection;
        this.spriteDetection = spriteDetection;
    }

    /**
     * ベース画像とスプライト画像のランドマーク座標から対応点ペアを構築します。
     * 画像データ自体は使用せず、検出済みのメタデータを使用するため決定論的かつ高速です。
     */
    public async register(
        _baseImage: RasterImage,
        _sprite: RasterImage,
        _faceRegion?: BoundingBox
    ): Promise<RegistrationResult> {
        const pairs: PointPair[] = [];
        const baseLandmarks = this.baseDetection.landmarks || [];
        const spriteLandmarks = this.spriteDetection.landmarks || [];

        // 両者のランドマーク点数が一致する部分まで対応点としてマッピングする
        const count = Math.min(baseLandmarks.length, spriteLandmarks.length);

        for (let i = 0; i < count; i++) {
            pairs.push({
                src: { x: spriteLandmarks[i].x, y: spriteLandmarks[i].y },
                dst: { x: baseLandmarks[i].x, y: baseLandmarks[i].y },
            });
        }

        // ランドマークが全く検出できていない場合はエラーを防ぐため
        // 目と口のバウンディングボックス中心点を代わりに使用するフォールバック
        if (pairs.length === 0) {
            this.addBboxCenterPair(pairs, 'left_eye_bbox');
            this.addBboxCenterPair(pairs, 'right_eye_bbox');
            this.addBboxCenterPair(pairs, 'mouth_bbox');
        }

        if (pairs.length === 0) {
            throw new Error('[expression-alignment] ComfyUI 検出データから対応点を構築できませんでした。');
        }

        return {
            pairs,
            inlierRatio: 1.0, // AI検出結果を正とするため、インライア率は1.0
        };
    }

    /** Bounding Box の中心点からペアを追加する補助メソッド */
    private addBboxCenterPair(
        pairs: PointPair[],
        key: 'left_eye_bbox' | 'right_eye_bbox' | 'mouth_bbox'
    ): void {
        const baseBox = this.baseDetection[key];
        const spriteBox = this.spriteDetection[key];

        if (baseBox && spriteBox) {
            pairs.push({
                src: { x: spriteBox.x + spriteBox.w / 2, y: spriteBox.y + spriteBox.h / 2 },
                dst: { x: baseBox.x + baseBox.w / 2, y: baseBox.y + baseBox.h / 2 },
            });
        }
    }
}
