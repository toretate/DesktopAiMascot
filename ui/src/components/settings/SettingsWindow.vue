<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Slider from 'primevue/slider';
import InputText from 'primevue/inputtext';
import { useConfigStore } from '../../store/config';
import { useAuthStore } from '../../store/auth';
import { storeToRefs } from 'pinia';

// リファクタリング済みマスコット設定コンポーネントのインポート
import MascotSettings from './MascotSettings.vue';

const configStore = useConfigStore();
const authStore = useAuthStore();

const {
    googleAiStudioApiKey: geminiApiKey,
    openaiApiKey,
    anthropicApiKey,
    selectedEngine,
    selectedVoiceEngine,
    selectedImageEngine,
    selectedVideoEngine,
    lmstudioEndpoint,
    lmstudioModel,
    geminiModel,
    openaiModel,
    anthropicModel,
    voicevoxEndpoint,
    voicevoxSpeaker,
    temperature,
    chatOpacity,
    chatAlwaysOnTop,
    chatSendKey,
    chatFontFamily,
    chatBorderShow,
    chatBorderColor,
    chatBorderWidth,
    chatBackgroundColor,
    mascotScale,
    alwaysOnTop,
    useServer,
    serverHost,
    serverPort,
    mascots,
    activeMascotId
} = storeToRefs(configStore);

const { user, isAuthenticated } = storeToRefs(authStore);

const activeMenu = ref('mascot');

// --- AIエンジンのデータ定義 ---
const aiEngines = ref([
    { name: 'Gemini AI Studio', value: 'gemini', disabled: false },
    { name: 'LM Studio (ローカル)', value: 'lmstudio', disabled: false },
    { name: 'OpenAI (未実装)', value: 'openai', disabled: true },
    { name: 'Claude (Anthropic) (未実装)', value: 'anthropic', disabled: true }
]);

// Gemini モデル取得用の状態変数
const isTestingGemini = ref(false);
const geminiConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const geminiConnectionErrorMsg = ref('');
const geminiModels = ref<string[]>([]);

const fetchGeminiModels = async () => {
    if (!geminiApiKey.value) {
        geminiConnectionState.value = 'failed';
        geminiConnectionErrorMsg.value = 'APIキーを設定してください。';
        return;
    }
    if (!window.electronAPI) return;
    isTestingGemini.value = true;
    geminiConnectionState.value = 'idle';
    try {
        const result = await window.electronAPI.getGeminiModels(geminiApiKey.value);
        if (result.success) {
            geminiModels.value = result.models;
            geminiConnectionState.value = 'success';
            if (result.models.length > 0) {
                geminiModelOptions.value = result.models;
                if (!geminiModel.value || !result.models.includes(geminiModel.value)) {
                    geminiModel.value = result.models.find((m: string) => m.includes('2.0-flash')) || result.models[0];
                }
                // キャッシュに保存
                localStorage.setItem('geminiModelsCache', JSON.stringify(result.models));
                localStorage.setItem('geminiApiKeyForCache', geminiApiKey.value);
            }
        } else {
            geminiConnectionState.value = 'failed';
            geminiConnectionErrorMsg.value = result.error || 'モデルの取得に失敗しました。';
        }
    } catch (e) {
        geminiConnectionState.value = 'failed';
        geminiConnectionErrorMsg.value = '通信エラーが発生しました。';
    } finally {
        isTestingGemini.value = false;
    }
};

