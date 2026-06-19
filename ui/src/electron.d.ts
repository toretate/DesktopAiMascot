interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
}

export interface IElectronAPI {
    isWeb?: boolean;
    loginWithGoogle: () => void;
    toggleChat: () => void;
    resizeChatWindow: (size: { width: number; height: number }) => void;
    openSettings: () => void;
    setMascotScale: (scale: number) => void;
    setIgnoreMouseEvents: (ignore: boolean) => void;
    dragWindow: (offset: { dx: number; dy: number; isStart?: boolean; isEnd?: boolean }) => void;
    updateCharacterBounds: (bounds: { top: number; bottom: number; left: number; right: number }) => void;
    quitApp: () => void;
    relaunchApp: () => void;
    getAppConfig: () => Promise<any>;
    updateAppConfig: (config: any) => Promise<void>;
    testServerConnection: (host: string, port: number) => Promise<{ success: boolean; message?: string; error?: string }>;
    askGemini: (message: string, apiKey: string, systemPrompt: string, modelName: string, history?: any[], attachments?: any[]) => Promise<string>;
    askLmStudio: (message: string, systemPrompt: string, modelName: string, endpoint: string, history?: any[], attachments?: any[], tools?: any) => Promise<string>;
    getChatHistory: () => Promise<any>;
    saveChatHistory: (history: any) => Promise<{ success: boolean; error?: string }>;
    openChatHistory: () => void;
    getMascotPrompts: (mascotId: string) => Promise<{ soul: string; identity: string; user: string; agents: string; memory: string }>;
    saveMascotPrompts: (mascotId: string, prompts: { soul: string; identity: string; user: string; agents: string; memory: string }) => Promise<{ success: boolean; error?: string }>;
    getLmStudioModels: (endpoint: string) => Promise<{ success: boolean; models: { id: string; capabilities?: any }[]; error?: string }>;
    synthesizeVoicevox: (text: string, speakerId: number, endpoint?: string) => Promise<string | null>;
    synthesizeIrodori: (text: string, endpoint: string, model: string, voice: string, emotion?: string) => Promise<string | null>;
    getVoicevoxSpeakers: (endpoint: string) => Promise<{ success: boolean; speakers: { name: string; value: number }[]; error?: string }>;
    getIrodoriVoices: (endpoint: string) => Promise<{ success: boolean; voices: any[]; error?: string }>;
    generateMascotExpressions: (base64Image: string, apiKey: string, emotions: { name: string; label: string }[], userPromptTemplate: string, engine?: string, model?: string, history?: any[]) => Promise<{ success: boolean; imageBytes?: string; error?: string; history?: any }>;
    getImagenModels: (apiKey: string) => Promise<string[]>;
    getGeminiModels: (apiKey: string) => Promise<{ success: boolean; models: string[]; error?: string }>;
    analyzeSpriteSheet: (base64Image: string, apiKey: string) => Promise<any>;
    selectLocalImage: () => Promise<{ success: boolean; path: string; name: string } | null>;
    saveMascotImage: (mascotId: string, filename: string, base64Data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    previewMascotState: (previewState: any) => void;
    onApplyPreviewState: (callback: (previewState: any) => void) => () => void;
    changeEmotion: (emotion: string) => void;
    onEmotionChanged: (callback: (emotion: string) => void) => () => void;
    onChatToggled: (callback: (visible: boolean) => void) => () => void;
    onConfigUpdated: (callback: (config: any) => void) => () => void;
    startTimer: (seconds: number, memo: string) => void;
    triggerTimerNotification: (memo: string) => void;
    onTimerTrigger: (callback: (memo: string) => void) => () => void;
    getRadioPrompts: () => Promise<{ radioMode: string; activeTalk: string; exRadioMode?: string; exActiveTalk?: string }>;
    saveRadioPrompts: (prompts: { radioMode: string; activeTalk: string; exRadioMode?: string; exActiveTalk?: string }) => Promise<{ success: boolean; error?: string }>;
}

declare global {
    interface Window {
        electronAPI?: IElectronAPI;
    }
}
