<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Card from 'primevue/card';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Select from 'primevue/select';
import Slider from 'primevue/slider';
import InputText from 'primevue/inputtext';
import { useConfigStore } from '../../store/config';
import { storeToRefs } from 'pinia';
import { MascotImageSetBuilder } from '../../mascots/MascotImageSetBuilder';

const configStore = useConfigStore();
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
    mascots,
    activeMascotId
} = storeToRefs(configStore);

const activeMenu = ref('mascot');

// --- AIエンジンのデータ定義 ---
const aiEngines = ref([
    { name: 'Gemini AI Studio', value: 'gemini' },
    { name: 'LM Studio (ローカル)', value: 'lmstudio' },
    { name: 'OpenAI (GPT-4o)', value: 'openai' },
    { name: 'Claude (Anthropic)', value: 'anthropic' }
]);

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
const lmstudioModels = ref<string[]>([]);

// VOICEVOX 疎通確認および話者ロード用の状態変数
const isTestingVoicevox = ref(false);
const voicevoxConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const voicevoxConnectionErrorMsg = ref('');
const voicevoxSpeakers = ref<{ name: string; value: number }[]>([]);

const alwaysOnTopOptions = ref([
    { name: '常に最前面に表示する', value: true },
    { name: '最前面に表示しない', value: false }
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
                // 現在選択されているモデル名が空で、ロードされたモデルがあれば自動セット
                if (!lmstudioModel.value && result.models.length > 0) {
                    lmstudioModel.value = result.models[0];
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
        // ブラウザ実行時（デモ用モック）
        await new Promise((resolve) => setTimeout(resolve, 1000));
        connectionState.value = 'success';
        lmstudioModels.value = ['meta-llama-3-8b-instruct', 'mistral-7b-instruct-v0.2'];
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
                // 現在選択されている話者IDが取得リストに存在しない場合、最初のスタイルを自動選択
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
        // ブラウザ実行時（デモ用モック）
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

// VOICEVOX用疎通確認表示Computed
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

// 設定データのロード
onMounted(async () => {
    await configStore.loadConfig();

    // LM Studio が現在のアクティブエンジンの場合、初期表示時に自動で疎通確認を実行
    if (selectedEngine.value === 'lmstudio') {
        testLmStudioConnection();
    }
    
    // 音声エンジンが voicevox の場合、初期表示時に自動で疎通確認を実行
    if (selectedVoiceEngine.value === 'voicevox') {
        testVoicevoxConnection();
    }

    // データがない場合は初期のモックデータを作成
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
        // ロードされたマスコットの表情スロットを保証
        mascots.value.forEach(m => {
            m.assets.expressions = ensure28Expressions(m.assets.expressions);
        });
    }

    if (mascots.value.length > 0) {
        // activeMascotId が空なら最初のマスコットをアクティブにする
        if (!activeMascotId.value) {
            activeMascotId.value = mascots.value[0].id;
        }
        const activeMascot = mascots.value.find(m => m.id === activeMascotId.value) || mascots.value[0];
        selectMascot(activeMascot);
    }
    activeMascotSubTab.value = 'expression';
});

// 設定の保存処理
const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';

    // 編集中のマスコットデータを強制同期 (spliceを使用してリアクティブ検知と保存を保証)
    if (editingMascot.value && editingMascot.value.id) {
        const idx = mascots.value.findIndex(m => m.id === editingMascot.value.id);
        if (idx !== -1) {
            mascots.value.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
        }
    }

    // ストアに現在の設定値を一括保存
    await configStore.saveConfig();

    setTimeout(() => {
        saveStatus.value = '保存完了！';
        isSaving.value = false;
        setTimeout(() => {
            saveStatus.value = '設定を保存';
        }, 2000);
    }, 600);
};

// アプリケーション終了の処理
const quitApp = () => {
    if (window.electronAPI) {
        window.electronAPI.quitApp();
    }
};

// --- マスコット関連のインターフェース・状態定義 ---
interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
    profile: string;
    currentOutfitId?: string;
    currentPoseId?: string;
    defaultExpressionId?: string;
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

const activeMascotSubTab = ref<'profile' | 'outfit' | 'expression' | 'pose'>('profile');

// 編集・追加対象のワークバッファ
const editingMascot = ref<MascotData>({
    id: '',
    name: '',
    avatar: '🤖',
    profile: '',
    aiConfig: {
        chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
        voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
    },
    assets: { outfits: [], expressions: [], poses: [] }
});

const activeOutfit = computed(() => {
    const mascot = editingMascot.value;
    if (!mascot || !mascot.assets?.outfits) return null;
    return mascot.assets.outfits.find(o => o.id === mascot.currentOutfitId) || mascot.assets.outfits[0] || null;
});

const activePose = computed(() => {
    const mascot = editingMascot.value;
    if (!mascot || !mascot.assets?.poses) return null;
    return mascot.assets.poses.find(p => p.id === mascot.currentPoseId) || mascot.assets.poses[0] || null;
});

const activeExpression = ref<MascotAsset | null>(null);

const editingMascotImageSet = computed(() => {
    const mascot = editingMascot.value;
    if (!mascot) return null;
    
    const assets = [
        ...(mascot.assets?.outfits || []),
        ...(mascot.assets?.expressions || []),
        ...(mascot.assets?.poses || [])
    ];
    
    return MascotImageSetBuilder.CreateFromAssets(mascot.name, assets);
});

const defaultFrontAvatar = computed(() => {
    return editingMascotImageSet.value?.getFrontImage() || null;
});

const selectMascot = (mascot: MascotData) => {
    if (editingMascot.value && editingMascot.value.id) {
        const idx = mascots.value.findIndex(m => m.id === editingMascot.value.id);
        if (idx !== -1) {
            mascots.value.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
        }
    }
    activeMascotId.value = mascot.id;
    editingMascot.value = JSON.parse(JSON.stringify(mascot));
    activeExpression.value = mascot.assets.expressions.find(e => e.name === '通常') || mascot.assets.expressions[0] || null;
};

// --- 立ち絵アセット（全身像）操作関数群 ---
const addOutfitImage = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        if (!editingMascot.value.assets.outfits) {
            editingMascot.value.assets.outfits = [];
        }
        
        const newOutfit: MascotAsset = {
            id: 'outfit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: '衣装_' + (editingMascot.value.assets.outfits.length + 1),
            path: result.path,
            offsetX: 0,
            offsetY: 0,
            scale: 1.0
        };
        
        editingMascot.value.assets.outfits.push(newOutfit);
        
        if (editingMascot.value.assets.outfits.length === 1 || !editingMascot.value.currentOutfitId) {
            editingMascot.value.currentOutfitId = newOutfit.id;
        }
        
        handleLiveUpdate();
    }
};

const setMainOutfit = (outfit: MascotAsset) => {
    editingMascot.value.currentOutfitId = outfit.id;
    handleLiveUpdate();
};

const deleteOutfit = (outfit: MascotAsset) => {
    if (confirm(`立ち絵アセットを削除しますか？`)) {
        editingMascot.value.assets.outfits = editingMascot.value.assets.outfits.filter(o => o.id !== outfit.id);
        if (editingMascot.value.currentOutfitId === outfit.id) {
            editingMascot.value.currentOutfitId = editingMascot.value.assets.outfits[0]?.id || '';
        }
        handleLiveUpdate();
    }
};

// サイドバー開閉管理
const isSidebarCollapsed = ref(true); // 基本は閉じている

const handleMouseEnter = () => {
    isSidebarCollapsed.value = false;
};

const handleMouseLeave = () => {
    isSidebarCollapsed.value = true;
};

const menuItems = ref([
    { name: 'マスコット', value: 'mascot', icon: 'pi pi-user' },
    { name: 'チャットAI', value: 'chat', icon: 'pi pi-comments' },
    { name: 'チャットウィンドウ', value: 'chatwindow', icon: 'pi pi-window-maximize' },
    { name: '音声AI', value: 'voice', icon: 'pi pi-volume-up' },
    { name: '画像AI', value: 'image', icon: 'pi pi-image' },
    { name: '動画AI', value: 'video', icon: 'pi pi-video' },
    { name: 'APIキー', value: 'apikey', icon: 'pi pi-key' }
]);

// 表情モーダル用状態変数
const isEditingExpressionsModal = ref(false);
const isAssigningEmotionsModal = ref(false);
const selectedModalExpression = ref<MascotAsset | null>(null);
const scannedSprites = ref<{ id: string; name: string; path: string }[]>([]);
const selectedScannedSprite = ref<any>(null);

