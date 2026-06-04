interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
}

export interface IElectronAPI {
    loginWithGoogle: () => void;
    toggleChat: () => void;
    openSettings: () => void;
    setMascotScale: (scale: number) => void;
    setIgnoreMouseEvents: (ignore: boolean) => void;
    dragWindow: (offset: { dx: number; dy: number }) => void;
    updateCharacterBounds: (bounds: { top: number; bottom: number; left: number; right: number }) => void;
    quitApp: () => void;
    relaunchApp: () => void;
    getAppConfig: () => Promise<any>;
    updateAppConfig: (config: any) => Promise<void>;
    testServerConnection: (host: string, port: number) => Promise<{ success: boolean; message?: string; error?: string }>;
    askGemini: (message: string, apiKey: string, systemPrompt: string, modelName: string, history?: any[]) => Promise<string>;
    askLmStudio: (message: string, systemPrompt: string, modelName: string, endpoint: string, history?: any[]) => Promise<string>;
    getChatHistory: () => Promise<any>;
    saveChatHistory: (history: any) => Promise<{ success: boolean; error?: string }>;
    openChatHistory: () => void;
    getMascotPrompts: (mascotId: string) => Promise<{ soul: string; identity: string; user: string; agents: string; memory: string }>;
    saveMascotPrompts: (mascotId: string, prompts: { soul: string; identity: string; user: string; agents: string; memory: string }) => Promise<{ success: boolean; error?: string }>;
    getLmStudioModels: (endpoint: string) => Promise<{ success: boolean; models: string[]; error?: string }>;
    synthesizeVoicevox: (text: string, speakerId: number, endpoint?: string) => Promise<string | null>;
    getVoicevoxSpeakers: (endpoint: string) => Promise<{ success: boolean; speakers: { name: string; value: number }[]; error?: string }>;
    generateMascotExpressions: (base64Image: string, apiKey: string, emotions: { name: string; label: string }[], userPromptTemplate: string, engine?: string, model?: string, history?: any[]) => Promise<{ success: boolean; imageBytes?: string; error?: string; history?: any }>;
    getImagenModels: (apiKey: string) => Promise<string[]>;
    analyzeSpriteSheet: (base64Image: string, apiKey: string) => Promise<any>;
    selectLocalImage: () => Promise<{ success: boolean; path: string; name: string } | null>;
    previewMascotState: (previewState: any) => void;
    onApplyPreviewState: (callback: (previewState: any) => void) => () => void;
    changeEmotion: (emotion: string) => void;
    onEmotionChanged: (callback: (emotion: string) => void) => () => void;
    onChatToggled: (callback: (visible: boolean) => void) => () => void;
    onConfigUpdated: (callback: (config: any) => void) => () => void;
    startTimer: (seconds: number, memo: string) => void;
    triggerTimerNotification: (memo: string) => void;
    onTimerTrigger: (callback: (memo: string) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: IElectronAPI;
    }
}