const geminiConnectionClass = computed(() => {
    if (geminiConnectionState.value === 'success') return 'status-success';
    if (geminiConnectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const geminiConnectionIcon = computed(() => {
    if (geminiConnectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (geminiConnectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const geminiConnectionText = computed(() => {
    if (geminiConnectionState.value === 'success') return `モデル一覧取得成功 (取得モデル数: ${geminiModels.value.length})`;
    if (geminiConnectionState.value === 'failed') return `取得失敗: ${geminiConnectionErrorMsg.value}`;
    return '';
});

// 音声AIエンジン
const voiceEngines = ref([
    { name: 'VOICEVOX (ローカル)', value: 'voicevox' },
    { name: 'Google Cloud Text-to-Speech', value: 'gtts' }
]);

// 画像生成AI
const imageEngines = ref([
    { name: 'DALL-E 3 (OpenAI)', value: 'dalle3' },
    { name: 'Stable Diffusion (ローカル)', value: 'sd_local' },
    { name: 'Midjourney API', value: 'midjourney' }
]);

// 動画生成AI
const videoEngines = ref([
    { name: 'Runway Gen-2', value: 'runway' },
    { name: 'Stable Video Diffusion', value: 'svd' },
    { name: 'Sora (OpenAI モック)', value: 'sora' }
]);

// LM Studio 接続検証用の状態変数
const isTestingConnection = ref(false);
const connectionState = ref<'idle' | 'success' | 'failed'>('idle');
const connectionErrorMsg = ref('');
const lmstudioModels = ref<any[]>([]);

// 各エンジンのモデル選択肢
const geminiModelOptions = ref([
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash',
    'gemini-2.0-flash-thinking-exp',
    'gemini-2.0-pro-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'imagen-3.0-generate-002'
]);

const openaiModelOptions = ref([
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'o3-mini',
    'gpt-4-turbo',
    'dall-e-3'
]);

const anthropicModelOptions = ref([
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest'
]);

interface ModelCapabilities {
    isThought?: boolean;
    isToolUse?: boolean;
    isImageGeneration?: boolean;
    isVision?: boolean;
    isAudio?: boolean;
    isStructuredOutput?: boolean;
    isLongContext?: boolean;
    isVideo?: boolean;
    isLocal?: boolean;
}

const getModelCapabilities = (engine: string, modelName: string): ModelCapabilities => {
    const name = (modelName || '').toLowerCase();
    const caps: ModelCapabilities = {
        isThought: false,
        isToolUse: false,
        isImageGeneration: false,
        isVision: false,
        isAudio: false,
        isStructuredOutput: false,
        isLongContext: false,
        isVideo: false,
        isLocal: engine === 'lmstudio'
    };

    if (!name) return caps;

    // 基本的なキーワード判定（全エンジン共通・フォールバック用）
    if (name.includes('think') || name.includes('thought') || name.includes('reason') || name.includes('o1') || name.includes('o3-mini')) {
        caps.isThought = true;
    }
    if (name.includes('vision') || name.includes('vl') || name.includes('gpt-4o') || name.includes('claude-3-5') || name.includes('gemini-1.5') || name.includes('gemini-2.0')) {
        caps.isVision = true;
    }
    
    // LM StudioのAPIから取得した capabilities による正確な上書き判定
    if (engine === 'lmstudio') {
        const found = lmstudioModels.value.find(m => m && typeof m === 'object' && m.id === modelName);
        if (found && found.capabilities) {
            if (found.capabilities.vision !== undefined) {
                caps.isVision = !!found.capabilities.vision;
            }
        }
    }
    if (name.includes('audio') || name.includes('voice') || name.includes('gemini-2.0-flash')) {
        caps.isAudio = true;
    }
    if (name.includes('dall-e') || name.includes('imagen') || name.includes('sd-') || name.includes('stable-diffusion')) {
        caps.isImageGeneration = true;
    }
    
    if (
        (name.includes('gpt') || name.includes('claude') || name.includes('gemini') || name.includes('llama') || name.includes('mistral') || name.includes('instruct') || name.includes('o1') || name.includes('o3')) &&
        !caps.isImageGeneration
    ) {
        caps.isToolUse = true;
    }

    // 特定の代表的モデルに対する個別定義
    if (engine === 'gemini') {
        if (name.includes('thinking')) {
            caps.isThought = true;
            caps.isVision = true;
            caps.isToolUse = true;
            caps.isAudio = false;
            caps.isLongContext = true;
            caps.isStructuredOutput = true;
            caps.isVideo = true;
        } else if (name.includes('imagen')) {
            caps.isImageGeneration = true;
            caps.isToolUse = false;
            caps.isVision = false;
            caps.isAudio = false;
        } else if (name.includes('gemini-2.0-flash')) {
            caps.isVision = true;
            caps.isToolUse = true;
            caps.isAudio = true;
            caps.isLongContext = true;
            caps.isStructuredOutput = true;
            caps.isVideo = true;
        } else if (name.includes('gemini-')) {
            caps.isVision = true;
            caps.isToolUse = true;
            caps.isLongContext = true;
            caps.isStructuredOutput = true;
            caps.isVideo = true;
        }
    }
    else if (engine === 'openai') {
        if (name === 'gpt-4o' || name === 'gpt-4o-mini') {
            caps.isVision = true;
            caps.isToolUse = true;
            caps.isAudio = true;
            caps.isLongContext = true;
            caps.isStructuredOutput = true;
        } else if (name.startsWith('o1') || name.startsWith('o3')) {
            caps.isThought = true;
            caps.isToolUse = true;
            caps.isLongContext = true;
            caps.isStructuredOutput = true;
            if (name.includes('o1') && !name.includes('mini')) {
                caps.isVision = true;
            }
        } else if (name.includes('dall-e')) {
            caps.isImageGeneration = true;
        } else if (name.includes('gpt-4')) {
            caps.isVision = name.includes('turbo') || name.includes('vision');
            caps.isToolUse = true;
            caps.isLongContext = true;
            caps.isStructuredOutput = true;
        }
    }
    else if (engine === 'anthropic') {
        if (name.includes('claude-3-5-sonnet') || name.includes('claude-3-opus')) {
            caps.isVision = true;
            caps.isToolUse = true;
            caps.isLongContext = true;
            caps.isStructuredOutput = true;
        } else if (name.includes('claude-3-5-haiku')) {
            caps.isToolUse = true;
            caps.isVision = false;
            caps.isLongContext = true;
            caps.isStructuredOutput = true;
        } else if (name.includes('claude-3-')) {
            caps.isVision = true;
            caps.isToolUse = true;
            caps.isLongContext = true;
        }
    }

    return caps;
};

const currentModelName = computed(() => {
    if (selectedEngine.value === 'gemini') return geminiModel.value;
    if (selectedEngine.value === 'lmstudio') return lmstudioModel.value;
    if (selectedEngine.value === 'openai') return openaiModel.value;
    if (selectedEngine.value === 'anthropic') return anthropicModel.value;
    return '';
});

const currentModelCapabilities = computed(() => {
    return getModelCapabilities(selectedEngine.value, currentModelName.value);
});


// VOICEVOX 疎通確認および話者ロード用の状態変数
const isTestingVoicevox = ref(false);
const voicevoxConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const voicevoxConnectionErrorMsg = ref('');
const voicevoxSpeakers = ref<{ name: string; value: number }[]>([]);

const mascotAlwaysOnTopOptions = ref([
    { name: '常に最前面に表示する', value: true },
    { name: '最前面に表示しない', value: false }
]);

const chatAlwaysOnTopOptions = ref([
    { name: '常に最前面に表示する', value: true },
    { name: '最前面に表示しない', value: false },
    { name: 'マスコットと連動', value: 'sync' }
]);

const sendKeyOptions = ref([
    { name: 'Enter で送信 (Shift + Enter で改行)', value: 'enter' },
    { name: 'Shift + Enter で送信 (Enter で改行)', value: 'shiftEnter' }
]);

const fontFamilyOptions = ref([
    { name: 'システムデフォルト (sans-serif)', value: 'sans-serif' },
    { name: 'Yu Gothic UI / 游ゴシック', value: '"Yu Gothic UI", "Yu Gothic", sans-serif' },
    { name: 'Meiryo / メイリオ', value: '"Meiryo", sans-serif' },
    { name: 'Segoe UI', value: '"Segoe UI", sans-serif' },
    { name: 'MS PGothic / ＭＳ Ｐゴシック', value: '"MS PGothic", sans-serif' }
]);

const saveStatus = ref('設定を保存');
const isSaving = ref(false);

// LM Studio 疎通確認とモデル一覧のロード処理
const testLmStudioConnection = async () => {
    isTestingConnection.value = true;
    connectionState.value = 'idle';
    connectionErrorMsg.value = '';
    
    if (window.electronAPI) {
        try {
            const result = await window.electronAPI.getLmStudioModels(lmstudioEndpoint.value);
            if (result.success) {
                connectionState.value = 'success';
                lmstudioModels.value = result.models;
                if (!lmstudioModel.value && result.models.length > 0) {
                    lmstudioModel.value = result.models[0].id;
                }
            } else {
                connectionState.value = 'failed';
                connectionErrorMsg.value = result.error || '接続に失敗しました。';
                lmstudioModels.value = [];
            }
        } catch (e: any) {
            connectionState.value = 'failed';
            connectionErrorMsg.value = '通信エラーが発生しました。';
            lmstudioModels.value = [];
        }
    } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        connectionState.value = 'success';
        lmstudioModels.value = [
            { id: 'meta-llama-3-8b-instruct', capabilities: { vision: false } },
            { id: 'mistral-7b-instruct-v0.2', capabilities: { vision: false } }
        ];
        if (!lmstudioModel.value) {
            lmstudioModel.value = 'meta-llama-3-8b-instruct';
        }
    }
    isTestingConnection.value = false;
};

// VOICEVOX 疎通確認と話者（モデル）スタイル一覧のロード処理
const testVoicevoxConnection = async () => {
    isTestingVoicevox.value = true;
    voicevoxConnectionState.value = 'idle';
    voicevoxConnectionErrorMsg.value = '';
    
    if (window.electronAPI) {
        try {
            const result = await window.electronAPI.getVoicevoxSpeakers(voicevoxEndpoint.value);
            if (result.success) {
                voicevoxConnectionState.value = 'success';
                voicevoxSpeakers.value = result.speakers;
                const hasSpeaker = result.speakers.some((s) => s.value === voicevoxSpeaker.value);
                if (!hasSpeaker && result.speakers.length > 0) {
                    voicevoxSpeaker.value = result.speakers[0].value;
                }
            } else {
                voicevoxConnectionState.value = 'failed';
                voicevoxConnectionErrorMsg.value = result.error || '接続に失敗しました。';
                voicevoxSpeakers.value = [];
            }
        } catch (e: any) {
            voicevoxConnectionState.value = 'failed';
            voicevoxConnectionErrorMsg.value = '通信エラーが発生しました。';
            voicevoxSpeakers.value = [];
        }
    } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        voicevoxConnectionState.value = 'success';
        voicevoxSpeakers.value = [
            { name: '四国めたん (ノーマル)', value: 2 },
            { name: '四国めたん (あまあま)', value: 0 },
            { name: 'ずんだもん (ノーマル)', value: 3 },
            { name: 'ずんだもん (あまあま)', value: 1 }
        ];
    }
    isTestingVoicevox.value = false;
};

// --- サーバー接続 疎通確認用の状態変数・関数 ---
const isTestingServerConnection = ref(false);
const serverConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const serverConnectionErrorMsg = ref('');

const testServerConnection = async () => {
    isTestingServerConnection.value = true;
    serverConnectionState.value = 'idle';
    serverConnectionErrorMsg.value = '';
    
    if (window.electronAPI && window.electronAPI.testServerConnection) {
        try {
            const result = await window.electronAPI.testServerConnection(serverHost.value, serverPort.value);
            if (result.success) {
                serverConnectionState.value = 'success';
            } else {
                serverConnectionState.value = 'failed';
                serverConnectionErrorMsg.value = result.error || '接続に失敗しました。';
            }
        } catch (e: any) {
            serverConnectionState.value = 'failed';
            serverConnectionErrorMsg.value = '通信エラーが発生しました。';
        }
    } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        serverConnectionState.value = 'success';
    }
    isTestingServerConnection.value = false;
};

const serverConnectionClass = computed(() => {
    if (serverConnectionState.value === 'success') return 'status-success';
    if (serverConnectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const serverConnectionIcon = computed(() => {
    if (serverConnectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (serverConnectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const serverConnectionText = computed(() => {
    if (serverConnectionState.value === 'success') return '接続成功！サーバーは稼働しています。';
    if (serverConnectionState.value === 'failed') return `接続失敗: ${serverConnectionErrorMsg.value}`;
    return 'ホストとポートを入力して疎通テストを行ってください。';
});

// 疎通確認ステータスに応じた動的クラスおよびテキスト
const connectionClass = computed(() => {
    if (connectionState.value === 'success') return 'status-success';
    if (connectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const connectionIcon = computed(() => {
    if (connectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (connectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const connectionText = computed(() => {
    if (connectionState.value === 'success') return `接続成功 (ロード済みモデル数: ${lmstudioModels.value.length})`;
    if (connectionState.value === 'failed') return `接続失敗: ${connectionErrorMsg.value}`;
    return 'エンドポイントを入力して接続テストを行ってください。';
});

const voicevoxConnectionClass = computed(() => {
    if (voicevoxConnectionState.value === 'success') return 'status-success';
    if (voicevoxConnectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const voicevoxConnectionIcon = computed(() => {
    if (voicevoxConnectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (voicevoxConnectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const voicevoxConnectionText = computed(() => {
    if (voicevoxConnectionState.value === 'success') return `接続成功 (スタイル数: ${voicevoxSpeakers.value.length})`;
    if (voicevoxConnectionState.value === 'failed') return `接続失敗: ${voicevoxConnectionErrorMsg.value}`;
    return 'エンドポイントを入力して接続テストを行ってください。';
});

// 28個の感情スロットの初期化保証（親にも補助として残す）
const ensure28Expressions = (expressions: any[]): any[] => {
    const defaultEmotions = [
        '通常', '喜び', '怒り', '悲しみ', '驚き',
        '面白がり', '苛立ち', '賛同', '気遣い', '混乱',
        '好奇心', '欲求', '失望', '不賛成', '嫌悪',
        '当惑', '興奮', '恐れ', '感謝', '深い悲しみ',
        '愛情', '緊張', '楽観', '誇り', '気づき',
        '安堵', '後悔', '賞賛'
    ];
    
    const existingMap = new Map<string, any>();
    if (Array.isArray(expressions)) {
        expressions.forEach(e => {
            if (e && e.name) {
                existingMap.set(e.name.trim(), e);
            }
        });
    }
    
    return defaultEmotions.map(emotion => {
        const existing = existingMap.get(emotion);
        return {
            id: existing?.id || 'expr_' + emotion,
            name: emotion,
            path: existing?.path || '',
            offsetX: existing?.offsetX ?? 0,
            offsetY: existing?.offsetY ?? 0,
            scale: existing?.scale ?? 1.0
        };
    });
};

// 設定データのロード
onMounted(async () => {
    await configStore.loadConfig();

    if (useServer.value) {
        authStore.checkAuthStatus();
    }

    // Geminiのキャッシュロード
    const cachedModels = localStorage.getItem('geminiModelsCache');
    const cachedKey = localStorage.getItem('geminiApiKeyForCache');
    if (cachedModels && cachedKey === geminiApiKey.value) {
        try {
            const parsed = JSON.parse(cachedModels);
            geminiModels.value = parsed;
            geminiModelOptions.value = parsed;
            geminiConnectionState.value = 'success';
        } catch (e) {
            console.error('Failed to parse cached Gemini models', e);
        }
    }

    if (selectedEngine.value === 'lmstudio') {
        testLmStudioConnection();
    }
    
    if (selectedVoiceEngine.value === 'voicevox') {
        testVoicevoxConnection();
    }

    if (mascots.value.length === 0) {
        mascots.value = [{
            id: 'mascot_default',
            name: 'デフォルトロボット',
            avatar: '🤖',
            profile: '親しみやすいベーシックなAIマスコットです。明るく元気にユーザーのお手伝いをします。',
            aiConfig: {
                chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
            },
            assets: {
                outfits: [],
                expressions: ensure28Expressions([]),
                poses: []
            }
        }];
    } else {
        mascots.value.forEach(m => {
            m.assets.expressions = ensure28Expressions(m.assets.expressions);
            if (Array.isArray(m.assets.outfits)) {
                m.assets.outfits.forEach((o: any) => {
                    // 立ち絵ごとに独立した表情を持つため、グローバルからのコピーは廃止
                    // 未設定の場合は空の28スロットを確保する
                    o.expressions = ensure28Expressions(o.expressions || []);
                });
            }
        });
    }

    if (mascots.value.length > 0 && !activeMascotId.value) {
        activeMascotId.value = mascots.value[0].id;
    }
});

// 親でのリアルタイム同期用ハンドラー
const handleLiveUpdate = async () => {
    // リアクティブ同期の確認
};

// マスコットの追加処理
const addMascot = () => {
    const newId = 'mascot_' + Date.now();
    const newMascot = {
        id: newId,
        name: '新しいマスコット',
        avatar: '🤖',
        profile: '新しいAIマスコットです。',
        aiConfig: {
            chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
            voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
        },
        assets: {
            outfits: [],
            expressions: ensure28Expressions([]),
            poses: []
        }
    };
    mascots.value.push(newMascot);
    activeMascotId.value = newId;
    saveSettings();
};

// マスコットの削除処理
const deleteMascot = (mascotId: string) => {
    if (mascots.value.length <= 1) {
        alert('最後の1つのマスコットは削除できません。');
        return;
    }
    const targetMascot = mascots.value.find(m => m.id === mascotId);
    const mascotName = targetMascot ? targetMascot.name : 'このマスコット';
    if (!confirm(`マスコット「${mascotName}」を削除しますか？`)) {
        return;
    }
    
    mascots.value = mascots.value.filter(m => m.id !== mascotId);
    
    // 削除したマスコットがアクティブだった場合、別のアクティブマスコットを設定
    if (activeMascotId.value === mascotId) {
        activeMascotId.value = mascots.value[0].id;
    }
    saveSettings();
};

// 設定の保存処理
const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';

    await configStore.saveConfig();

    setTimeout(() => {
        saveStatus.value = '保存完了！';
        isSaving.value = false;
        setTimeout(() => {
            saveStatus.value = '設定を保存';
        }, 2000);
    }, 600);
};

const relaunchApp = () => {
    if (window.electronAPI && window.electronAPI.relaunchApp) {
        window.electronAPI.relaunchApp();
    }
};

const quitApp = () => {
    if (window.electronAPI) {
        window.electronAPI.quitApp();
    }
};

// --- マスコットサイズ調整用ハンドラー ---
const updateMascotScale = () => {
    if (window.electronAPI && window.electronAPI.setMascotScale) {
        window.electronAPI.setMascotScale(mascotScale.value);
    }
};

const changeScalePreset = (scale: number) => {
    mascotScale.value = scale;
    updateMascotScale();
};

// サイドバー開閉管理
const isSidebarCollapsed = ref(true);

const handleMouseEnter = () => {
    isSidebarCollapsed.value = false;
};

const handleMouseLeave = () => {
    isSidebarCollapsed.value = true;
};

const menuItems = ref([
    { name: 'マスコット', value: 'mascot', icon: 'pi pi-user' },
    { name: 'チャットAI', value: 'chat', icon: 'pi pi-comments' },
    { name: 'ウィンドウ設定', value: 'chatwindow', icon: 'pi pi-window-maximize' },
    { name: '音声AI', value: 'voice', icon: 'pi pi-volume-up' },
    { name: '画像AI', value: 'image', icon: 'pi pi-image' },
    { name: '動画AI', value: 'video', icon: 'pi pi-video' },
    { name: 'APIキー', value: 'apikey', icon: 'pi pi-key' }
]);
</script>

<template>
    <div class="settings-layout">
        <!-- 1. 左サイドバー -->
        <aside 
            class="sidebar drag-area" 
            :class="{ 'collapsed': isSidebarCollapsed }"
            @mouseenter="handleMouseEnter"
            @mouseleave="handleMouseLeave"
        >
            <div class="brand no-drag flex justify-content-between align-items-center">
                <div class="brand-info flex align-items-center gap-2" v-if="!isSidebarCollapsed">
                    <span class="logo">🤖</span>
                    <div class="brand-text">
                        <h2>Mascot App</h2>
                        <p>環境設定</p>
                    </div>
                </div>
                <div class="brand-info flex align-items-center justify-content-center w-full" v-else>
                    <span class="logo" style="font-size: 24px;">🤖</span>
                </div>
            </div>

            <!-- ナビゲーションメニュー -->
            <nav class="menu no-drag">
                <button 
                    v-for="item in menuItems"
                    :key="item.value"
                    class="menu-item" 
                    :class="{ active: activeMenu === item.value, 'collapsed': isSidebarCollapsed }"
                    @click="activeMenu = item.value"
                    :title="isSidebarCollapsed ? item.name : ''"
                >
                    <i :class="item.icon"></i>
                    <span v-if="!isSidebarCollapsed">{{ item.name }}</span>
                </button>
            </nav>

            <div class="sidebar-footer no-drag">
                <button class="relaunch-btn" @click="relaunchApp" :title="isSidebarCollapsed ? '再起動' : ''">
                    <i class="pi pi-refresh"></i>
                    <span v-if="!isSidebarCollapsed">再起動</span>
                </button>
                <button class="quit-btn" @click="quitApp" :title="isSidebarCollapsed ? 'アプリ終了' : ''">
                    <i class="pi pi-power-off"></i>
                    <span v-if="!isSidebarCollapsed">アプリ終了</span>
                </button>
            </div>
        </aside>

        <!-- 2. 右側メインコンテンツエリア -->
        <main class="main-content">
            <div class="content-container" :class="{ 'full-width': activeMenu === 'mascot' }">
                <!-- パネル1: マスコット (リファクタリング済み子コンポーネント) -->
                <div v-if="activeMenu === 'mascot'" class="panel-section">
                    <Card class="premium-card">
                        <template #content>
                            <MascotSettings 
                                :mascots="mascots"
                                v-model:activeMascotId="activeMascotId"
                                :geminiApiKey="geminiApiKey"
                                @live-update="handleLiveUpdate"
                                @save-settings="saveSettings"
                                @add-mascot="addMascot"
                                @delete-mascot="deleteMascot"
                            />
                        </template>
                    </Card>
                </div>

                <!-- パネル2: チャットAI -->
                <div v-else-if="activeMenu === 'chat'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>チャットAIエンジン設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">使用AIエンジン</label>
                                    <Select 
                                        v-model="selectedEngine" 
                                        :options="aiEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        optionDisabled="disabled"
                                        class="w-full" 
                                    />
                                </div>
                                
                                <div v-if="selectedEngine === 'lmstudio'" class="form-field mt-3">
                                    <label class="font-medium">LM Studio エンドポイント</label>
                                    <div class="flex gap-2 w-full">
                                        <InputText 
                                            v-model="lmstudioEndpoint" 
                                            placeholder="http://127.0.0.1:1234/v1/" 
                                            class="flex-1"
                                        />
                                        <Button 
                                            icon="pi pi-sync" 
                                            class="p-button-secondary" 
                                            title="疎通確認とモデル一覧再読み込み"
                                            :loading="isTestingConnection"
                                            @click="testLmStudioConnection" 
                                        />
                                    </div>
                                    
                                    <div class="connection-status mt-2" :class="connectionClass">
                                        <i :class="connectionIcon"></i>
                                        <span>{{ connectionText }}</span>
                                    </div>
                                </div>

                                <div class="form-field mt-3">
                                    <label class="font-medium">使用モデル名</label>
                                    
                                    <!-- Gemini -->
                                    <div v-if="selectedEngine === 'gemini'" class="flex flex-column gap-2 w-full">
                                        <div class="flex gap-2 w-full">
                                            <Select 
                                                v-model="geminiModel" 
                                                :options="geminiModelOptions" 
                                                editable
                                                placeholder="モデルを選択または直接入力..." 
                                                class="flex-1" 
                                            >
                                                <template #option="slotProps">
                                                    <div class="flex align-items-center justify-content-between w-full">
                                                        <span>{{ slotProps.option }}</span>
                                                        <div class="flex gap-1">
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isThought" class="pi pi-lightbulb text-purple-500" title="Thought" style="font-size: 0.75rem;"></i>
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isToolUse" class="pi pi-wrench text-green-600" title="Tool Use" style="font-size: 0.75rem;"></i>
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isImageGeneration" class="pi pi-image text-blue-500" title="Image Gen" style="font-size: 0.75rem;"></i>
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isVision" class="pi pi-eye text-amber-600" title="Vision" style="font-size: 0.75rem;"></i>
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isVideo" class="pi pi-video text-red-500" title="Video" style="font-size: 0.75rem;"></i>
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isAudio" class="pi pi-volume-up text-pink-500" title="Audio" style="font-size: 0.75rem;"></i>
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isStructuredOutput" class="pi pi-code text-teal-600" title="Structured" style="font-size: 0.75rem;"></i>
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isLongContext" class="pi pi-align-left text-indigo-500" title="Long Context" style="font-size: 0.75rem;"></i>
                                                            <i v-if="getModelCapabilities('gemini', slotProps.option).isLocal" class="pi pi-desktop text-slate-500" title="Local" style="font-size: 0.75rem;"></i>
                                                        </div>
                                                    </div>
                                                </template>
                                            </Select>
                                            <Button 
                                                icon="pi pi-sync" 
                                                class="p-button-secondary" 
                                                title="APIキーからGeminiモデル一覧を再読み込み"
                                                :loading="isTestingGemini"
                                                @click="fetchGeminiModels" 
                                            />
                                        </div>
                                        <div v-if="geminiConnectionState !== 'idle'" class="connection-status mt-1" :class="geminiConnectionClass">
                                            <i :class="geminiConnectionIcon"></i>
                                            <span class="ml-2 text-xs font-semibold">{{ geminiConnectionText }}</span>
                                        </div>
                                    </div>
                                    
                                    <!-- LM Studio -->
                                    <Select 
                                        v-else-if="selectedEngine === 'lmstudio' && lmstudioModels.length > 0"
                                        v-model="lmstudioModel" 
                                        :options="lmstudioModels" 
                                        optionLabel="id"
                                        optionValue="id"
                                        editable
                                        placeholder="モデルを選択または直接入力..." 
                                        class="w-full" 
                                    >
                                        <template #option="slotProps">
                                            <div class="flex align-items-center justify-content-between w-full">
                                                <span>{{ slotProps.option.id }}</span>
                                                <div class="flex gap-1">
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isThought" class="pi pi-lightbulb text-purple-500" title="Thought" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isToolUse" class="pi pi-wrench text-green-600" title="Tool Use" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isImageGeneration" class="pi pi-image text-blue-500" title="Image Gen" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isVision" class="pi pi-eye text-amber-600" title="Vision" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isVideo" class="pi pi-video text-red-500" title="Video" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isAudio" class="pi pi-volume-up text-pink-500" title="Audio" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isStructuredOutput" class="pi pi-code text-teal-600" title="Structured" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isLongContext" class="pi pi-align-left text-indigo-500" title="Long Context" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('lmstudio', slotProps.option.id).isLocal" class="pi pi-desktop text-slate-500" title="Local" style="font-size: 0.75rem;"></i>
                                                </div>
                                            </div>
                                        </template>
                                    </Select>
                                    <InputText 
                                        v-else-if="selectedEngine === 'lmstudio'"
                                        v-model="lmstudioModel" 
                                        placeholder="例: Meta-Llama-3-8B-Instruct-GGUF" 
                                        class="w-full" 
                                    />
                                    
                                    <!-- OpenAI -->
                                    <Select 
                                        v-else-if="selectedEngine === 'openai'"
                                        v-model="openaiModel" 
                                        :options="openaiModelOptions" 
                                        editable
                                        placeholder="モデルを選択または直接入力..." 
                                        class="w-full" 
                                    >
                                        <template #option="slotProps">
                                            <div class="flex align-items-center justify-content-between w-full">
                                                <span>{{ slotProps.option }}</span>
                                                <div class="flex gap-1">
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isThought" class="pi pi-lightbulb text-purple-500" title="Thought" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isToolUse" class="pi pi-wrench text-green-600" title="Tool Use" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isImageGeneration" class="pi pi-image text-blue-500" title="Image Gen" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isVision" class="pi pi-eye text-amber-600" title="Vision" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isVideo" class="pi pi-video text-red-500" title="Video" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isAudio" class="pi pi-volume-up text-pink-500" title="Audio" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isStructuredOutput" class="pi pi-code text-teal-600" title="Structured" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isLongContext" class="pi pi-align-left text-indigo-500" title="Long Context" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('openai', slotProps.option).isLocal" class="pi pi-desktop text-slate-500" title="Local" style="font-size: 0.75rem;"></i>
                                                </div>
                                            </div>
                                        </template>
                                    </Select>
                                    
                                    <!-- Anthropic -->
                                    <Select 
                                        v-else-if="selectedEngine === 'anthropic'"
                                        v-model="anthropicModel" 
                                        :options="anthropicModelOptions" 
                                        editable
                                        placeholder="モデルを選択または直接入力..." 
                                        class="w-full" 
                                    >
                                        <template #option="slotProps">
                                            <div class="flex align-items-center justify-content-between w-full">
                                                <span>{{ slotProps.option }}</span>
                                                <div class="flex gap-1">
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isThought" class="pi pi-lightbulb text-purple-500" title="Thought" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isToolUse" class="pi pi-wrench text-green-600" title="Tool Use" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isImageGeneration" class="pi pi-image text-blue-500" title="Image Gen" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isVision" class="pi pi-eye text-amber-600" title="Vision" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isVideo" class="pi pi-video text-red-500" title="Video" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isAudio" class="pi pi-volume-up text-pink-500" title="Audio" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isStructuredOutput" class="pi pi-code text-teal-600" title="Structured" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isLongContext" class="pi pi-align-left text-indigo-500" title="Long Context" style="font-size: 0.75rem;"></i>
                                                    <i v-if="getModelCapabilities('anthropic', slotProps.option).isLocal" class="pi pi-desktop text-slate-500" title="Local" style="font-size: 0.75rem;"></i>
                                                </div>
                                            </div>
                                        </template>
                                    </Select>

                                    <!-- モデル対応機能のアイコン表示 -->
                                    <div v-if="currentModelCapabilities && (currentModelCapabilities.isThought || currentModelCapabilities.isToolUse || currentModelCapabilities.isImageGeneration || currentModelCapabilities.isVision || currentModelCapabilities.isAudio || currentModelCapabilities.isStructuredOutput || currentModelCapabilities.isLongContext || currentModelCapabilities.isVideo || currentModelCapabilities.isLocal)" class="model-capabilities-badges flex flex-wrap gap-2 mt-2">
                                        <div 
                                            v-if="currentModelCapabilities.isThought" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(168, 85, 247, 0.08); border-color: rgba(168, 85, 247, 0.3); color: #7c3aed;"
                                            title="思考プロセスを出力できるモデル（Reasoning/Thinking）"
                                        >
                                            <i class="pi pi-lightbulb"></i>
                                            <span>Thought</span>
                                        </div>
                                        <div 
                                            v-if="currentModelCapabilities.isToolUse" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(34, 197, 94, 0.08); border-color: rgba(34, 197, 94, 0.3); color: #16a34a;"
                                            title="関数呼び出しや外部ツールの実行が可能なモデル"
                                        >
                                            <i class="pi pi-wrench"></i>
                                            <span>Tool Use</span>
                                        </div>
                                        <div 
                                            v-if="currentModelCapabilities.isImageGeneration" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.3); color: #2563eb;"
                                            title="画像の生成が可能なモデル"
                                        >
                                            <i class="pi pi-image"></i>
                                            <span>Image Gen</span>
                                        </div>
                                        <div 
                                            v-if="currentModelCapabilities.isVision" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.3); color: #d97706;"
                                            title="画像の入力・理解（マルチモーダル）が可能なモデル"
                                        >
                                            <i class="pi pi-eye"></i>
                                            <span>Vision</span>
                                        </div>
                                        <div 
                                            v-if="currentModelCapabilities.isVideo" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(220, 38, 38, 0.08); border-color: rgba(220, 38, 38, 0.3); color: #dc2626;"
                                            title="動画ファイルの入力・理解が可能なモデル"
                                        >
                                            <i class="pi pi-video"></i>
                                            <span>Video</span>
                                        </div>
                                        <div 
                                            v-if="currentModelCapabilities.isAudio" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(236, 72, 153, 0.08); border-color: rgba(236, 72, 153, 0.3); color: #db2777;"
                                            title="音声入力・出力（オーディオ連携）が可能なモデル"
                                        >
                                            <i class="pi pi-volume-up"></i>
                                            <span>Audio</span>
                                        </div>
                                        <div 
                                            v-if="currentModelCapabilities.isStructuredOutput" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(13, 148, 136, 0.08); border-color: rgba(13, 148, 136, 0.3); color: #0d9488;"
                                            title="JSONモードなど構造化した出力を強制できるモデル"
                                        >
                                            <i class="pi pi-code"></i>
                                            <span>Structured</span>
                                        </div>
                                        <div 
                                            v-if="currentModelCapabilities.isLongContext" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(79, 70, 229, 0.08); border-color: rgba(79, 70, 229, 0.3); color: #4f46e5;"
                                            title="10万トークン以上の長文コンテキストを読み込めるモデル"
                                        >
                                            <i class="pi pi-align-left"></i>
                                            <span>Long Context</span>
                                        </div>
                                        <div 
                                            v-if="currentModelCapabilities.isLocal" 
                                            class="capability-badge flex align-items-center gap-1.5 px-2 py-1 text-xs border-round border-1 font-semibold"
                                            style="background: rgba(71, 85, 105, 0.08); border-color: rgba(71, 85, 105, 0.3); color: #475569;"
                                            title="ローカルPC上でオフライン実行されているモデル"
                                        >
                                            <i class="pi pi-desktop"></i>
                                            <span>Local</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="form-field mt-3">
                                    <label class="font-medium flex justify-content-between">
                                        <span>Temperature (創造性): {{ temperature }}</span>
                                    </label>
                                    <Slider v-model="temperature" :min="0" :max="1" :step="0.1" class="mt-2" />
                                </div>
                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル2.5: ウィンドウ・ディスプレイ設定 -->
                <div v-else-if="activeMenu === 'chatwindow'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>ウィンドウ設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <!-- マスコットウィンドウ設定 -->
                                <div class="form-field-header font-bold text-base border-bottom pb-2 mb-2 text-purple-600 flex align-items-center gap-2">
                                    <i class="pi pi-user text-purple-500"></i>
                                    <span>マスコットウィンドウ設定</span>
                                </div>

                                <div class="form-field">
                                    <label class="font-medium flex justify-content-between">
                                        <span>表示サイズ (スケール): {{ Math.round((mascotScale || 1.0) * 100) }}%</span>
                                    </label>
                                    <Slider v-model="mascotScale" :min="0.5" :max="2.0" :step="0.1" class="mt-2" @change="updateMascotScale" />
                                </div>

                                <div class="form-field">
                                    <label class="font-medium">クイックサイズ変更</label>
                                    <div class="flex gap-2 mt-2">
                                        <Button label="50%" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': mascotScale === 0.5}" @click="changeScalePreset(0.5)" />
                                        <Button label="75%" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': mascotScale === 0.75}" @click="changeScalePreset(0.75)" />
                                        <Button label="100% (標準)" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': mascotScale === 1.0}" @click="changeScalePreset(1.0)" />
                                        <Button label="150%" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': mascotScale === 1.5}" @click="changeScalePreset(1.5)" />
                                    </div>
                                </div>

                                <div class="form-field mt-3">
                                    <label class="font-medium">最前面表示</label>
                                    <Select 
                                        v-model="alwaysOnTop" 
                                        :options="mascotAlwaysOnTopOptions" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>

                                <!-- チャットウィンドウ設定 -->
                                <div class="form-field-header font-bold text-base border-bottom pb-2 mt-4 mb-2 text-purple-600 flex align-items-center gap-2">
                                    <i class="pi pi-comments text-purple-500"></i>
                                    <span>チャットウィンドウ設定</span>
                                </div>

                                <!-- 背景色 & 不透明度の横並び -->
                                <div class="flex gap-3 mt-2">
                                    <div class="flex-1 form-field">
                                        <label class="font-medium flex justify-content-between">
                                            <span>メッセージエリア背景色</span>
                                        </label>
                                        <div class="flex align-items-center gap-2 mt-2">
                                            <input type="color" v-model="chatBackgroundColor" class="p-0 border-round cursor-pointer border-1 border-300" style="width: 40px; height: 32px;" />
                                            <InputText v-model="chatBackgroundColor" placeholder="#ffffff" class="flex-1" />
                                        </div>
                                    </div>
                                    <div class="flex-1 form-field flex flex-column justify-content-center">
                                        <label class="font-medium flex justify-content-between">
                                            <span>不透明度 (透明度): {{ Math.round(chatOpacity * 100) }}%</span>
                                        </label>
                                        <div class="mt-3">
                                            <Slider v-model="chatOpacity" :min="0.1" :max="1.0" :step="0.05" />
                                        </div>
                                    </div>
                                </div>

                                <!-- 境界線（枠）設定（グループボックス表示） -->
                                <fieldset class="border-round p-3 mt-3" style="border: 1px solid rgba(0, 0, 0, 0.12);">
                                    <legend class="px-2 text-sm font-semibold text-purple-600">枠</legend>
                                    <div class="flex align-items-center gap-3">
                                        <div class="flex align-items-center gap-2">
                                            <input type="checkbox" id="chatBorderShow" v-model="chatBorderShow" class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                                            <label for="chatBorderShow" class="cursor-pointer text-sm font-medium">表示</label>
                                        </div>
                                        
                                        <div v-if="chatBorderShow" class="flex align-items-center gap-2">
                                            <input type="color" v-model="chatBorderColor" class="p-0 border-round cursor-pointer border-1 border-300" style="width: 40px; height: 32px;" />
                                            <InputText v-model="chatBorderColor" placeholder="#a855f7" style="width: 100px; height: 32px;" />
                                        </div>
                                        
                                        <div v-if="chatBorderShow" class="flex align-items-center gap-2">
                                            <input v-model.number="chatBorderWidth" type="number" min="1" max="10" class="p-inputtext p-component" style="width: 60px; height: 32px;" />
                                            <span class="text-sm font-medium">px</span>
                                        </div>
                                    </div>
                                </fieldset>

                                <!-- 最前面表示 & 送信キーの横並び -->
                                <div class="flex gap-3 mt-3">
                                    <div class="flex-1 form-field">
                                        <label class="font-medium">最前面表示</label>
                                        <Select 
                                            v-model="chatAlwaysOnTop" 
                                            :options="chatAlwaysOnTopOptions" 
                                            optionLabel="name" 
                                            optionValue="value" 
                                            class="w-full mt-2" 
                                        />
                                    </div>

                                    <div class="flex-1 form-field">
                                        <label class="font-medium">送信キー割り当て</label>
                                        <Select 
                                            v-model="chatSendKey" 
                                            :options="sendKeyOptions" 
                                            optionLabel="name" 
                                            optionValue="value" 
                                            class="w-full mt-2" 
                                        />
                                    </div>
                                </div>

                                <!-- フォント選択 -->
                                <div class="form-field mt-3">
                                    <label class="font-medium">チャットウィンドウのフォント</label>
                                    <Select 
                                        v-model="chatFontFamily" 
                                        :options="fontFamilyOptions" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        editable
                                        placeholder="フォント名を選択または直接入力..."
                                        class="w-full mt-2" 
                                    />
                                </div>

                                <!-- サーバー連携設定 -->
                                <div class="form-field-header font-bold text-base border-bottom pb-2 mt-4 mb-2 text-purple-600 flex align-items-center gap-2">
                                    <i class="pi pi-server text-purple-500"></i>
                                    <span>サーバー連携設定 (マルチデバイス・軽量化)</span>
                                </div>

                                <div class="form-field mt-2 flex align-items-center gap-2">
                                    <input type="checkbox" id="useServer" v-model="useServer" class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                                    <label for="useServer" class="font-medium cursor-pointer ml-2">外部サーバーと連携する (クライアント＆サーバ構成を有効化)</label>
                                </div>

                                <div v-if="useServer" class="form-field mt-3 flex flex-column gap-3">
                                    <div class="flex gap-3">
                                        <div class="flex-1">
                                            <label class="font-medium">サーバーホスト (IPアドレス / ドメイン)</label>
                                            <InputText v-model="serverHost" placeholder="例: localhost または 192.168.1.10" class="w-full mt-1" />
                                        </div>
                                        <div style="width: 150px;">
                                            <label class="font-medium">ポート番号</label>
                                            <input v-model.number="serverPort" type="number" placeholder="例: 3000" class="p-inputtext p-component w-full mt-1" />
                                        </div>
                                    </div>

                                    <div class="flex justify-content-end mt-1">
                                        <Button 
                                            label="接続テストを実行" 
                                            icon="pi pi-sync" 
                                            class="p-button-outlined p-button-sm"
                                            :loading="isTestingServerConnection"
                                            @click="testServerConnection" 
                                        />
                                    </div>

                                    <div class="connection-status mt-1" :class="serverConnectionClass">
                                        <i :class="serverConnectionIcon"></i>
                                        <span class="ml-2">{{ serverConnectionText }}</span>
                                    </div>

                                     <!-- ログイン状態・認証UI -->
                                     <div class="auth-section mt-3 p-3 border-round bg-gray-50 border-1 border-300">
                                         <div class="flex align-items-center justify-content-between">
                                             <div class="flex align-items-center gap-2">
                                                 <i class="pi pi-user text-purple-500"></i>
                                                 <span class="font-bold">ログイン状態:</span>
                                                 <span v-if="isAuthenticated" class="text-green-600 font-semibold">{{ user?.email }}</span>
                                                 <span v-else class="text-red-500 font-semibold">未ログイン</span>
                                             </div>
                                             <div>
                                                 <Button 
                                                     v-if="!isAuthenticated"
                                                     label="Googleでログイン" 
                                                     icon="pi pi-google" 
                                                     class="p-button-sm p-button-success"
                                                     @click="authStore.login" 
                                                 />
                                                 <Button 
                                                     v-else
                                                     label="ログアウト" 
                                                     icon="pi pi-sign-out" 
                                                     class="p-button-sm p-button-danger p-button-outlined"
                                                     @click="authStore.logout" 
                                                 />
                                             </div>
                                         </div>
                                     </div>
                                 </div>

                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル3: 音声AI -->
                <div v-else-if="activeMenu === 'voice'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>音声生成AI設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">音声エンジン</label>
                                    <Select 
                                        v-model="selectedVoiceEngine" 
                                        :options="voiceEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>

                                <div v-if="selectedVoiceEngine === 'voicevox'" class="flex flex-column gap-3 mt-3">
                                    <div class="form-field">
                                        <label class="font-medium">VOICEVOX エンドポイント</label>
                                        <div class="flex gap-2 w-full">
                                            <InputText 
                                                v-model="voicevoxEndpoint" 
                                                placeholder="http://localhost:50021" 
                                                class="flex-1"
                                            />
                                            <Button 
                                                icon="pi pi-sync" 
                                                class="p-button-secondary" 
                                                title="疎通確認と話者一覧再読み込み"
                                                :loading="isTestingVoicevox"
                                                @click="testVoicevoxConnection" 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div class="connection-status mt-2" :class="voicevoxConnectionClass">
                                        <i :class="voicevoxConnectionIcon"></i>
                                        <span>{{ voicevoxConnectionText }}</span>
                                    </div>

                                    <div class="form-field mt-3">
                                        <label class="font-medium">使用話者スタイル (ボイスモデル)</label>
                                        <Select 
                                            v-if="voicevoxSpeakers.length > 0"
                                            v-model="voicevoxSpeaker" 
                                            :options="voicevoxSpeakers" 
                                            optionLabel="name" 
                                            optionValue="value" 
                                            placeholder="話者スタイルを選択..." 
                                            class="w-full" 
                                        />
                                        <div v-else class="flex gap-2 align-items-center w-full">
                                            <input 
                                                v-model.number="voicevoxSpeaker" 
                                                placeholder="話者ID (例: 2)" 
                                                class="p-inputtext w-full"
                                                type="number"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル4: 画像AI -->
                <div v-else-if="activeMenu === 'image'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>画像生成AI設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">画像生成AIエンジン</label>
                                    <Select 
                                        v-model="selectedImageEngine" 
                                        :options="imageEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>
                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル5: 動画AI -->
                <div v-else-if="activeMenu === 'video'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>動画生成AI設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">動画生成AIエンジン</label>
                                    <Select 
                                        v-model="selectedVideoEngine" 
                                        :options="videoEngines" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>
                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>

                <!-- パネル6: APIキー -->
                <div v-else-if="activeMenu === 'apikey'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>API認証情報設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <div class="form-field">
                                    <label class="font-medium">Google AI Studio (Gemini) API KEY</label>
                                    <Password 
                                        v-model="geminiApiKey" 
                                        toggleMask 
                                        :feedback="false" 
                                        class="w-full" 
                                        inputClass="w-full"
                                        placeholder="APIキーを入力..."
                                    />
                                </div>

                                <div class="form-field mt-3">
                                    <label class="font-medium">OpenAI API KEY</label>
                                    <Password 
                                        v-model="openaiApiKey" 
                                        toggleMask 
                                        :feedback="false" 
                                        class="w-full" 
                                        inputClass="w-full"
                                        placeholder="APIキーを入力..."
                                    />
                                </div>

                                <div class="form-field mt-3">
                                    <label class="font-medium">Anthropic (Claude) API KEY</label>
                                    <Password 
                                        v-model="anthropicApiKey" 
                                        toggleMask 
                                        :feedback="false" 
                                        class="w-full" 
                                        inputClass="w-full"
                                        placeholder="APIキーを入力..."
                                    />
                                </div>

                                <div class="form-field mt-3">
                                    <label class="font-medium">LM Studio API KEY</label>
                                    <InputText placeholder="LM Studio（ローカル環境）はAPIキー認証が不要です。" class="w-full" disabled />
                                </div>

                                <div class="flex justify-content-end mt-4">
                                    <Button 
                                        :label="saveStatus" 
                                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                                        class="p-button-primary" 
                                        :disabled="isSaving"
                                        @click="saveSettings" 
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>
            </div>
        </main>
    </div>
</template>

<style>
/* --- 全体レイアウト & ライトテーマ調プレミアムCSS --- */
.settings-layout {
    display: flex;
    height: 100vh;
    background: #f8fafc; /* ライトスレートグレー */
    color: #334155;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
}

/* 左サイドバー */
.sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 240px;
    background: #0f172a; /* ダークネイビー (コントラスト用) */
    color: #cbd5e1;
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1rem;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    box-shadow: 4px 0 25px rgba(0, 0, 0, 0.15);
}
.sidebar.collapsed {
    width: 72px;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.08);
}

.brand h2 {
    font-size: 16px;
    font-weight: 800;
    margin: 0;
    color: #ffffff;
}
.brand p {
    font-size: 10px;
    margin: 0;
    color: #64748b;
}

.menu {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 2rem;
    flex-grow: 1;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font-weight: 500;
    transition: all 0.2s ease;
    width: 100%;
}
.menu-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
}
.menu-item.active {
    background: #a855f7;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.25);
}

.sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.relaunch-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #eab308;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    font-weight: 600;
    transition: all 0.2s ease;
}
.relaunch-btn:hover {
    background: rgba(234, 179, 8, 0.1);
}

.quit-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #ef4444;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    font-weight: 600;
}
.quit-btn:hover {
    background: rgba(239, 68, 68, 0.1);
}

/* メインコンテンツ */
.main-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 2rem;
    margin-left: 72px; /* 折りたたみ時のサイドバー幅分の固定余白を確保してオーバーレイ化 */
}

.content-container {
    max-width: 800px;
    margin: 0 auto;
}
.content-container.full-width {
    max-width: 100%;
}

.premium-card {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    border-radius: 16px !important;
    box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05) !important;
    padding: 1.5rem !important;
}

/* 各フォーム項目 */
.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.form-field label {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
}

/* 疎通ステータス表示 */
.connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 12px;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-weight: 500;
}
.connection-status.status-success {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
}
.connection-status.status-failed {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
}
.connection-status.status-idle {
    background: #f8fafc;
    color: #64748b;
    border: 1px solid #e2e8f0;
}
</style>