// 画像クロップ (Crop) UI用状態変数
const isCropModalActive = ref(false);
const cropImageSrc = ref('');
const cropX = ref(50);
const cropY = ref(50);
const cropSize = ref(120);
const cropImageWidth = ref(0);
const cropImageHeight = ref(0);
const cropContainerRef = ref<HTMLDivElement | null>(null);
const cropImageRef = ref<HTMLImageElement | null>(null);

// AI生成状態
const isGeneratingProfile = ref(false);
const profilePromptNote = ref('');
const isScanningSprite = ref(false);
const spriteScanStatus = ref('');

// 28個の感情日本語名リスト (SillyTavern 28感情互換)
const sillyTavernEmotions = ref([
    '通常', '喜び', '怒り', '悲しみ', '驚き',
    '面白がり', '苛立ち', '賛同', '気遣い', '混乱',
    '好奇心', '欲求', '失望', '不賛成', '嫌悪',
    '当惑', '興奮', '恐れ', '感謝', '深い悲しみ',
    '愛情', '緊張', '楽観', '誇り', '気づき',
    '安堵', '後悔', '賞賛'
]);

// 28個の感情スロットの初期化保証
const ensure28Expressions = (expressions: MascotAsset[]): MascotAsset[] => {
    const defaultEmotions = [
        '通常', '喜び', '怒り', '悲しみ', '驚き',
        '面白がり', '苛立ち', '賛同', '気遣い', '混乱',
        '好奇心', '欲求', '失望', '不賛成', '嫌悪',
        '当惑', '興奮', '恐れ', '感謝', '深い悲しみ',
        '愛情', '緊張', '楽観', '誇り', '気づき',
        '安堵', '後悔', '賞賛'
    ];
    
    const existingMap = new Map<string, MascotAsset>();
    if (Array.isArray(expressions)) {
        expressions.forEach(e => {
            if (e && e.name) {
                existingMap.set(e.name.trim(), e);
            }
        });
    }
    
    return defaultEmotions.map(emotion => {
        const existing = existingMap.get(emotion);
        if (existing) {
            return {
                id: existing.id || 'expr_' + emotion,
                name: emotion,
                path: existing.path || '',
                offsetX: existing.offsetX ?? 0,
                offsetY: existing.offsetY ?? 0,
                scale: existing.scale ?? 1.0
            };
        } else {
            return {
                id: 'expr_' + emotion,
                name: emotion,
                path: '',
                offsetX: 0,
                offsetY: 0,
                scale: 1.0
            };
        }
    });
};

// --- 表情編集モーダル用関数 & リアルタイムプレビュー同期 ---
const openExpressionEditModal = () => {
    console.log('[ExpressionModal] openExpressionEditModal triggered. scannedSprites:', scannedSprites.value.length);
    editingMascot.value.assets.expressions = ensure28Expressions(editingMascot.value.assets.expressions);
    
    // デフォルトで「通常」の表情を選択
    selectedModalExpression.value = editingMascot.value.assets.expressions.find(e => e.name === '通常') || editingMascot.value.assets.expressions[0] || null;
    isEditingExpressionsModal.value = true;
};

const openExpressionEditModalWithExpression = (expr: MascotAsset) => {
    editingMascot.value.assets.expressions = ensure28Expressions(editingMascot.value.assets.expressions);
    selectedModalExpression.value = editingMascot.value.assets.expressions.find(e => e.id === expr.id) || null;
    isEditingExpressionsModal.value = true;
};

// 表情の微調整値を即座に反映させるためのハンドラー
const handleLiveUpdate = async () => {
    // ユーザー要望によりモーダル起動中のマスコットウィンドウへの即時反映は行わない
    // 編集中のマスコットデータを同期 (spliceを使ってVueのリアクティブ検知を確実化)
    const idx = mascots.value.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        mascots.value.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
        // 表情モーダル表示中はI/O負荷軽減のためディスク書き込みはスキップ
        if (!isEditingExpressionsModal.value && !isAssigningEmotionsModal.value) {
            await saveSettings();
        }
    }
};

const closeExpressionEditModal = async () => {
    isEditingExpressionsModal.value = false;
    activeExpression.value = editingMascot.value.assets.expressions.find(e => e.name === '通常') || editingMascot.value.assets.expressions[0] || null;
    
    // モーダルを閉じたタイミングで、調整された設定を一括保存しマスコットに適用
    const idx = mascots.value.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        mascots.value[idx] = JSON.parse(JSON.stringify(editingMascot.value));
        await saveSettings();
        console.log('[ExpressionModal] Expressions saved and synchronized.');
    }
};

const clearExpressionSlot = (slot: MascotAsset) => {
    if (confirm(`表情ラベル「${slot.name}」の画像を登録解除しますか？`)) {
        slot.path = '';
        // 標準表情に設定されていたら解除
        if (editingMascot.value.defaultExpressionId === slot.id) {
            editingMascot.value.defaultExpressionId = '';
        }
        if (selectedModalExpression.value?.name === slot.name) {
            selectedModalExpression.value = slot;
        }
        handleLiveUpdate();
    }
};

const registeredExpressions = computed(() => {
    if (!editingMascot.value || !Array.isArray(editingMascot.value.assets?.expressions)) return [];
    return editingMascot.value.assets.expressions.filter(e => e.path) || [];
});

const normalExpression = computed(() => {
    if (!editingMascot.value || !Array.isArray(editingMascot.value.assets?.expressions)) return null;
    return editingMascot.value.assets.expressions.find(e => e.name === '通常') || null;
});

const otherRegisteredExpressions = computed(() => {
    if (!editingMascot.value || !Array.isArray(editingMascot.value.assets?.expressions)) return [];
    return editingMascot.value.assets.expressions.filter(e => e.path && e.name !== '通常') || [];
});

const toggleDefaultExpression = (checked: boolean) => {
    if (selectedModalExpression.value) {
        if (checked) {
            editingMascot.value.defaultExpressionId = selectedModalExpression.value.id;
        } else {
            editingMascot.value.defaultExpressionId = '';
        }
        handleLiveUpdate();
    }
};

// --- 画像クロップ (Crop) 処理用メソッド群 ---
const startCropCurrentSlotImage = () => {
    if (selectedModalExpression.value && selectedModalExpression.value.path) {
        cropImageSrc.value = selectedModalExpression.value.path;
        cropX.value = 50;
        cropY.value = 50;
        cropSize.value = 120;
        isCropModalActive.value = true;
    }
};

const startCropNewImage = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        cropImageSrc.value = result.path;
        cropX.value = 50;
        cropY.value = 50;
        cropSize.value = 120;
        isCropModalActive.value = true;
    }
};

const handleCropImageLoaded = (event: Event) => {
    const img = event.target as HTMLImageElement;
    cropImageWidth.value = img.naturalWidth;
    cropImageHeight.value = img.naturalHeight;
};

// ドラッグ処理用の変数
let isDraggingCrop = false;
let startDragX = 0;
let startDragY = 0;
let startCropX = 0;
let startCropY = 0;

const onCropMouseDown = (event: MouseEvent) => {
    isDraggingCrop = true;
    startDragX = event.clientX;
    startDragY = event.clientY;
    startCropX = cropX.value;
    startCropY = cropY.value;
    event.preventDefault();
};

const onCropMouseMove = (event: MouseEvent) => {
    if (!isDraggingCrop || !cropContainerRef.value || !cropImageRef.value) return;
    
    const dx = event.clientX - startDragX;
    const dy = event.clientY - startDragY;
    
    const containerRect = cropContainerRef.value.getBoundingClientRect();
    const imageRect = cropImageRef.value.getBoundingClientRect();
    
    // スケール比率の算出
    const scaleX = cropImageWidth.value / imageRect.width;
    const scaleY = cropImageHeight.value / imageRect.height;
    
    let newX = startCropX + dx * scaleX;
    let newY = startCropY + dy * scaleY;
    
    // 範囲制限 (画像内)
    newX = Math.max(0, Math.min(cropImageWidth.value - cropSize.value, newX));
    newY = Math.max(0, Math.min(cropImageHeight.value - cropSize.value, newY));
    
    cropX.value = Math.round(newX);
    cropY.value = Math.round(newY);
};

const onCropMouseUp = () => {
    isDraggingCrop = false;
};

