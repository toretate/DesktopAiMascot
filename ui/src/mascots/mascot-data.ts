import MascotAsset from "./mascot-asset"

/**
 * =========================
 * マスコットAI設定 (Type Definition)
 * =========================
 */
interface MascotAiConfig {
    chat: {
        engine: string;
        model: string;
        temperature: number;
    };
    voice: {
        engine?: string;
        speaker_id?: number;
        style?: string;
        irodori_voice?: string;
        irodori_model?: string;
    };
};

/**
 * =========================
 * マスコットデータ (Type Definition)
 * =========================
 */
export default interface MascotData {
    /** マスコットID */
    id: string;

    /** マスコット名 */
    name: string;

    /** マスコットアバター */
    avatar: string;

    /** マスコットプロフィール */
    profile: string;

    /** 現在のコスチュームID */
    currentOutfitId?: string;

    /** 現在のポーズID */
    currentPoseId?: string;

    /** マスコットAI設定 */
    aiConfig: MascotAiConfig;

    /** マスコットアセット */
    assets: {
        /** コスチュームアセット */
        outfits: MascotAsset[];

        /** 表情アセット */
        expressions: MascotAsset[];

        /** ポーズアセット */
        poses: MascotAsset[];
    };
}

