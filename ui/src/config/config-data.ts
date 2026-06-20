import MascotData from '../mascots/mascot-data';
import defaultMascotJson from '../mascots/default-mascot.json';

export interface ConfigData {
    mascotX: number;
    mascotY: number;
    chatVisible: boolean;
    alwaysOnTop: boolean;
    selectedEngine: string;
    temperature: number;
    googleAiStudioApiKey: string;
    geminiModel: string;
    openaiModel: string;
    anthropicModel: string;
    lmstudioEndpoint: string;
    lmstudioModel: string;
    selectedVoiceEngine: string;
    voicevoxEndpoint: string;
    voicevoxSpeaker: number;
    irodoriEndpoint: string;
    irodoriModel: string;
    irodoriVoice: string;
    selectedImageEngine: string;
    selectedVideoEngine: string;
    chatOpacity: number;
    chatAlwaysOnTop: boolean | 'sync';
    chatSendKey: string;
    chatFontFamily: string;
    chatBorderShow: boolean;
    chatBorderColor: string;
    chatBorderWidth: number;
    chatBackgroundColor: string;
    chatBackgroundImage: string;
    chatBackgroundImageOpacity: number;
    chatBackgroundImageFit: 'cover' | 'contain' | 'fill' | 'tile';
    openaiApiKey: string;
    anthropicApiKey: string;
    mascots: MascotData[];
    activeMascotId: string;
    settingsWidth: number;
    settingsHeight: number;
    settingsX: number;
    settingsY: number;
    mascotScale: number;
    mascotBackgroundColor: string;
    mascotBackgroundOpacity: number;
    mascotBackgroundImage: string;
    mascotBackgroundImageOpacity: number;
    mascotBackgroundImageFit: 'cover' | 'contain' | 'fill' | 'tile';
    integratedBackgroundColor: string;
    integratedBackgroundOpacity: number;
    integratedBackgroundImage: string;
    integratedBackgroundImageOpacity: number;
    integratedBackgroundImageFit: 'cover' | 'contain' | 'fill' | 'tile';

    // サーバー接続設定
    useServer: boolean;
    serverHost: string;
    serverPort: number;

    // ウィンドウモード
    windowMode: 'split' | 'integrated' | 'compact';

    integratedWidth?: number;
    integratedHeight?: number;
    integratedX?: number;
    integratedY?: number;
    compactWidth?: number;
    compactHeight?: number;
    compactX?: number;
    compactY?: number;
    chatWidth?: number;
    chatHeight?: number;

    // ツール使用設定 (ToolUse)
    toolsCurrentTime: boolean;
    toolsGpsLocation: boolean;
    toolsWeather: boolean;
    toolsVolume: boolean;
    toolsAppLauncher: boolean;
    toolsWebSearch: boolean;

    // 音声保存設定
    saveVoice: boolean;
    showVoiceLog: boolean;
}

export const defaultData: ConfigData = {
    mascotX: -1,
    mascotY: -1,
    chatVisible: false,
    alwaysOnTop: true,
    selectedEngine: 'gemini',
    temperature: 0.7,
    googleAiStudioApiKey: '',
    geminiModel: 'gemini-3.1-flash-lite',
    openaiModel: 'gpt-4o',
    anthropicModel: 'claude-3-5-sonnet-latest',
    lmstudioEndpoint: 'http://127.0.0.1:1234/v1/',
    lmstudioModel: '',
    selectedVoiceEngine: 'voicevox',
    voicevoxEndpoint: 'http://localhost:50021',
    voicevoxSpeaker: 2,
    irodoriEndpoint: 'http://127.0.0.1:8088',
    irodoriModel: 'irodori-tts',
    irodoriVoice: 'default',
    selectedImageEngine: 'dalle3',
    selectedVideoEngine: 'runway',
    chatOpacity: 1.0,
    chatAlwaysOnTop: true,
    chatSendKey: 'enter',
    chatFontFamily: 'sans-serif',
    chatBorderShow: true,
    chatBorderColor: '#a855f7',
    chatBorderWidth: 1,
    chatBackgroundColor: '#ffffff',
    chatBackgroundImage: '',
    chatBackgroundImageOpacity: 1.0,
    chatBackgroundImageFit: 'cover',
    openaiApiKey: '',
    anthropicApiKey: '',
    mascots: [defaultMascotJson as MascotData],
    activeMascotId: 'mascot_robot_001',
    settingsWidth: 800,
    settingsHeight: 600,
    settingsX: -1,
    settingsY: -1,
    mascotScale: 1.0,
    mascotBackgroundColor: '#ffffff',
    mascotBackgroundOpacity: 0.0,
    mascotBackgroundImage: '',
    mascotBackgroundImageOpacity: 1.0,
    mascotBackgroundImageFit: 'cover',
    integratedBackgroundColor: '#1e1e2e',
    integratedBackgroundOpacity: 1.0,
    integratedBackgroundImage: '',
    integratedBackgroundImageOpacity: 1.0,
    integratedBackgroundImageFit: 'cover',
    useServer: false,
    serverHost: 'localhost',
    serverPort: 3000,
    windowMode: 'split',
    integratedWidth: 1100,
    integratedHeight: 800,
    integratedX: -1,
    integratedY: -1,
    compactWidth: 420,
    compactHeight: 800,
    compactX: -1,
    compactY: -1,
    chatWidth: 350,
    chatHeight: 400,
    toolsCurrentTime: true,
    toolsGpsLocation: true,
    toolsWeather: true,
    toolsVolume: true,
    toolsAppLauncher: true,
    toolsWebSearch: true,
    saveVoice: false,
    showVoiceLog: true
};
