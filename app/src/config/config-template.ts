import { defaultData, type ConfigData } from './config-data';

/**
 * 新規ユーザー向けの初期設定を生成する。
 * 実ユーザーの config.json は参照せず、秘密情報とユーザー固有画像を必ず空にする。
 */
export function createInitialConfig(): ConfigData {
    return {
        ...defaultData,
        googleAiStudioApiKey: '',
        openaiApiKey: '',
        anthropicApiKey: '',
        chatBackgroundImage: '',
        mascotBackgroundImage: '',
        integratedBackgroundImage: '',
        mascots: defaultData.mascots.map((mascot) => structuredClone(mascot))
    };
}
