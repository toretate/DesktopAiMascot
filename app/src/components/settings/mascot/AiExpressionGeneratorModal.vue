<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useConfigStore } from '@/store/config';
import Button from 'primevue/button';
import AppModalShell from '../../common/AppModalShell.vue';
import { resolveMascotImageUrl } from '../../../utils/mascot-image-url';
import { saveMascotImageSource } from '../../../utils/mascot-image-upload';

const configStore = useConfigStore();

// 画像かどうかの判定
const isImage = (path: string | undefined | null): boolean => {
    if (!path) return false;
    return path.startsWith('data:image/') || 
           path.startsWith('/mascots/') || 
           path.startsWith('http://') || 
           path.startsWith('https://') ||
           /\.(png|jpg|jpeg|webp|gif)$/i.test(path);
};

// アセットURLの解決
const resolveImageUrl = (path: string | undefined | null): string => {
    return resolveMascotImageUrl(path, {
        serverHost: configStore.serverHost,
        serverPort: configStore.serverPort,
        absoluteMascotUrl: configStore.useServer
    });
};

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    expressions?: MascotAsset[];
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
    assets: {
        expressions: MascotAsset[];
    };
}

const props = defineProps<{
    visible: boolean;
    editingMascot: MascotData;
    defaultFrontAvatar: MascotAsset | null;
    activeOutfit: MascotAsset | null;
    geminiApiKey: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'import-sprite', data: { imagePath: string; importId: string }): void;
}>();

// 28感情の対応表
const EMOTIONS_MAP: Record<string, string> = {
    '通常': 'neutral', '喜び': 'joy', '面白がり': 'amusement', '怒り': 'anger', '苛立ち': 'annoyance',
    '悲しみ': 'sadness', '深い悲しみ': 'grief', '驚き': 'surprise', '当惑': 'embarrassment', '興奮': 'excitement',
    '恐れ': 'fear', '好奇心': 'curiosity', '愛情': 'love', '気遣い': 'caring', '賛同': 'approval',
    '不賛成': 'disapproval', '賞賛': 'admiration', '混乱': 'confusion', '欲求': 'desire', '失望': 'disappointment',
    '嫌悪': 'disgust', '感謝': 'gratitude', '緊張': 'nervousness', '楽観': 'optimism', '誇り': 'pride',
    '気づき': 'realization', '安堵': 'relief', '後悔': 'remorse'
};

// 選択されている表情名（最大16）
const selectedEmotions = ref<string[]>([]);
const isGenerating = ref(false);
const generatedImage = ref<string>('');
const savedServerPath = ref<string>('');
const currentGenerationId = ref<string>('');
const errorMessage = ref('');
const generationHistory = ref<any[]>([]); // 対話的編集のための履歴

// 生成エンジン＆モデル設定
const selectedEngine = ref('gemini');
const selectedModel = ref('gemini-3.1-flash-image');
const customModel = ref('');
const customModelEnabled = ref(false);
const isFetchingModels = ref(false);

const modelPresetsMap = ref<Record<string, string[]>>({
    gemini: ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image', 'imagen-3.0-generate-002', 'imagen-3.0-generate-001'],
    openai: ['dall-e-3', 'dall-e-2'],
    ollama: [],
    comfyui: []
});

const hasModelPresets = computed(() => {
    return (modelPresetsMap.value[selectedEngine.value] || []).length > 0;
});

const modelPresets = computed(() => {
    return modelPresetsMap.value[selectedEngine.value] || [];
});

const getModelDisplayName = (modelId: string) => {
    const nicknames: Record<string, string> = {
        'gemini-3-pro-image': 'Nano Banana Pro',
        'gemini-3.1-pro-image': 'Nano Banana Pro',
        'gemini-3.1-flash-image': 'Nano Banana 2',
        'gemini-2.5-flash-image': 'Nano Banana'
    };
    return nicknames[modelId] || modelId;
};

const onEngineChange = () => {
    const presets = modelPresetsMap.value[selectedEngine.value] || [];
    if (presets.length > 0) {
        selectedModel.value = presets[0];
        customModelEnabled.value = false;
        customModel.value = '';
    } else {
        selectedModel.value = 'custom';
        customModelEnabled.value = true;
        customModel.value = selectedEngine.value === 'comfyui' ? '29:40' : 'llava';
    }
};

