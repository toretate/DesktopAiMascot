/**
 * 位置合わせコア（純粋オーケストレーション）。
 *
 * 責務 A（共有変換: scale/rotation/mask）と責務 B（配置: 平行移動）を分離し、
 * 2 実行モード（16枚まとめて / 単体）を同一関数で扱う。
 *
 * - input.sharedTransform あり（単体モードで A 確立済み）:
 *     scale/rotation を流用し、配置 B（平行移動）と confidence のみ算出する。
 *     shared は受け取ったものをそのまま返す（D4: 基準以外で A を上書きしない）。
 * - input.sharedTransform なし（A を確立）:
 *     フル相似変換を解き、scale/rotation を共有変換 A として返す。
 *
 * 画像 → 対応点の抽出（レジストレーション）は RegistrationProvider に委譲し、
 * 本関数はピクセル空間の変換・確信度・モード分岐のみを担う（step3）。
 * 既定の RegistrationProvider は未実装（step4: registration-opencv で差し込む）。
 *
 * 戻り値の transform はスプライト→ベースのピクセル空間。
 * エディタ座標系（offset/scale）への変換は UI 結線時（step9）に別途行う。
 */

import type {
    PointPair,
    RegistrationProvider,
    SharedTransform,
    SimilarityTransform,
    SolveTransformDeps,
    SolveTransformInput,
    SolveTransformResult,
} from './types';
import { clamp } from './types';
import { estimateSimilarityTransform, estimateTranslation, residualRms } from './similarity';

export class NotImplementedError extends Error {
    constructor(what: string) {
        super(`[expression-alignment] 未実装: ${what}`);
        this.name = 'NotImplementedError';
    }
}

/** 既定の RegistrationProvider（step4 で OpenCV.js 実装に差し替える） */
const notImplementedRegistration: RegistrationProvider = {
    async register() {
        throw new NotImplementedError('レジストレーション (registration-opencv, step4)');
    },
};

/**
 * インライア率と残差から 0..1 の確信度を算出する。
 * 残差は dst 点群の広がり（バウンディング対角）で正規化する。
 */
function computeConfidence(inlierRatio: number, rms: number, pairs: PointPair[]): number {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const { dst } of pairs) {
        if (dst.x < minX) minX = dst.x;
        if (dst.y < minY) minY = dst.y;
        if (dst.x > maxX) maxX = dst.x;
        if (dst.y > maxY) maxY = dst.y;
    }
    const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
    // 残差が対角の 10% で 0 点になるよう正規化
    const residualScore = clamp(1 - rms / (0.1 * diag), 0, 1);
    return clamp(clamp(inlierRatio, 0, 1) * residualScore, 0, 1);
}

/**
 * スプライトをマスコット顔へ合わせる相似変換を算出する。
 *
 * @param input baseImage / sprite（RasterImage）と任意の faceRegion / sharedTransform
 * @param deps  レジストレーション戦略（既定は未実装。テスト・実運用で注入する）
 */
export async function solveTransform(
    input: SolveTransformInput,
    deps: SolveTransformDeps = { registration: notImplementedRegistration }
): Promise<SolveTransformResult> {
    if (!input?.baseImage || !input?.sprite) {
        throw new Error('[expression-alignment] baseImage と sprite は必須です');
    }

    const { pairs, inlierRatio } = await deps.registration.register(
        input.baseImage,
        input.sprite,
        input.faceRegion
    );

    if (!pairs || pairs.length === 0) {
        throw new Error('[expression-alignment] 対応点が得られませんでした');
    }

    let transform: SimilarityTransform;
    let shared: SharedTransform;

    if (input.sharedTransform) {
        // 単体モード: 共有変換 A（scale/rotation）を流用し、平行移動 B のみ算出
        const { scale, rotation } = input.sharedTransform;
        const { tx, ty } = estimateTranslation(pairs, scale, rotation);
        transform = { scale, rotation, tx, ty };
        shared = input.sharedTransform; // D4: A を上書きしない
    } else {
        // 共有変換 A を確立: フル相似変換
        if (pairs.length < 2) {
            throw new Error('[expression-alignment] 共有変換の確立には 2 点以上の対応が必要です');
        }
        transform = estimateSimilarityTransform(pairs);
        shared = {
            scale: transform.scale,
            rotation: transform.rotation,
            faceRegion: input.faceRegion,
        };
    }

    const rms = residualRms(transform, pairs);
    const confidence = computeConfidence(inlierRatio, rms, pairs);

    return { transform, shared, confidence, method: 'registration' };
}
