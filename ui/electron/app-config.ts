import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';


// アプリケーション名を明示的に指定し、起動方法（VS Codeデバッガ vs CLI）によるuserDataディレクトリ（config.json保存先）のズレを防止
app.setName('desktop-ai-mascot');

// --- 設定管理 (AppConfig) の定義 ---
// --- マスコットアセット・設定のデータ定義 ---
export interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
}

export interface MascotData {
    id: string;
    name: string;
    avatar: string;
    profile: string;
    currentOutfitId?: string;
    currentPoseId?: string;
    aiConfig: {
        chat: {
            engine: string;
            model: string;
            temperature: number;
        };
        voice: {
            engine: string;
            speaker_id: number;
            style: string;
        };
    };
    assets: {
        outfits: MascotAsset[];
        expressions: MascotAsset[];
        poses: MascotAsset[];
    };
}

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
    openaiApiKey: string;
    anthropicApiKey: string;
    mascots: MascotData[];
    activeMascotId: string;
    settingsWidth: number;
    settingsHeight: number;
    settingsX: number;
    settingsY: number;
    mascotScale: number;

    // サーバー接続設定
    useServer: boolean;
    serverHost: string;
    serverPort: number;
}

export class AppConfig {
    private configPath: string;
    private data: ConfigData;

    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'config.json');
        console.log(`[Config] Persistent configuration path: ${this.configPath}`);
        this.data = this.load();
    }

    private load(): ConfigData {
        const defaultMascots: MascotData[] = [
            {
                id: 'mascot_robot_001',
                name: 'デフォルトロボット',
                avatar: '🤖',
                profile: 'あなたは対話型のAIデスクトップマスコットです。親しみやすく返答してください。回答の最後に、自分の現在の感情に合わせて [happy], [sad], [angry], [surprised], [neutral] のいずれかの感情タグを必ず1つ含めて終了してください。',
                aiConfig: {
                    chat: {
                        engine: 'gemini',
                        model: 'gemini-2.0-flash-exp',
                        temperature: 0.7
                    },
                    voice: {
                        engine: 'voicevox',
                        speaker_id: 2,
                        style: 'normal'
                    }
                },
                assets: {
                    outfits: [
                        { id: 'outfit_default', name: '標準制服', path: '👕' },
                        { id: 'outfit_cyber', name: 'サイバーコート', path: '🧥' }
                    ],
                    expressions: [
                        { id: 'expr_normal', name: '通常', path: '😊' },
                        { id: 'expr_smile', name: '笑顔', path: '😆' },
                        { id: 'expr_sad', name: '悲しみ', path: '😢' },
                        { id: 'expr_angry', name: '怒り', path: '😠' }
                    ],
                    poses: [
                        { id: 'pose_stand', name: '立ち姿', path: '🧍' },
                        { id: 'pose_wave', name: '手を振る', path: '👋' }
                    ]
                }
            }
        ];

        const defaultData: ConfigData = {
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
            openaiApiKey: '',
            anthropicApiKey: '',
            mascots: defaultMascots,
            activeMascotId: 'mascot_robot_001',
            settingsWidth: 800,
            settingsHeight: 600,
            settingsX: -1,
            settingsY: -1,
            mascotScale: 1.0,
            useServer: false,
            serverHost: 'localhost',
            serverPort: 3000
        };

        try {
            if (fs.existsSync(this.configPath)) {
                const fileData = fs.readFileSync(this.configPath, 'utf8');
                return { ...defaultData, ...JSON.parse(fileData) };
            }
        } catch (error) {
            console.error('[Config] Failed to load config file:', error);
        }
        return defaultData;
    }

    public get(): ConfigData {
        return this.data;
    }

    public update(newData: Partial<ConfigData>) {
        this.data = { ...this.data, ...newData };
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 4), 'utf8');
        } catch (error) {
            console.error('[Config] Failed to save config file:', error);
        }
    }
}