const finalModelName = computed(() => {
    if (selectedModel.value === 'custom' || !hasModelPresets.value) {
        return customModel.value;
    }
    return selectedModel.value;
});

// 動的にGoogle AI StudioからImagenモデルリストを取得する
const fetchImagenModels = async () => {
    if (!props.geminiApiKey || !window.electronAPI?.getImagenModels) return;
    
    isFetchingModels.value = true;
    try {
        console.log('[AiExpressionGenerator] Dynamic model fetching triggered...');
        const models = await window.electronAPI.getImagenModels(props.geminiApiKey);
        if (models && models.length > 0) {
            modelPresetsMap.value.gemini = models;
            // 現在の選択モデルが取得リストにない場合は先頭にフォールバック
            if (selectedEngine.value === 'gemini' && !models.includes(selectedModel.value)) {
                selectedModel.value = models[0];
            }
        }
    } catch (e) {
        console.error('[AiExpressionGenerator] Failed to fetch models:', e);
    } finally {
        isFetchingModels.value = false;
    }
};

// プロンプトテンプレートの初期値
const defaultPromptTemplate = 
`顔のアップで、チャットマスコットとして必要な様々な表情を作成してください。
作成する表情は以下の通りです：
[__EMOTIONS_LABLE__]
背景は純白(#ffffff)にしてください。`
// `添付した画像（スタイル特徴：[FEATURES]）を参照して、チャットマスコットとして必要な様々な表情を作成してください。
// 作成する表情は以下の通りです：
// [EMOTIONS]
// アニメ風のフラットなイラストで、背景は純白(#ffffff)にしてください。顔のアップで、各画像間はプログラム処理しやすいように黒の直線で区切ってください。また、各画像の下に対応する表情のラベルを表示してください。`;

const userPrompt = ref(defaultPromptTemplate);

const currentExpressions = computed(() => {
    return props.activeOutfit?.expressions || props.editingMascot.assets?.expressions || [];
});

// モーダル表示時に初期化
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            // デフォルトで「通常」「喜び」「悲しみ」「怒り」「驚き」を選択
            const defaultSelection = ['通常', '喜び', '悲しみ', '怒り', '驚き'];
            selectedEmotions.value = currentExpressions.value
                .map((e: any) => e.name)
                .filter((name: string) => defaultSelection.includes(name));
            generatedImage.value = '';
            savedServerPath.value = '';
            currentGenerationId.value = '';
            errorMessage.value = '';
            isGenerating.value = false;
            generationHistory.value = [];
            
            // エンジン初期値
            selectedEngine.value = 'gemini';
            selectedModel.value = 'gemini-3.1-flash-image';
            customModel.value = '';
            customModelEnabled.value = false;
            
            // 動的モデルリストを取得
            fetchImagenModels();
        }
    }
);

watch(
    () => props.geminiApiKey,
    () => {
        if (props.visible) {
            fetchImagenModels();
        }
    }
);

// 表情の選択切り替え
const toggleEmotion = (name: string) => {
    const idx = selectedEmotions.value.indexOf(name);
    if (idx !== -1) {
        selectedEmotions.value.splice(idx, 1);
    } else {
        if (selectedEmotions.value.length >= 16) {
            alert('同時に生成できる表情は最大16個までです。');
            return;
        }
        selectedEmotions.value.push(name);
    }
};

// 選択数カウント
const selectedCount = computed(() => selectedEmotions.value.length);

