import { useConfigStore } from "../../store/config";

export default async (isActiveTalk: boolean, configStore: ReturnType<typeof useConfigStore>): Promise<string> => {
    let radioModePrompt = '';
    let activeTalkPrompt = '';

    // ラジオプロンプトを取得
    if (window.electronAPI && window.electronAPI.getRadioPrompts) {
        try {
            const radioPrompts = await window.electronAPI.getRadioPrompts();
            const isEx = configStore.selectedEngine === 'lmstudio' && configStore.useExRadio;
            radioModePrompt = isEx ? (radioPrompts.exRadioMode || '') : radioPrompts.radioMode;
            activeTalkPrompt = isEx ? (radioPrompts.exActiveTalk || '') : radioPrompts.activeTalk;
        } catch (e) {
            console.error('Failed to load radio prompts:', e);
        }
    }

    let prompt = "";

    // ラジオモード共通の基本指示を適用
    prompt += radioModePrompt.trim()
        ? `${radioModePrompt.trim()}\n\n`
        : `# Radio Mode Instructions
あなたは現在、1人喋りの「ラジオパーソナリティ（MC）」としてラジオ番組を配信しています。目の前のリスナー（マスター）に向けてラジオ風の楽しいトークを展開してください。挨拶（「リスナーのみなさんこんにちは！」「お便りありがとうございます」など）や、ラジオ番組らしい進行の言い回しを効果的に使ってください。

`;

    // 能動的トーク（沈黙時の自発的発話）の場合のみ、追加指示を上乗せする
    if (isActiveTalk) {
        prompt += activeTalkPrompt.trim()
            ? `${activeTalkPrompt.trim()}\n\n`
            : `# Active Radio Talk Instructions
現在、リスナー（ユーザー）からの発話がない状態（沈黙）です。ラジオパーソナリティとして沈黙を破り、リスナーを退屈させないように能動的にフリートークを開始するか、新しい面白い話題（季節、天気、雑談、リスナーへの問いかけなど）を自発的に切り出して、リスナーに楽しく語りかけてください。余計なメタテキストは出力せず、セリフのみを出力してください。

`;
    }

    return prompt;

}