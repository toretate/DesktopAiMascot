export interface IElectronAPI {
    toggleChat: () => void;
    openSettings: () => void;
    setIgnoreMouseEvents: (ignore: boolean) => void;
    startWindowDrag: () => void;
    quitApp: () => void;
    getAppConfig: () => Promise<any>;
    updateAppConfig: (config: any) => Promise<void>;
    askGemini: (message: string, apiKey: string, systemPrompt: string, modelName: string) => Promise<string>;
    askLmStudio: (message: string, systemPrompt: string, modelName: string, endpoint: string) => Promise<string>;
    getLmStudioModels: (endpoint: string) => Promise<{ success: boolean; models: string[]; error?: string }>;
    synthesizeVoicevox: (text: string, speakerId: number, endpoint?: string) => Promise<string | null>;
    getVoicevoxSpeakers: (endpoint: string) => Promise<{ success: boolean; speakers: { name: string; value: number }[]; error?: string }>;
    changeEmotion: (emotion: string) => void;
    onEmotionChanged: (callback: (emotion: string) => void) => () => void;
    onChatToggled: (callback: (visible: boolean) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: IElectronAPI;
    }
}
