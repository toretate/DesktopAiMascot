import type { Base64AudioPayload } from './types/audio';

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
}

export interface MusicFolderResult {
    success: boolean;
    folderPath?: string;
    files?: Array<{ name: string; relativePath: string; size: number; lastModified: number; url: string }>;
    error?: string;
}

export interface IElectronAPI {
    isWeb?: boolean;
    loginWithGoogle: () => void;
    toggleChat: () => void;
    toggleTasks: () => void;
    toggleMemo: () => void;
    toggleMusic: () => void;
    resizeChatWindow: (size: { width: number; height: number }) => void;
    resizeWindow: (size: { width: number; height: number }) => void;
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
    forgeTestConnection: (host: string) => Promise<boolean>;
    forgeGetModels: (host: string) => Promise<string[]>;
    forgeGetLoras: (host: string) => Promise<string[]>;
    askGemini: (message: string, apiKey: string, systemPrompt: string, modelName: string, history?: any[], attachments?: any[]) => Promise<string>;
    askLmStudio: (message: string, systemPrompt: string, modelName: string, endpoint: string, history?: any[], attachments?: any[], tools?: any) => Promise<string>;
    getChatHistory: () => Promise<any>;
    saveChatHistory: (history: any) => Promise<{ success: boolean; error?: string }>;
    openChatHistory: () => void;
    openFolder: (path: string) => void;
    getMascotPrompts: (mascotId: string) => Promise<{ soul: string; identity: string; user: string; agents: string; memory: string }>;
    saveMascotPrompts: (mascotId: string, prompts: { soul: string; identity: string; user: string; agents: string; memory: string }) => Promise<{ success: boolean; error?: string }>;
    getLmStudioModels: (endpoint: string) => Promise<{ success: boolean; models: { id: string; capabilities?: any }[]; error?: string }>;
    synthesizeVoicevox: (text: string, speakerId: number, endpoint?: string) => Promise<Base64AudioPayload | null>;
    synthesizeIrodori: (text: string, endpoint: string, model: string, voice: string, emotion?: string) => Promise<Base64AudioPayload | null>;
    getVoicevoxSpeakers: (endpoint: string) => Promise<{ success: boolean; speakers: { name: string; value: number }[]; error?: string }>;
    getIrodoriVoices: (endpoint: string) => Promise<{ success: boolean; voices: any[]; error?: string }>;
    generateMascotExpressions: (base64Image: string, apiKey: string, emotions: { name: string; label: string }[], userPromptTemplate: string, engine?: string, model?: string, history?: any[]) => Promise<{ success: boolean; imageBytes?: string; error?: string; history?: any }>;
    getImagenModels: (apiKey: string) => Promise<string[]>;
    getGeminiModels: (apiKey: string) => Promise<{ success: boolean; models: string[]; error?: string }>;
    analyzeSpriteSheet: (base64Image: string, apiKey: string) => Promise<any>;
    alignExpression?: (basePath: string, expressionPath: string, detectMode?: string) => Promise<{ success: boolean; offsetX: number; offsetY: number; scale: number; exprMidX: number; exprMidY: number; exprOvalCX: number; exprOvalCY: number; exprEyeDist: number; exprOvalW: number; baseWidth?: number; baseHeight?: number; exprWidth?: number; exprHeight?: number; fallback?: boolean; method?: string; error?: string }>;
    detectBaseFace?: (imagePath: string, detectMode?: string) => Promise<{ success: boolean; fallback: boolean; faceX: number; faceY: number; faceWidth: number; faceHeight: number; baseWidth: number; baseHeight: number; candidates?: { faceX: number; faceY: number; faceWidth: number; faceHeight: number }[]; error?: string }>;
    selectLocalImage: () => Promise<{ success: boolean; path: string; name: string } | null>;
    selectMusicFolder?: () => Promise<MusicFolderResult | null>;
    loadLastMusicFolder?: () => Promise<MusicFolderResult | null>;
    clearLastMusicFolder?: () => Promise<{ success: boolean }>;
    saveMascotImage?: (mascotId: string, filename: string, base64Data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    saveMascotVoice: (mascotId: string, base64Data: string, extension: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    previewMascotState: (previewState: any) => void;
    onApplyPreviewState: (callback: (previewState: any) => void) => () => void;
    changeEmotion: (emotion: string) => void;
    onEmotionChanged: (callback: (emotion: string) => void) => () => void;
    onChatToggled: (callback: (visible: boolean) => void) => () => void;
    onConfigUpdated: (callback: (config: any) => void) => () => void;
    startTimer: (seconds: number, memo: string) => void;
    triggerTimerNotification: (memo: string, options?: { notificationId?: string; speak?: boolean }) => void;
    onTimerTrigger: (callback: (memo: string, options?: { notificationId?: string; speak?: boolean }) => void) => () => void;
    getRadioPrompts: () => Promise<{ radioMode: string; activeTalk: string; exRadioMode?: string; exActiveTalk?: string }>;
    saveRadioPrompts: (prompts: { radioMode: string; activeTalk: string; exRadioMode?: string; exActiveTalk?: string }) => Promise<{ success: boolean; error?: string }>;
    forgeGenerateImage?: (params: any, host: string) => Promise<string>;
    openDownloadsFolder?: () => void;
    logDebug?: (message: string) => void;
    focusWindow?: () => void;
}

declare global {
    interface Window {
        electronAPI?: IElectronAPI;
    }
}