// AI表情生成実行
const generateExpressions = async () => {
    if (selectedEmotions.value.length === 0) {
        alert('生成する表情を少なくとも1つ選択してください。');
        return;
    }
    
    // Gemini以外のエンジンを使う場合は、APIキー設定のバリデーションはメインプロセスに委ねる
    if (selectedEngine.value === 'gemini' && !props.geminiApiKey) {
        alert('Google AI Studio APIキーが設定されていません。設定画面でAPIキーを設定してください。');
        return;
    }
    
    isGenerating.value = true;
    errorMessage.value = '';
    
    try {
        // ベース画像（全身像を最優先、なければ顔アップ）を取得
        let baseImageBase64 = '';
        
        // 履歴がない場合（初回の生成）のみベース画像を送る
        if (generationHistory.value.length === 0) {
            if (props.activeOutfit && props.activeOutfit.path) {
                baseImageBase64 = props.activeOutfit.path;
            } 
            else if (props.editingMascot.assets && Array.isArray((props.editingMascot.assets as any).outfits) && (props.editingMascot.assets as any).outfits.length > 0) {
                baseImageBase64 = (props.editingMascot.assets as any).outfits[0].path;
            }
            else if (props.defaultFrontAvatar && props.defaultFrontAvatar.path) {
                baseImageBase64 = props.defaultFrontAvatar.path;
            } 
            else if (props.editingMascot.avatar) {
                baseImageBase64 = props.editingMascot.avatar;
            }
        }
        
        // 選択された表情のオブジェクト配列を作成
        const emotionsToSend = selectedEmotions.value.map(name => {
            return {
                name,
                label: EMOTIONS_MAP[name] || 'neutral'
            };
        });
        
        if (!window.electronAPI) {
            throw new Error('Electron APIが利用できません。');
        }
        
        const result = await window.electronAPI.generateMascotExpressions(
            baseImageBase64,
            props.geminiApiKey,
            emotionsToSend,
            userPrompt.value,
            selectedEngine.value,
            finalModelName.value,
            JSON.parse(JSON.stringify(generationHistory.value)) // プレーンなオブジェクトに変換して渡す
        );
        
        if (result.success && result.imageBytes) {
            generatedImage.value = result.imageBytes; // プレビュー用には常に Base64 (Data URL) を設定して表示崩れを防ぐ
            
            if (window.electronAPI?.saveMascotImage && props.editingMascot?.id) {
                const importId = Date.now().toString();
                currentGenerationId.value = importId;
                const filename = `expressions/working/${importId}/spritesheet_${importId}.png`;
                const saveResult = await saveMascotImageSource(
                    props.editingMascot.id,
                    filename,
                    result.imageBytes
                );
                if (saveResult.success && saveResult.path) {
                    savedServerPath.value = saveResult.path; // サーバーに保存したパスを保持
                }
            } else {
                savedServerPath.value = '';
                currentGenerationId.value = '';
            }
            // 履歴を更新（マルチターン対応）
            if (result.history) {
                // 今回のユーザープロンプトを履歴に追加
                generationHistory.value.push({
                    role: 'user',
                    parts: [{ text: userPrompt.value }]
                });
                // モデルの回答（画像データ含む）を履歴に追加
                generationHistory.value.push(result.history);
                
                // 次の指示を出しやすくするためにプロンプトを「修正用」に少し変える
                if (generationHistory.value.length === 2) {
                    userPrompt.value = "生成された画像を修正してください。具体的には、表情をもっと豊かにし、色調をより鮮やかにしてください。";
                }
            }
        } else {
            throw new Error(result.error || '画像生成中にエラーが発生しました。');
        }
    } catch (e: any) {
        console.error('[AiExpressionGenerator] Error:', e);
        errorMessage.value = e.message || 'AI表情スプライトの生成に失敗しました。';
    } finally {
        isGenerating.value = false;
    }
};

// 生成画像のインポート処理
const importGeneratedSprite = () => {
    if (!generatedImage.value) return;
    // サーバーに保存したアセットパスと生成IDをオブジェクトでインポートイベントに送る
    emit('import-sprite', {
        imagePath: savedServerPath.value || generatedImage.value,
        importId: currentGenerationId.value || Date.now().toString()
    });
    emit('close');
};
</script>