const executeCrop = async () => {
    if (!selectedModalExpression.value || !cropImageSrc.value) return;
    
    const img = new Image();
    img.src = cropImageSrc.value;
    await new Promise((resolve) => (img.onload = resolve));
    
    const canvas = document.createElement('canvas');
    canvas.width = cropSize.value;
    canvas.height = cropSize.value;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(
            img,
            cropX.value,
            cropY.value,
            cropSize.value,
            cropSize.value,
            0,
            0,
            cropSize.value,
            cropSize.value
        );
        
        const croppedBase64 = canvas.toDataURL('image/png');
        selectedModalExpression.value.path = croppedBase64;
        
        isCropModalActive.value = false;
        handleLiveUpdate();
    }
};

// --- AI表情スキャナー（Gemini Vision）による解析と感情分別 ---
const importFromSpriteSheet = async () => {
    if (!window.electronAPI) return;
    
    const result = await window.electronAPI.selectLocalImage();
    if (!result || !result.success) return;
    
    isScanningSprite.value = true;
    spriteScanStatus.value = 'AIで表情スプライトをスキャン中...';
    
    try {
        const configData = await window.electronAPI.getAppConfig();
        const apiKey = configData.googleAiStudioApiKey || geminiApiKey.value;
        if (!apiKey) {
            alert('Google AI Studio APIキーを設定してください。');
            isScanningSprite.value = false;
            return;
        }
        
        const scanResults = await window.electronAPI.analyzeSpriteSheet(result.path, apiKey);
        if (scanResults.error) {
            throw new Error(scanResults.error);
        }
        
        spriteScanStatus.value = `解析完了: ${scanResults.length}個の表情を検出。スプライトを切り出し中...`;
        
        const img = new Image();
        img.src = result.path;
        await new Promise((resolve) => (img.onload = resolve));
        
        scannedSprites.value = [];
        
        const emotionTranslationMap: Record<string, string> = {
            admiration: '賞賛',
            amusement: '面白がり',
            anger: '怒り',
            annoyance: '苛立ち',
            approval: '賛同',
            caring: '気遣い',
            confusion: '混乱',
            curiosity: '好奇心',
            desire: '欲求',
            disappointment: '失望',
            disapproval: '不賛成',
            disgust: '嫌悪',
            embarrassment: '当惑',
            excitement: '興奮',
            fear: '恐れ',
            gratitude: '感謝',
            grief: '深い悲しみ',
            joy: '喜び',
            love: '愛情',
            nervousness: '緊張',
            optimism: '楽観',
            pride: '誇り',
            realization: '気づき',
            relief: '安堵',
            remorse: '後悔',
            sadness: '悲しみ',
            surprise: '驚き',
            neutral: '通常'
        };
        
        for (const res of scanResults) {
            const [ymin, xmin, ymax, xmax] = res.box_2d; // 0-1000の正規化座標
            const label = res.label;
            
            const canvas = document.createElement('canvas');
            const width = ((xmax - xmin) * img.width) / 1000;
            const height = ((ymax - ymin) * img.height) / 1000;
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(
                    img,
                    (xmin * img.width) / 1000,
                    (ymin * img.height) / 1000,
                    width,
                    height,
                    0,
                    0,
                    width,
                    height
                );
                
                const croppedBase64 = canvas.toDataURL('image/png');
                const rawLabel = label.trim();
                const translatedLabel = emotionTranslationMap[rawLabel.toLowerCase()] || rawLabel;
                
                // 自動分別：対応する日本語感情名があれば即座に割り当て
                const targetSlot = editingMascot.value.assets.expressions.find(
                    e => e.name.toLowerCase() === translatedLabel.toLowerCase()
                );
                if (targetSlot) {
                    targetSlot.path = croppedBase64;
                    console.log(`[SpriteScan] Auto-assigned to: ${targetSlot.name}`);
                }
                
                // 感情割り当てトレイに格納
                scannedSprites.value.push({
                    id: 'sprite_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: translatedLabel,
                    path: croppedBase64
                });
            }
        }
        
        console.log('[SpriteScan] Successfully completed. scannedSprites:', scannedSprites.value.length);
        alert(`${scanResults.length}個の表情を検出しました。感情割り当てモーダルで個別調整・再割り当てを行ってください。`);
        
        // 感情割り当て画面を自動起動
        isAssigningEmotionsModal.value = true;
    } catch (e: any) {
        console.error('Sprite scan failed:', e);
        alert('解析に失敗しました: ' + e.message);
    } finally {
        isScanningSprite.value = false;
        spriteScanStatus.value = '';
    }
};

// --- AIスプライト感情割り当て画面用メソッド ---
const selectScannedSprite = (sprite: any) => {
    if (selectedScannedSprite.value?.id === sprite.id) {
        selectedScannedSprite.value = null;
    } else {
        selectedScannedSprite.value = sprite;
    }
};

const assignSpriteToSlot = (slot: MascotAsset) => {
    if (!selectedScannedSprite.value) return;
    slot.path = selectedScannedSprite.value.path;
    
    // トレイから割り当て済みのものを除外
    scannedSprites.value = scannedSprites.value.filter(s => s.id !== selectedScannedSprite.value.id);
    selectedScannedSprite.value = null;
    handleLiveUpdate();
};

const closeAssigningEmotionsModal = async () => {
    isAssigningEmotionsModal.value = false;
    activeExpression.value = editingMascot.value.assets.expressions.find(e => e.name === '通常') || editingMascot.value.assets.expressions[0] || null;
    
    // 一括保存し適用
    const idx = mascots.value.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        mascots.value[idx] = JSON.parse(JSON.stringify(editingMascot.value));
        await saveSettings();
        console.log('[AssigningEmotionsModal] Saved expressions and synchronized.');
    }
};

// ドラッグ＆ドロップ用ハンドラー
const onSpriteDragStart = (event: DragEvent, sprite: any) => {
    if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', sprite.id);
        event.dataTransfer.effectAllowed = 'copy';
    }
};

