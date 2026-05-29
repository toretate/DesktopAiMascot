export interface IElectronAPI {
    toggleChat: () => void;
    openSettings: () => void;
    setIgnoreMouseEvents: (ignore: boolean) => void;
    startWindowDrag: () => void;
    askGemini: (message: string, apiKey: string, systemPrompt: string, modelName: string) => Promise<string>;
    askLmStudio: (message: string, systemPrompt: string, modelName: string, endpoint: string) => Promise<string>;
    synthesizeVoicevox: (text: string, speakerId: number) => Promise<string | null>;
    changeEmotion: (emotion: string) => void;
    onEmotionChanged: (callback: (emotion: string) => void) => () => void;
    onChatToggled: (callback: (visible: boolean) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: IElectronAPI;
    }
}