<template>
    <AppModalShell
        :visible="visible"
        title-id="ai-expression-generator-modal-title"
        :close-disabled="isGenerating"
        backdrop="light"
        :z-index="2000"
        width="90vw"
        max-width="1040px"
        height="90vh"
        max-height="780px"
        padding="10px 20px 16px"
        @close="emit('close')"
    >
        <!-- 高級感のあるヘッダー -->
        <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
            <h2 id="ai-expression-generator-modal-title" class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-sparkles text-brand-600 text-sm animate-pulse"></i>
                    <span>AI表情スプライト自動生成 (Gemini Vision + Imagen 3)</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" :disabled="isGenerating" />
            </div>

            <!-- モーダルボディ -->
            <div class="modal-body-container flex gap-4 mt-3 overflow-hidden flex-1" style="min-height: 0;">
                
                <!-- 左カラム: 表情選択 ＆ プロンプト設定 (幅 48%) -->
                <div class="flex flex-column gap-3 overflow-y-auto pr-1" style="width: 48%; min-width: 320px;">
                    
                    <!-- キャラクターベース画像プレビュー -->
                    <div class="base-image-preview-panel p-3 bg-slate-50 border-round border-1 border-gray-200 flex align-items-center gap-3">
                        <div class="flex align-items-center justify-content-center border-round overflow-hidden bg-white border-1 border-slate-200" style="width: 64px; height: 64px; flex-shrink: 0; position: relative;">
                            <img v-if="defaultFrontAvatar?.path" :src="defaultFrontAvatar.path" class="w-full h-full object-contain" />
                            <img v-else-if="editingMascot.avatar && editingMascot.avatar.startsWith('data:image/')" :src="editingMascot.avatar" class="w-full h-full object-contain" />
                            <span v-else class="text-4xl">🤖</span>
                        </div>
                        <div class="flex flex-column">
                            <span class="text-xs font-bold text-slate-800">ベースキャラクター画像</span>
                            <span class="text-xxs text-slate-500 mt-1 select-none">このマスコットの外見と絵柄の特徴をAIが自動分析し、新しい表情スプライトへシームレスに継承します。</span>
                        </div>
                    </div>

                    <!-- 生成エンジン ＆ モデル設定 -->
                    <div class="engine-model-settings-panel p-3 bg-white border-round border-1 border-gray-200 flex flex-column gap-2">
                        <label class="font-bold text-xs text-slate-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-cog text-brand-500"></i>
                            <span>生成AIエンジン ＆ モデル設定</span>
                        </label>
                        
                        <div class="flex gap-3 align-items-center">
                            <!-- エンジン選択 -->
                            <div class="flex-1 flex flex-column gap-1">
                                <span class="text-xxs font-bold text-slate-500">生成エンジン</span>
                                <select 
                                    v-model="selectedEngine" 
                                    class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none cursor-pointer"
                                    @change="onEngineChange"
                                    :disabled="isGenerating"
                                >
                                    <option value="gemini">Gemini (Imagen 3)</option>
                                    <option value="openai">OpenAI (DALL-E)</option>
                                    <option value="ollama">Ollama (Local)</option>
                                    <option value="comfyui">Comfy UI (Local)</option>
                                </select>
                            </div>
                            
                            <!-- モデル名選択 / 入力 -->
                            <div class="flex-1 flex flex-column gap-1">
                                <div class="flex justify-content-between align-items-center">
                                    <span class="text-xxs font-bold text-slate-500">使用モデル / ワークフローID</span>
                                    <span v-if="isFetchingModels && selectedEngine === 'gemini'" class="text-xxs text-brand-600 flex align-items-center gap-1 select-none font-bold">
                                        <i class="pi pi-spin pi-spinner" style="font-size: 8px;"></i>
                                        <span>同期中...</span>
                                    </span>
                                </div>
                                <div class="relative w-full">
                                    <select 
                                        v-if="hasModelPresets"
                                        v-model="selectedModel"
                                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none cursor-pointer"
                                        :disabled="isGenerating"
                                    >
                                        <option v-for="m in modelPresets" :key="m" :value="m">{{ getModelDisplayName(m) }}</option>
                                        <option value="custom">カスタム（直接入力）</option>
                                    </select>
                                    
                                    <input 
                                        v-if="!hasModelPresets || selectedModel === 'custom' || customModelEnabled"
                                        v-model="customModel"
                                        type="text"
                                        placeholder="モデル名またはIDを入力..."
                                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none"
                                        :class="{ 'mt-1.5': hasModelPresets }"
                                        :disabled="isGenerating"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 表情選択UI -->
                    <div class="emotions-selection-panel p-3 bg-white border-round border-1 border-gray-200 flex flex-column gap-2">
                        <div class="flex justify-content-between align-items-center">
                            <label class="font-bold text-xs text-slate-700 flex align-items-center gap-1 select-none">
                                <i class="pi pi-check-square text-brand-500"></i>
                                <span>生成する表情を選択してください (最大16個)</span>
                            </label>
                            <span class="text-xxs font-mono font-bold" :class="selectedCount > 16 ? 'text-rose-500' : 'text-brand-600'">
                                {{ selectedCount }} / 16 選択中
                            </span>
                        </div>
                        <div class="emotions-cards-grid mt-1" style="max-height: 240px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; padding: 2px;">
                            <div 
                                v-for="expr in currentExpressions" 
                                :key="expr.id"
                                class="emotion-card flex flex-column border-round border-1 cursor-pointer transition-all relative overflow-hidden"
                                :style="{
                                    aspectRatio: '2/3',
                                    height: '108px'
                                }"
                                :class="{
                                    'active border-brand-500 shadow-sm': selectedEmotions.includes(expr.name),
                                    'border-slate-200 bg-white hover:bg-slate-50': !selectedEmotions.includes(expr.name),
                                    'opacity-50 cursor-not-allowed': selectedCount >= 16 && !selectedEmotions.includes(expr.name),
                                    'border-dashed opacity-75': !expr.path
                                }"
                                @click="toggleEmotion(expr.name)"
                            >
                                <!-- 画像表示エリア -->
                                <div class="card-image-area flex-1 flex align-items-center justify-content-center bg-slate-50 overflow-hidden relative">
                                    <img v-if="expr.path && isImage(expr.path)" :src="resolveImageUrl(expr.path)" class="w-full h-full object-contain" />
                                    <i v-else class="pi pi-image text-slate-300" style="font-size: 24px;"></i>
                                    
                                    <!-- 選択状態のオーバーレイ / アイコン -->
                                    <div v-if="selectedEmotions.includes(expr.name)" class="absolute inset-0 bg-theme-alpha-10 flex align-items-center justify-content-center">
                                        <i class="pi pi-check-circle text-brand-600 bg-white rounded-full text-base shadow-sm"></i>
                                    </div>
                                    
                                    <!-- 作成済みバッジ (右上の小さな緑チェックマーク) -->
                                    <div v-if="expr.path" class="absolute top-1 right-1 bg-green-500 text-white rounded-full flex align-items-center justify-content-center" style="width: 14px; height: 14px;" title="作成済み">
                                        <i class="pi pi-check" style="font-size: 8px;"></i>
                                    </div>
                                </div>
                                
                                <!-- ラベルエリア -->
                                <div class="card-label-area p-1 text-center border-top border-slate-100 flex align-items-center justify-content-center bg-white" style="height: 24px;">
                                    <span class="text-xxs font-bold text-slate-700 text-ellipsis overflow-hidden whitespace-nowrap w-full">{{ expr.name }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- プロンプト入力欄 -->
                    <div class="prompt-panel p-3 bg-white border-round border-1 border-gray-200 flex flex-column gap-2">
                        <label class="font-bold text-xs text-slate-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-pencil text-brand-500"></i>
                            <span>画像生成プロンプトの調整</span>
                        </label>
                        <span class="text-xxs text-slate-400 leading-normal mb-1">
                            ※ <code>[FEATURES]</code> は自動抽出されたマスコットの特徴、<code>[EMOTIONS]</code> は選択した表情一覧に自動置換されます。
                        </span>
                        <textarea 
                            v-model="userPrompt"
                            class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none transition-all font-sans leading-relaxed"
                            rows="7"
                            style="resize: none;"
                            placeholder="プロンプトを入力してください..."
                            :disabled="isGenerating"
                        ></textarea>
                    </div>

                </div>

                <!-- 右カラム: 生成プレビュー ＆ インポート領域 (幅 52%) -->
                <div class="flex-1 flex flex-column gap-3 overflow-hidden" style="width: 52%; min-height: 0;">
                    
                    <!-- プレビュープレースホルダー / 実画像表示 -->
                    <div class="flex-1 border-1 border-gray-200 border-round checkerboard-bg flex align-items-center justify-content-center relative overflow-hidden" style="min-height: 300px;">
                        
                        <!-- 生成中のインジケーター -->
                        <div v-if="isGenerating" class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex flex-column align-items-center justify-content-center gap-3 z-20 w-full h-full">
                            <i class="pi pi-spin pi-spinner text-brand-400 text-4xl"></i>
                            <div class="flex flex-column align-items-center gap-1.5 text-center px-4">
                                <span class="text-sm font-bold text-white">AI表情スプライト生成中...</span>
                                <span class="text-xxs text-slate-200">これには30秒から1分程度かかる場合があります。画面を閉じずにお待ちください。</span>
                            </div>
                        </div>

                        <!-- エラーメッセージ表示 -->
                        <div v-else-if="errorMessage" class="absolute inset-0 bg-rose-50 flex flex-column align-items-center justify-content-center gap-3 z-10 p-4 text-center w-full h-full">
                            <i class="pi pi-exclamation-triangle text-rose-500 text-3xl"></i>
                            <div class="flex flex-column align-items-center gap-1">
                                <span class="text-sm font-bold text-rose-800">生成に失敗しました</span>
                                <span class="text-xs text-rose-600 leading-normal">{{ errorMessage }}</span>
                            </div>
                            <Button label="もう一度試す" icon="pi pi-refresh" class="p-button-outlined p-button-danger p-button-sm mt-2" @click="generateExpressions" />
                        </div>

                        <!-- プレビュー画像 -->
                        <div v-else-if="generatedImage" class="w-full h-full flex align-items-center justify-content-center p-2 relative">
                            <img :src="resolveImageUrl(generatedImage)" class="max-w-full max-h-full object-contain border-round shadow-md" />
                            <div class="absolute bottom-4 right-4 bg-slate-900/70 backdrop-blur text-white px-2.5 py-1 border-round text-xxs font-bold font-mono">
                                Imagen 3 (1024x1024)
                            </div>
                        </div>

                        <!-- 初期状態プレースホルダー -->
                        <div v-else class="flex flex-column align-items-center gap-3 text-slate-400 p-4 text-center">
                            <i class="pi pi-sparkles text-slate-300 text-5xl"></i>
                            <div class="flex flex-column align-items-center gap-1">
                                <span class="text-xs font-bold text-slate-600">AI表情スプライトがまだ生成されていません</span>
                                <span class="text-xxs text-slate-400 leading-relaxed max-w-sm">左側のパネルから表情とプロンプトを選択・微調整し、「AIスプライトを生成」をクリックしてください。</span>
                            </div>
                        </div>

                    </div>

                    <!-- 下部操作ボタン -->
                    <div class="bg-slate-50 border-round p-3 border-1 border-gray-200 flex justify-content-between align-items-center">
                        <div class="flex gap-2">
                            <Button 
                                label="プロンプトリセット" 
                                icon="pi pi-refresh" 
                                class="p-button-outlined p-button-secondary p-button-sm font-bold" 
                                @click="userPrompt = defaultPromptTemplate"
                                :disabled="isGenerating"
                            />
                        </div>

                        <div class="flex gap-2">
                            <Button 
                                v-if="generatedImage"
                                label="再生成" 
                                icon="pi pi-refresh" 
                                class="p-button-outlined p-button-primary p-button-sm font-bold" 
                                @click="generateExpressions"
                                :disabled="isGenerating"
                            />
                            <Button 
                                v-if="generatedImage"
                                label="AIスプライトをインポート" 
                                icon="pi pi-file-import" 
                                class="p-button-success p-button-sm px-4 font-bold shadow-sm" 
                                @click="importGeneratedSprite"
                                :disabled="isGenerating"
                            />
                            <Button 
                                v-else
                                label="AIスプライトを生成" 
                                icon="pi pi-sparkles" 
                                class="p-button-primary p-button-sm px-4 font-bold shadow-sm" 
                                @click="generateExpressions"
                                :disabled="isGenerating"
                            />
                        </div>
                    </div>

                </div>

            </div>

        <!-- フッター -->
        <div class="modal-footer flex justify-content-end gap-2 pt-3 border-top border-gray-200 mt-3 no-drag">
            <Button label="閉じる" icon="pi pi-times" class="p-button-secondary px-4 p-button-sm" @click="emit('close')" :disabled="isGenerating" />
        </div>
    </AppModalShell>
</template>

<style scoped>
/* モーダル用CSS */
.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}
.border-top {
    border-top: 1px solid #e2e8f0 !important;
}

.base-image-preview-panel {
    border: 1px solid #e2e8f0;
}

.emotions-selection-panel {
    border: 1px solid #e2e8f0;
}

.prompt-panel {
    border: 1px solid #e2e8f0;
}

.emotion-card {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.emotion-card:hover:not(.opacity-50) {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
.emotion-card.active {
    box-shadow: 0 0 0 2px var(--color-primary-alpha-20);
}

.text-xxs {
    font-size: 10px;
}
.text-xxxs {
    font-size: 8px;
}

/* 透過アセット白飛び防止市松模様 */
.checkerboard-bg {
    background-color: #ffffff;
    background-image: 
        linear-gradient(45deg, #f1f5f9 25%, transparent 25%), 
        linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, #f1f5f9 75%), 
        linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}

/* インジケータアニメーション用 */
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .5; }
}
.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