const onSpriteDrop = (event: DragEvent, slot: MascotAsset) => {
    event.preventDefault();
    const spriteId = event.dataTransfer?.getData('text/plain');
    if (!spriteId) return;
    
    const sprite = scannedSprites.value.find(s => s.id === spriteId);
    if (sprite) {
        slot.path = sprite.path;
        scannedSprites.value = scannedSprites.value.filter(s => s.id !== spriteId);
        handleLiveUpdate();
    }
};
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

            <!-- 最下部：アプリ終了ボタン -->
            <div class="sidebar-footer no-drag">
                <button class="quit-btn" @click="quitApp" :title="isSidebarCollapsed ? 'アプリ終了' : ''">
                    <i class="pi pi-power-off"></i>
                    <span v-if="!isSidebarCollapsed">アプリ終了</span>
                </button>
            </div>
        </aside>

        <!-- 2. 右側メインコンテンツエリア -->
        <main class="main-content">
            <div class="content-container" :class="{ 'full-width': activeMenu === 'mascot' }">
                <!-- パネル1: マスコット -->
                <div v-if="activeMenu === 'mascot'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>マスコット設定</template>
                        <template #content>
                            <div class="flex gap-4">
                                <!-- 左側: マスコットリスト -->
                                <div class="mascot-list flex flex-column gap-3" style="width: 240px; min-width: 240px; max-height: calc(100vh - 160px); overflow-y: auto;">
                                    <div 
                                        v-for="mascot in mascots" 
                                        :key="mascot.id"
                                        class="mascot-item"
                                        :class="{ active: activeMascotId === mascot.id }"
                                        @click="selectMascot(mascot)"
                                    >
                                        <div class="avatar-container flex align-items-center justify-content-center bg-slate-50 border-round overflow-hidden" style="width: 150px; height: 200px; font-size: 64px; flex-shrink: 0; border: 1px solid rgba(0, 0, 0, 0.04);">
                                            <img v-if="mascot.avatar && mascot.avatar.startsWith('data:image/')" :src="mascot.avatar" style="width: 100%; height: 100%; object-fit: contain;" />
                                            <span v-else class="avatar">{{ mascot.avatar || '🤖' }}</span>
                                        </div>
                                        <div class="info">
                                            <span class="name">{{ mascot.name }}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- 右側: マスコットアセット・詳細調整 -->
                                <div class="flex-1 bg-slate-50 border-round p-3 border-1 border-gray-200 flex flex-column gap-3">
                                    <div class="flex justify-content-between align-items-center">
                                        <h3 class="m-0 text-gray-800 font-bold flex align-items-center gap-2">
                                            <i class="pi pi-cog text-purple-400"></i>
                                            <span>マスコット詳細設定</span>
                                        </h3>
                                    </div>

                                    <!-- サブタブ -->
                                    <div class="flex border-bottom border-gray-200 pb-2 gap-2">
                                        <Button 
                                            label="表情アセット" 
                                            icon="pi pi-sliders-h" 
                                            class="p-button-sm"
                                            :class="activeMascotSubTab === 'expression' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                                            @click="activeMascotSubTab = 'expression'"
                                        />
                                        <Button 
                                            label="立ち絵（全身像）" 
                                            icon="pi pi-image" 
                                            class="p-button-sm"
                                            :class="activeMascotSubTab === 'outfit' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                                            @click="activeMascotSubTab = 'outfit'"
                                        />
                                        <Button 
                                            label="プロフィール" 
                                            icon="pi pi-user" 
                                            class="p-button-sm"
                                            :class="activeMascotSubTab === 'profile' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                                            @click="activeMascotSubTab = 'profile'"
                                        />
                                    </div>

                                    <!-- サブタブ中身: 表情アセット -->
                                    <div v-if="activeMascotSubTab === 'expression'" class="flex flex-column gap-3">
                                        <div class="flex gap-2">
                                            <Button 
                                                label="表情を編集・位置調整 (大画面エディタ)" 
                                                icon="pi pi-sliders-h" 
                                                class="p-button-primary p-button-sm flex-1"
                                                @click="openExpressionEditModal"
                                            />
                                            <Button 
                                                v-if="scannedSprites.length > 0"
                                                label="感情割り当て画面を開く" 
                                                icon="pi pi-sparkles" 
                                                class="p-button-sm p-button-outlined p-button-info"
                                                @click="isAssigningEmotionsModal = true"
                                            />
                                            <Button 
                                                label="AIスプライトインポート" 
                                                icon="pi pi-sparkles" 
                                                class="p-button-sm p-button-outlined p-button-secondary"
                                                :loading="isScanningSprite"
                                                @click="importFromSpriteSheet"
                                            />
                                        </div>

                                        <!-- 4列 x n行 の表情アセットグリッド -->
                                        <div class="form-field p-3 bg-white border-round border-1 border-gray-200 mt-2 flex flex-column gap-2">
                                            <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                                                <i class="pi pi-images text-purple-500"></i>
                                                <span>表情グリッド ({{ registeredExpressions.length }} / 28 登録済み)</span>
                                            </label>
                                            
                                            <div class="expression-grid-container pt-1" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-height: 420px; overflow-y: auto; width: 100%;">
                                                <div 
                                                    v-for="expr in editingMascot.assets.expressions" 
                                                    :key="expr.id"
                                                    class="expression-grid-cell relative flex flex-column align-items-center justify-content-center border-round border-1 border-gray-200 cursor-pointer bg-slate-50 overflow-hidden p-2"
                                                    style="height: 108px; width: 100%; min-width: 0;"
                                                    :class="{
                                                        'has-image bg-white': expr.path,
                                                        'default-expression': editingMascot.defaultExpressionId === expr.id
                                                    }"
                                                    @click="openExpressionEditModalWithExpression(expr)"
                                                    title="クリックして位置調整を開く"
                                                >
                                                    <!-- 右上の標準（通常表示）スターバッジ -->
                                                    <div v-if="editingMascot.defaultExpressionId === expr.id" class="absolute" style="top: 6px; right: 6px; z-index: 2;" title="通常表示（標準）">
                                                        <i class="pi pi-star-fill text-yellow-500" style="font-size: 10px;"></i>
                                                    </div>

                                                    <!-- 表情画像 -->
                                                    <div class="flex align-items-center justify-content-center border-round bg-white overflow-hidden" style="width: 52px; height: 52px; border: 1px solid rgba(0,0,0,0.03); flex-shrink: 0;">
                                                        <img v-if="expr.path" :src="expr.path" class="w-full h-full object-contain" />
                                                        <i v-else class="pi pi-plus text-gray-300 hover-text-gray-400" style="font-size: 12px;" title="表情を追加"></i>
                                                    </div>

                                                    <!-- 画像の下の表情ラベル -->
                                                    <span class="text-xxs font-bold text-gray-600 text-center w-full text-ellipsis overflow-hidden mt-2 select-none flex align-items-center justify-content-center" style="height: 20px; line-height: 1; text-align: center; justify-content: center; align-items: center;">
                                                        {{ expr.name }}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 標準（通常表示）の表情設定 -->
                                        <div class="form-field p-3 bg-white border-round border-1 border-gray-200 flex flex-column gap-2 mt-2">
                                            <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                                                <i class="pi pi-star text-yellow-500"></i>
                                                <span>通常表示（標準）の表情</span>
                                            </label>
                                            <Select 
                                                v-model="editingMascot.defaultExpressionId" 
                                                :options="registeredExpressions" 
                                                optionLabel="name" 
                                                optionValue="id" 
                                                placeholder="標準として表示する表情を選択..." 
                                                class="w-full p-inputtext-sm" 
                                                @change="handleLiveUpdate"
                                            />
                                            <span class="text-xxs text-gray-500 select-none">
                                                ※表情スロットに画像が登録されたもののみドロップダウンで選択できます。
                                            </span>
                                        </div>
                                    </div>

                                    <!-- サブタブ中身: 立ち絵（全身像） -->
                                    <div v-else-if="activeMascotSubTab === 'outfit'" class="flex flex-column gap-3">
                                        <div class="flex gap-2">
                                            <Button 
                                                label="ローカル画像から立ち絵を追加" 
                                                icon="pi pi-file-import" 
                                                class="p-button-primary p-button-sm flex-1"
                                                @click="addOutfitImage"
                                            />
                                        </div>

                                        <div class="form-field p-3 bg-white border-round border-1 border-gray-200 mt-2 flex flex-column gap-2">
                                            <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                                                <i class="pi pi-image text-purple-500"></i>
                                                <span>登録済みの立ち絵 (全身像)</span>
                                            </label>

                                            <div v-if="editingMascot.assets.outfits && editingMascot.assets.outfits.length > 0" class="outfit-grid-container pt-1" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 300px; overflow-y: auto; width: 100%;">
                                                <div 
                                                    v-for="outfit in editingMascot.assets.outfits" 
                                                    :key="outfit.id"
                                                    class="outfit-grid-cell relative flex flex-column align-items-center justify-content-center border-round border-1 border-gray-200 bg-white p-2"
                                                    style="height: 160px; min-width: 0;"
                                                >
                                                    <!-- アクティブバッジ -->
                                                    <div v-if="editingMascot.currentOutfitId === outfit.id" class="absolute" style="top: 6px; right: 6px; z-index: 2;" title="現在使用中">
                                                        <i class="pi pi-check-circle text-green-500" style="font-size: 14px;"></i>
                                                    </div>

                                                    <div class="flex align-items-center justify-content-center border-round bg-white overflow-hidden cursor-pointer" style="width: 70px; height: 100px; border: 1px solid rgba(0,0,0,0.03); flex-shrink: 0;" @click="setMainOutfit(outfit)" title="クリックしてデフォルトの立ち絵に設定">
                                                        <img :src="outfit.path" class="w-full h-full object-contain" />
                                                    </div>
                                                    
                                                    <div class="flex gap-2 mt-2 w-full justify-content-center">
                                                        <Button icon="pi pi-trash" class="p-button-danger p-button-text p-button-sm" @click="deleteOutfit(outfit)" title="削除" />
                                                        <Button :icon="editingMascot.currentOutfitId === outfit.id ? 'pi pi-star-fill text-yellow-500' : 'pi pi-star'" class="p-button-text p-button-sm" @click="setMainOutfit(outfit)" title="メイン立ち絵に設定" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div v-else class="text-xs text-gray-400 text-center py-4 select-none">
                                                ※立ち絵が登録されていません。「ローカル画像から立ち絵を追加」から全身画像を設定してください。
                                            </div>
                                        </div>
                                    </div>

                                    <!-- サブタブ中身: プロフィール -->
                                    <div v-else class="flex flex-column gap-2">
                                        <div class="form-field">
                                            <label class="text-xs font-semibold text-gray-700">マスコットキャラクターの性格・プロファイル</label>
                                            <textarea 
                                                v-model="editingMascot.profile" 
                                                placeholder="例: ツンデレなアンドロイド女子高生..." 
                                                rows="5"
                                                class="w-full p-2 bg-white border-1 border-gray-200 border-round text-gray-800 text-sm focus:border-purple-400 focus:outline-none"
                                                style="resize: none;"
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                        class="w-full" 
                                    />
                                </div>
                                
                                <!-- LM Studio エンドポイント (チャットAIパネルに統合) -->
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
                                    
                                    <!-- 疎通確認結果ステータス表示 -->
                                    <div class="connection-status mt-2" :class="connectionClass">
                                        <i :class="connectionIcon"></i>
                                        <span>{{ connectionText }}</span>
                                    </div>
                                </div>

                                <!-- 使用モデル名 (エンジン選択に動的連動) -->
                                <div class="form-field mt-3">
                                    <label class="font-medium">使用モデル名</label>
                                    <InputText 
                                        v-if="selectedEngine === 'gemini'"
                                        v-model="geminiModel" 
                                        placeholder="例: gemini-2.0-flash-exp" 
                                        class="w-full" 
                                    />
                                    
                                    <!-- LM Studio用のモデル選択ドロップダウン (手動入力も可) -->
                                    <Select 
                                        v-else-if="selectedEngine === 'lmstudio' && lmstudioModels.length > 0"
                                        v-model="lmstudioModel" 
                                        :options="lmstudioModels" 
                                        editable
                                        placeholder="モデルを選択または直接入力..." 
                                        class="w-full" 
                                    />
                                    <InputText 
                                        v-else-if="selectedEngine === 'lmstudio'"
                                        v-model="lmstudioModel" 
                                        placeholder="例: Meta-Llama-3-8B-Instruct-GGUF" 
                                        class="w-full" 
                                    />
                                    
                                    <InputText 
                                        v-else-if="selectedEngine === 'openai'"
                                        v-model="openaiModel" 
                                        placeholder="例: gpt-4o" 
                                        class="w-full" 
                                    />
                                    <InputText 
                                        v-else-if="selectedEngine === 'anthropic'"
                                        v-model="anthropicModel" 
                                        placeholder="例: claude-3-5-sonnet-latest" 
                                        class="w-full" 
                                    />
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

                <!-- パネル2.5: チャットウィンドウ -->
                <div v-else-if="activeMenu === 'chatwindow'" class="panel-section">
                    <Card class="premium-card">
                        <template #title>チャットウィンドウ設定</template>
                        <template #content>
                            <div class="flex flex-column gap-4">
                                <!-- 1. 透明度 -->
                                <div class="form-field">
                                    <label class="font-medium flex justify-content-between">
                                        <span>不透明度 (透明度): {{ Math.round(chatOpacity * 100) }}%</span>
                                    </label>
                                    <Slider v-model="chatOpacity" :min="0.1" :max="1.0" :step="0.05" class="mt-2" />
                                </div>

                                <!-- 2. 最前面表示 -->
                                <div class="form-field mt-3">
                                    <label class="font-medium">最前面表示</label>
                                    <Select 
                                        v-model="chatAlwaysOnTop" 
                                        :options="alwaysOnTopOptions" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>

                                <!-- 3. 送信キー割り当て -->
                                <div class="form-field mt-3">
                                    <label class="font-medium">送信キー割り当て</label>
                                    <Select 
                                        v-model="chatSendKey" 
                                        :options="sendKeyOptions" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full" 
                                    />
                                </div>

                                <!-- 4. フォントファミリー -->
                                <div class="form-field mt-3">
                                    <label class="font-medium">チャットウィンドウのフォント</label>
                                    <Select 
                                        v-model="chatFontFamily" 
                                        :options="fontFamilyOptions" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        editable
                                        placeholder="フォント名を選択または直接入力..."
                                        class="w-full" 
                                    />
                                </div>

                                <!-- 保存ボタン -->
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

                                <!-- VOICEVOX 設定エリア (疎通テストと話者・スタイル選択) -->
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
                                    
                                    <!-- 疎通結果表示 -->
                                    <div class="connection-status mt-2" :class="voicevoxConnectionClass">
                                        <i :class="voicevoxConnectionIcon"></i>
                                        <span>{{ voicevoxConnectionText }}</span>
                                    </div>

                                    <!-- 話者・キャラクタースタイル選択 (ボイスモデル選択) -->
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
                                <!-- Google AI Studio -->
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

                                <!-- OpenAI -->
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

                                <!-- Anthropic -->
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

                                <!-- LM Studio -->
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

        <!-- 3. 表情編集大画面モーダル (左縦リスト & 右特大プレビュー + 縦スライダー) -->
        <div v-if="isEditingExpressionsModal" class="custom-modal-overlay expression-edit-modal-overlay">
            <div class="custom-modal-card expression-edit-modal-card">
                <div class="modal-header flex justify-content-between align-items-center pb-3 border-bottom border-gray-700">
                    <h2 class="text-xl font-bold flex align-items-center gap-2 m-0 text-white">
                        <i class="pi pi-sliders-h text-purple-400"></i>
                        <span>表情エディタ & 位置調整 (SillyTavern 28感情互換)</span>
                    </h2>
                    <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" @click="closeExpressionEditModal" />
                </div>

                <div class="modal-body-container flex gap-4 mt-3 overflow-hidden flex-1" style="min-height: 0;">
                    <!-- 左カラム: 表情スロット縦スリムリスト (幅240px) -->
                    <div class="flex flex-column gap-2" style="width: 240px; min-width: 240px;">
                        <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider select-none">表情スロットリスト</span>
                        <div class="flex-1 overflow-y-auto pr-1 flex flex-column gap-2 expression-vertical-list">
                            <div 
                                v-for="slot in editingMascot.assets.expressions" 
                                :key="slot.id"
                                class="expression-vertical-item flex align-items-center gap-2 p-2 border-round cursor-pointer transition-all border-1"
                                :class="{
                                    'active': selectedModalExpression?.id === slot.id,
                                    'has-image': slot.path,
                                    'empty': !slot.path
                                }"
                                @click="selectedModalExpression = slot"
                                @dragover.prevent
                                @drop="onSpriteDrop($event, slot)"
                            >
                                <div class="slot-thumbnail flex align-items-center justify-content-center border-round overflow-hidden bg-gray-950">
                                    <img v-if="slot.path" :src="slot.path" class="thumbnail-img" />
                                    <i v-else class="pi pi-image text-gray-600 text-xs"></i>
                                </div>
                                <div class="flex flex-column flex-1 overflow-hidden">
                                    <span class="text-xs font-bold text-white text-ellipsis overflow-hidden">{{ slot.name }}</span>
                                    <span class="text-xxs text-gray-500 font-medium select-none">
                                        {{ slot.path ? '画像登録済み' : '未登録 (D&D可)' }}
                                    </span>
                                </div>
                                <div v-if="editingMascot.defaultExpressionId === slot.id" class="default-badge" title="標準表情">
                                    <i class="pi pi-star-fill text-yellow-400 text-xs"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 右カラム: 大型マスコットプレビュー & 位置調整コントロール -->
                    <div v-if="selectedModalExpression" class="flex-1 flex flex-column gap-3 overflow-hidden">
                        <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider select-none">位置調整 & ライブプレビュー</span>
                        
                        <!-- プレビューと縦スライダーのコンテナ -->
                        <div class="flex-1 flex gap-3 align-items-center justify-content-center overflow-hidden">
                            <!-- プレビューカード -->
                            <div class="flex-1 border-1 border-gray-700 border-round bg-gray-950 flex align-items-center justify-content-center relative overflow-hidden" style="height: 520px;">
                                <div class="mascot-composite-preview large-preview relative flex align-items-center justify-content-center" style="width: 420px; height: 420px;">
                                    <!-- ポーズ/服装ベースアバター（画像アセット優先解決） -->
                                    <!-- 1. ポーズ画像優先 -->
                                    <template v-if="activePose && activePose.path.startsWith('data:image/')">
                                        <img :src="activePose.path" class="preview-full-img w-full h-full object-contain" />
                                    </template>
                                    <!-- 2. 衣装画像優先 -->
                                    <template v-else-if="activeOutfit && activeOutfit.path.startsWith('data:image/')">
                                        <img :src="activeOutfit.path" class="preview-full-img w-full h-full object-contain" />
                                    </template>
                                    <!-- 3. フロント画像優先 -->
                                    <template v-else-if="defaultFrontAvatar && defaultFrontAvatar.path.startsWith('data:image/')">
                                        <img :src="defaultFrontAvatar.path" class="preview-full-img w-full h-full object-contain" />
                                    </template>
                                    <!-- 4. アバター画像優先 -->
                                    <template v-else-if="editingMascot && editingMascot.avatar && editingMascot.avatar.startsWith('data:image/')">
                                        <img :src="editingMascot.avatar" class="preview-full-img w-full h-full object-contain" />
                                    </template>
                                    <!-- 5. 画像がなければ文字列アセット（ポーズ > 衣装 > アバター > ロボット）の順で表示 -->
                                    <template v-else-if="activePose && activePose.path">
                                        <span class="preview-base-avatar font-bold text-6xl text-gray-500 select-none">{{ activePose.path }}</span>
                                    </template>
                                    <template v-else-if="activeOutfit && activeOutfit.path">
                                        <span class="preview-base-avatar font-bold text-6xl text-gray-500 select-none">{{ activeOutfit.path }}</span>
                                    </template>
                                    <template v-else-if="editingMascot">
                                        <span class="preview-base-avatar font-bold text-6xl text-gray-600 select-none">{{ editingMascot.avatar || '🤖' }}</span>
                                    </template>
                                    <span v-else class="preview-base-avatar font-bold text-6xl text-gray-600 select-none">🤖</span>

                                    <!-- 表情重ね合わせ (offsetX, offsetY, scale 補正) -->
                                    <template v-if="selectedModalExpression.path">
                                        <img 
                                            v-if="selectedModalExpression.path.startsWith('data:image/')" 
                                            :src="selectedModalExpression.path" 
                                            class="preview-layer-img expression absolute"
                                            :style="{
                                                width: '140px',
                                                height: '140px',
                                                objectFit: 'contain',
                                                transform: `translate(${selectedModalExpression.offsetX || 0}px, ${(selectedModalExpression.offsetY || 0)}px) scale(${selectedModalExpression.scale || 1.0})`
                                            }"
                                        />
                                        <span 
                                            v-else 
                                            class="preview-layer expression absolute font-bold text-4xl"
                                            :style="{
                                                transform: `translate(${selectedModalExpression.offsetX || 0}px, ${(selectedModalExpression.offsetY || 0)}px) scale(${selectedModalExpression.scale || 1.0})`
                                            }"
                                        >{{ selectedModalExpression.path }}</span>
                                    </template>
                                </div>
                            </div>

                            <!-- 縦スライダー (Y方向オフセット) -->
                            <div class="flex flex-column align-items-center gap-2" style="width: 40px;">
                                <span class="text-xxs text-gray-400 select-none font-bold">上 (Y-)</span>
                                <div class="vertical-slider-wrapper flex justify-content-center py-2" style="height: 340px;">
                                    <Slider 
                                        v-model="selectedModalExpression.offsetY" 
                                        :min="-150" 
                                        :max="150" 
                                        :step="1" 
                                        orientation="vertical"
                                        class="h-full vertical-slider"
                                        @change="handleLiveUpdate"
                                    />
                                </div>
                                <span class="text-xxs text-gray-400 select-none font-bold">下 (Y+)</span>
                            </div>
                        </div>

                        <!-- 下部コントロール: 横スライダー, 拡大率, ボタン類 -->
                        <div class="bg-gray-900 border-round p-3 border-1 border-gray-800 flex flex-column gap-3">
                            <div class="grid flex gap-3 align-items-center">
                                <!-- 横スライダー (X方向オフセット) -->
                                <div class="flex-1 flex flex-column gap-1">
                                    <div class="flex justify-content-between align-items-center">
                                        <label class="text-xs font-semibold text-gray-300 select-none">横位置調整 (X)</label>
                                        <span class="text-xxs text-purple-300 font-mono font-bold">{{ selectedModalExpression.offsetX || 0 }}px</span>
                                    </div>
                                    <Slider v-model="selectedModalExpression.offsetX" :min="-150" :max="150" :step="1" @change="handleLiveUpdate" />
                                </div>

                                <!-- 拡大率スライダー (Scale) -->
                                <div class="flex-1 flex flex-column gap-1">
                                    <div class="flex justify-content-between align-items-center">
                                        <label class="text-xs font-semibold text-gray-300 select-none">拡大率 / スケール (S)</label>
                                        <span class="text-xxs text-purple-300 font-mono font-bold">{{ (selectedModalExpression.scale || 1.0).toFixed(2) }}倍</span>
                                    </div>
                                    <Slider v-model="selectedModalExpression.scale" :min="0.3" :max="2.5" :step="0.05" @change="handleLiveUpdate" />
                                </div>
                            </div>

                            <!-- ボタン類 & 標準設定 -->
                            <div class="flex justify-content-between align-items-center pt-2 border-top border-gray-800">
                                <!-- 標準表情チェックボックス -->
                                <div v-if="selectedModalExpression.path" class="flex align-items-center gap-2">
                                    <input 
                                        id="default-expr-checkbox"
                                        type="checkbox" 
                                        :checked="editingMascot.defaultExpressionId === selectedModalExpression.id"
                                        @change="toggleDefaultExpression(($event.target as HTMLInputElement).checked)"
                                        class="cursor-pointer"
                                    />
                                    <label for="default-expr-checkbox" class="text-xs text-gray-300 font-bold cursor-pointer select-none flex align-items-center gap-1">
                                        <i class="pi pi-star-fill text-yellow-400"></i>
                                        <span>この表情をマスコットの標準（通常表示）にする</span>
                                    </label>
                                </div>
                                <div v-else class="text-xs text-gray-500 font-semibold select-none">
                                    ※画像を登録またはクロップすると各種パラメータの調整が行えます。
                                </div>

                                <!-- アクションボタン -->
                                <div class="flex gap-2">
                                    <Button 
                                        label="リセット" 
                                        icon="pi pi-refresh" 
                                        class="p-button-outlined p-button-secondary p-button-sm" 
                                        @click="selectedModalExpression.offsetX = 0; selectedModalExpression.offsetY = 0; selectedModalExpression.scale = 1.0; handleLiveUpdate()" 
                                    />
                                    <Button 
                                        v-if="selectedModalExpression.path"
                                        label="表情解除" 
                                        icon="pi pi-trash" 
                                        class="p-button-outlined p-button-danger p-button-sm" 
                                        @click="clearExpressionSlot(selectedModalExpression)" 
                                    />
                                    <Button 
                                        v-if="selectedModalExpression.path && selectedModalExpression.path.startsWith('data:image/')"
                                        label="切り抜き直す" 
                                        icon="pi pi-scissors" 
                                        class="p-button-outlined p-button-info p-button-sm" 
                                        @click="startCropCurrentSlotImage" 
                                    />
                                    <Button 
                                        label="画像から切り出し" 
                                        icon="pi pi-file-import" 
                                        class="p-button-outlined p-button-success p-button-sm" 
                                        @click="startCropNewImage" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer flex justify-content-end gap-2 pt-3 border-top border-gray-700 mt-3 no-drag">
                    <Button label="エディタを閉じる" icon="pi pi-check" class="p-button-primary px-4" @click="closeExpressionEditModal" />
                </div>
            </div>
        </div>

        <!-- 4. AIスプライトインポート感情設定画面 (isAssigningEmotionsModal) の分離 -->
        <div v-if="isAssigningEmotionsModal" class="custom-modal-overlay expression-edit-modal-overlay">
            <div class="custom-modal-card expression-edit-modal-card max-width-lg">
                <div class="modal-header flex justify-content-between align-items-center pb-3 border-bottom border-gray-700">
                    <h2 class="text-xl font-bold flex align-items-center gap-2 m-0 text-white">
                        <i class="pi pi-sparkles text-purple-400"></i>
                        <span>AI表情スプライト - 感情割り当て設定</span>
                    </h2>
                    <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" @click="closeAssigningEmotionsModal" />
                </div>

                <div class="modal-body-container flex flex-column gap-3 mt-3 overflow-hidden flex-1" style="min-height: 0;">
                    <!-- 上部: 検出スプライトトレイ (スクロール表示) -->
                    <div class="scanned-sprites-section p-3 bg-purple-950 border-round border-1 border-purple-800 flex flex-column gap-2" style="max-height: 160px; min-height: 140px; flex-shrink: 0;">
                        <div class="flex justify-content-between align-items-center mb-1">
                            <span class="text-xs font-bold text-purple-200 flex align-items-center gap-1 select-none">
                                <i class="pi pi-palette"></i>
                                <span>検出された表情パーツ（スロットをクリック、またはドラッグして感情をマッピングしてください）</span>
                            </span>
                            <span class="text-xxs text-purple-300 font-mono font-bold">残り {{ scannedSprites.length }} 個の表情スプライト</span>
                        </div>
                        <div class="flex gap-3 overflow-x-auto pb-2 scanned-sprites-tray">
                            <div 
                                v-for="sprite in scannedSprites" 
                                :key="sprite.id"
                                class="scanned-sprite-item flex flex-column align-items-center gap-1 p-2 border-round border-1 cursor-pointer transition-all drag-item"
                                :class="{ 'active': selectedScannedSprite?.id === sprite.id }"
                                draggable="true"
                                @dragstart="onSpriteDragStart($event, sprite)"
                                @click="selectScannedSprite(sprite)"
                            >
                                <img :src="sprite.path" class="sprite-preview object-contain border-round bg-gray-950" style="width: 54px; height: 54px;" />
                                <span class="text-xxs font-bold text-gray-300 text-ellipsis overflow-hidden w-full text-center">{{ sprite.name }}</span>
                            </div>
                            <div v-if="scannedSprites.length === 0" class="flex-1 flex align-items-center justify-content-center text-xs text-purple-300 font-semibold select-none">
                                全てのスプライトをスロットに割り当て完了しました！
                            </div>
                        </div>
                    </div>

                    <!-- 下部: 28感情スロットの割り当てグリッド -->
                    <div class="flex-1 overflow-y-auto pr-1">
                        <div class="grid-modal-slots flex flex-wrap gap-2 justify-content-start">
                            <div 
                                v-for="slot in editingMascot.assets.expressions" 
                                :key="slot.id"
                                class="assignment-slot-card border-round p-2 border-1 cursor-pointer transition-all flex align-items-center gap-2 bg-gray-900 border-gray-800"
                                :class="{
                                    'has-image': slot.path,
                                    'target-active': selectedScannedSprite,
                                    'hover-assign': selectedScannedSprite && !slot.path
                                }"
                                @click="assignSpriteToSlot(slot)"
                                @dragover.prevent
                                @drop="onSpriteDrop($event, slot)"
                                style="width: calc(25% - 6px); min-width: 170px;"
                            >
                                <div class="slot-thumbnail flex align-items-center justify-content-center border-round overflow-hidden bg-gray-950" style="width: 44px; height: 44px; flex-shrink: 0;">
                                    <img v-if="slot.path" :src="slot.path" class="thumbnail-img object-contain w-full h-full" />
                                    <i v-else class="pi pi-image text-gray-700 text-sm"></i>
                                </div>
                                <div class="flex flex-column flex-1 overflow-hidden">
                                    <span class="text-xs font-bold text-white text-ellipsis overflow-hidden">{{ slot.name }}</span>
                                    <span class="text-xxs font-bold select-none" :class="slot.path ? 'text-green-400' : 'text-gray-500'">
                                        {{ slot.path ? '割り当て済み' : '未設定' }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer flex justify-content-end gap-2 pt-3 border-top border-gray-700 mt-3 no-drag">
                    <Button label="割り当てを完了する" icon="pi pi-check" class="p-button-primary px-4" @click="closeAssigningEmotionsModal" />
                </div>
            </div>
        </div>

        <!-- 5. 画像クロップ (Crop) モーダル -->
        <div v-if="isCropModalActive" class="custom-modal-overlay crop-modal-overlay">
            <div class="custom-modal-card crop-modal-card">
                <div class="modal-header flex justify-content-between align-items-center pb-3 border-bottom border-gray-700">
                    <h2 class="text-lg font-bold flex align-items-center gap-2 m-0 text-white">
                        <i class="pi pi-scissors text-purple-400"></i>
                        <span>表情画像のトリミング・切り抜き</span>
                    </h2>
                    <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" @click="isCropModalActive = false" />
                </div>

                <div class="modal-body-container flex flex-column align-items-center justify-content-center p-3 overflow-hidden flex-1" style="min-height: 0;">
                    <span class="text-xxs text-gray-400 mb-2 select-none">※正方形のクロップ枠をドラッグして、表情パーツの切り抜き範囲を調整してください。</span>
                    
                    <!-- クロップコンテナ -->
                    <div 
                        ref="cropContainerRef"
                        class="crop-work-container relative border-1 border-gray-800 bg-gray-950 flex align-items-center justify-content-center overflow-hidden"
                        style="width: 480px; height: 380px;"
                        @mousemove="onCropMouseMove"
                        @mouseup="onCropMouseUp"
                        @mouseleave="onCropMouseUp"
                    >
                        <img 
                            ref="cropImageRef"
                            :src="cropImageSrc" 
                            class="max-w-full max-h-full object-contain select-none"
                            @load="handleCropImageLoaded"
                            draggable="false"
                        />

                        <!-- クロップ枠 (ドラッグ可能) -->
                        <div 
                            class="crop-box absolute border-2 border-dashed border-purple-400 cursor-move bg-purple-900 bg-opacity-25"
                            :style="{
                                width: `${cropSize}px`,
                                height: `${cropSize}px`,
                                left: `${cropX}px`,
                                top: `${cropY}px`,
                                transform: 'translate(-50%, -50%)',
                                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
                            }"
                            @mousedown="onCropMouseDown"
                        >
                            <div class="crop-corner top-left"></div>
                            <div class="crop-corner top-right"></div>
                            <div class="crop-corner bottom-left"></div>
                            <div class="crop-corner bottom-right"></div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer flex justify-content-end gap-2 pt-3 border-top border-gray-700 mt-2">
                    <Button label="キャンセル" class="p-button-text p-button-secondary p-button-sm" @click="isCropModalActive = false" />
                    <Button label="切り抜き実行" icon="pi pi-check" class="p-button-success p-button-sm" @click="executeCrop" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.settings-layout {
    width: 100vw;
    height: 100vh;
    display: flex;
    background: #f8fafc; /* 上品なオフホワイト */
    overflow: hidden;
    font-family: 'Outfit', 'Inter', sans-serif;
}

