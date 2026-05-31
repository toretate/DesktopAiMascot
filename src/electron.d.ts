interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
}

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
    analyzeSpriteSheet: (base64Image: string, apiKey: string) => Promise<any>;
    selectLocalImage: () => Promise<{ success: boolean; path: string; name: string } | null>;
    previewMascotState: (previewState: any) => void;
    onApplyPreviewState: (callback: (previewState: any) => void) => () => void;
    changeEmotion: (emotion: string) => void;
    onEmotionChanged: (callback: (emotion: string) => void) => () => void;
    onChatToggled: (callback: (visible: boolean) => void) => () => void;
    onConfigUpdated: (callback: (config: any) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: IElectronAPI;
    }
}