/* --- 左サイドバーのスタイル --- */
.sidebar {
    position: absolute;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 1000;
    width: 240px;
    background: #ffffff; /* 純白 */
    border-right: 1px solid rgba(0, 0, 0, 0.06); /* 淡い境界線 */
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    box-sizing: border-box;
    cursor: grab;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.06);
}

/* 折りたたみ時のサイドバー */
.sidebar.collapsed {
    width: 64px;
    padding: 24px 8px;
    box-shadow: none;
}

.brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    margin-bottom: 20px;
    position: relative;
    min-height: 48px;
}

.sidebar.collapsed .brand {
    justify-content: center;
    gap: 0;
}

.logo {
    font-size: 28px;
    flex-shrink: 0;
}

.brand-text h2 {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b; /* ダークスレート */
    margin: 0;
}

.brand-text p {
    font-size: 11px;
    color: #64748b; /* ソフトグレー */
    margin: 2px 0 0 0;
}

.menu {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
}

.menu-item {
    background: transparent;
    border: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    color: #64748b; /* 未選択時はソフトグレー */
    font-size: 13px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    width: 100%;
    box-sizing: border-box;
}

.sidebar.collapsed .menu-item {
    justify-content: center;
    padding: 10px 0;
    gap: 0;
}

.menu-item i {
    font-size: 15px;
    flex-shrink: 0;
}

.menu-item:hover {
    color: #0f172a;
    background: rgba(0, 0, 0, 0.02);
}

.menu-item.active {
    color: #a855f7; /* 高貴なパープル */
    background: rgba(168, 85, 247, 0.06);
    font-weight: 600;
}

.sidebar-footer {
    padding-top: 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.quit-btn {
    width: 100%;
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.15);
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.sidebar.collapsed .quit-btn {
    padding: 10px 0;
    justify-content: center;
    gap: 0;
}

.quit-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.25);
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.08);
}

/* --- 右側コンテンツエリアのスタイル --- */
.main-content {
    flex: 1;
    height: 100%;
    overflow-y: auto;
    padding: 32px;
    margin-left: 64px; /* 折りたたまれたサイドバー(64px)分の余白を確保して被らないようにする */
    box-sizing: border-box;
    background: #f1f5f9; /* 明るい背景 */
}

.content-container {
    max-width: 680px;
    margin: 0 auto;
    transition: max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.content-container.full-width {
    max-width: 100% !important;
    margin: 0 !important;
}

.panel-section {
    animation: fadeIn 0.3s ease;
}

.premium-card {
    background: #ffffff !important; /* カードは純白 */
    border: 1px solid rgba(0, 0, 0, 0.04) !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04) !important; /* 上品でソフトなシャドウ */
}

/* フォームフィールド */
.form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-field label {
    font-size: 13px;
    color: #475569; /* 中スレートグレー */
}

/* マスコット一覧 */
.mascot-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.mascot-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.mascot-item:hover {
    background: #f8fafc;
    border-color: rgba(0, 0, 0, 0.15);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.mascot-item.active {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.03);
    box-shadow: 0 4px 16px rgba(168, 85, 247, 0.06);
}

.mascot-item .avatar {
    font-size: 64px;
    line-height: 1;
}

.mascot-item .info {
    display: flex;
    justify-content: center;
    width: 100%;
}

.mascot-item .name {
    font-weight: 700;
    font-size: 14px;
    color: #1e293b;
    text-align: center;
}

.mascot-item .desc {
    font-size: 12px;
    color: #64748b;
}

/* ユーティリティ */
.flex { display: flex; }
.flex-column { flex-direction: column; }
.gap-4 { gap: 1.5rem; }
.gap-3 { gap: 1rem; }
.gap-2 { gap: 0.5rem; }
.justify-content-between { justify-content: space-between; }
.justify-content-end { justify-content: flex-end; }
.align-items-center { align-items: center; }
.mt-2 { margin-top: 0.5rem; }
.mt-3 { margin-top: 1rem; }
.mt-4 { margin-top: 1.5rem; }
.mb-4 { margin-bottom: 1.5rem; }
.w-full { width: 100%; }

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* --- 疎通確認ステータス表示のスタイル --- */
.connection-status {
    border-radius: 8px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    transition: all 0.3s ease;
}
.status-idle {
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.05);
    color: #64748b;
}
.status-success {
    background: rgba(34, 197, 94, 0.04);
    border: 1px solid rgba(34, 197, 94, 0.15);
    color: #15803d; /* やさしいグリーン */
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.04);
}
.status-failed {
    background: rgba(239, 68, 68, 0.04);
    border: 1px solid rgba(239, 68, 68, 0.15);
    color: #b91c1c; /* やさしいレッド */
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.04);
}
.flex-1 {
    flex: 1;
}
.text-green-400 {
    color: #16a34a;
}
.text-red-400 {
    color: #dc2626;
}
.text-gray-400 {
    color: #64748b;
}

/* --- 表情編集モーダル用プレミアムCSSスタイル群 (縦リスト & 右特大プレビュー) --- */
.expression-edit-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.85) !important;
    backdrop-filter: blur(12px) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.25s ease-out;
}

.expression-edit-modal-card {
    background: #1e293b !important; /* ダークSlate */
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    width: 90vw !important;
    max-width: 1040px !important;
    height: 90vh !important;
    max-height: 780px !important;
    display: flex;
    flex-direction: column;
    color: #f8fafc;
    overflow: hidden !important;
    padding: 20px !important;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
}

.max-width-lg {
    max-width: 960px !important;
    max-height: 680px !important;
}

.border-bottom {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
}
.border-top {
    border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
}
.border-gray-700 {
    border-color: rgba(255, 255, 255, 0.1) !important;
}
.bg-gray-950 {
    background-color: #020617 !important; /* 深いブラック */
}
.bg-gray-900 {
    background-color: #0f172a !important; /* ダークネイビー */
}

/* 縦スリムリスト */
.expression-vertical-list {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}
.expression-vertical-list::-webkit-scrollbar {
    width: 4px;
}
.expression-vertical-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 2px;
}

.expression-vertical-item {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.05);
    position: relative;
}
.expression-vertical-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
}
.expression-vertical-item.active {
    background: rgba(168, 85, 247, 0.12) !important;
    border-color: #a855f7 !important;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.25);
}
.expression-vertical-item.empty {
    border-style: dashed;
    opacity: 0.6;
}
.expression-vertical-item.empty:hover {
    opacity: 0.9;
}

.slot-thumbnail {
    width: 38px;
    height: 38px;
    border: 1px solid rgba(255, 255, 255, 0.08);
}
.thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.default-badge {
    position: absolute;
    top: 4px;
    right: 4px;
}

.text-xxs {
    font-size: 10px;
}

/* 特大プレビュー & 縦スライダー */
.large-preview {
    background: transparent;
}

.vertical-slider-wrapper {
    display: flex;
    align-items: center;
}
.vertical-slider {
    height: 100% !important;
}

/* スプライト一時トレイのスタイル */
.scanned-sprites-section {
    border: 1px solid rgba(168, 85, 247, 0.25);
}
.scanned-sprites-tray {
    display: flex;
    gap: 12px;
    overflow-x: auto !important;
    white-space: nowrap;
    padding-bottom: 8px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
.scanned-sprites-tray::-webkit-scrollbar {
    height: 6px;
}
.scanned-sprites-tray::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
}

.scanned-sprite-item {
    min-width: 76px;
    height: 82px;
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.08);
    transition: all 0.15s ease;
}
.scanned-sprite-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
}
.scanned-sprite-item.active {
    background: rgba(168, 85, 247, 0.18) !important;
    border-color: #a855f7 !important;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
}

/* 感情スロット割り当てカード */
.assignment-slot-card {
    background: rgba(255, 255, 255, 0.02) !important;
    border-color: rgba(255, 255, 255, 0.06) !important;
    transition: all 0.2s ease;
}
.assignment-slot-card:hover {
    background: rgba(255, 255, 255, 0.06) !important;
    border-color: rgba(255, 255, 255, 0.15) !important;
}
.assignment-slot-card.has-image {
    background: rgba(34, 197, 94, 0.04) !important;
    border-color: rgba(34, 197, 94, 0.15) !important;
}
.assignment-slot-card.has-image:hover {
    background: rgba(34, 197, 94, 0.08) !important;
    border-color: rgba(34, 197, 94, 0.3) !important;
}
.assignment-slot-card.hover-assign {
    border-style: dashed !important;
    border-color: #a855f7 !important;
    animation: pulseBorder 1.5s infinite;
}

@keyframes pulseBorder {
    0% { border-color: rgba(168, 85, 247, 0.4); }
    50% { border-color: rgba(168, 85, 247, 1.0); }
    100% { border-color: rgba(168, 85, 247, 0.4); }
}

/* クロップ (Crop) モーダル用CSS */
.crop-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.9) !important;
    backdrop-filter: blur(14px) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
    animation: fadeIn 0.2s ease-out;
}

.crop-modal-card {
    background: #111827 !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    width: 520px !important;
    height: 520px !important;
    display: flex;
    flex-direction: column;
    padding: 16px !important;
    border-radius: 12px;
}

.crop-work-container {
    border-radius: 8px;
    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.6);
}

.crop-box {
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.65) !important;
}

.crop-corner {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #a855f7;
    border: 1px solid white;
}
.crop-corner.top-left { top: -4px; left: -4px; cursor: nwse-resize; }
.crop-corner.top-right { top: -4px; right: -4px; cursor: nesw-resize; }
.crop-corner.bottom-left { bottom: -4px; left: -4px; cursor: nesw-resize; }
.crop-corner.bottom-right { bottom: -4px; right: -4px; cursor: nwse-resize; }

.expression-grid-cell {
    border: 1px dashed #cbd5e1 !important;
    border-radius: 12px !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.expression-grid-cell:hover {
    background-color: #f8fafc !important;
    border: 1.5px dashed #a855f7 !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.08);
}

.expression-grid-cell.default-expression {
    border: 1.5px dashed #eab308 !important;
    background-color: #fefce8 !important;
}

.expression-grid-cell.default-expression:hover {
    box-shadow: 0 4px 12px rgba(234, 179, 8, 0.12);
}

.expression-cell-label {
    background: rgba(255, 255, 255, 0.85);
    padding: 1px 4px;
    border-radius: 4px;
    backdrop-filter: blur(2px);
    border: 1px solid rgba(0, 0, 0, 0.03);
    color: #64748b;
}

.expression-grid-cell.has-image .expression-cell-label {
    color: #475569 !important;
}

.mascot-composite-preview {
    position: relative;
    width: 420px;
    height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

/* アセットプレビューレイヤー用スタイル */
.preview-full-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    z-index: 1;
}
.preview-base-avatar {
    position: absolute;
    z-index: 1;
}
.preview-layer-img {
    position: absolute;
    object-fit: contain;
    pointer-events: none;
    z-index: 10;
}
.preview-layer {
    position: absolute;
    z-index: 10;
}
</style>
