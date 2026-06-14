<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const {
    selectedEngine,
    lmstudioEndpoint,
    lmstudioModel,
    geminiModel,
    openaiModel,
    anthropicModel,
    temperature,
    googleAiStudioApiKey: geminiApiKey
} = storeToRefs(configStore);

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

// LM Studio 接続検証用の状態変数
const isTestingConnection = ref(false);
const connectionState = ref<'idle' | 'success' | 'failed'>('idle');
const connectionErrorMsg = ref('');
const lmstudioModels = ref<any[]>([]);

const saveStatus = ref('設定を保存');
const isSaving = ref(false);

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

    if (name.includes('think') || name.includes('thought') || name.includes('reason') || name.includes('o1') || name.includes('o3-mini')) {
        caps.isThought = true;
    }
    if (name.includes('vision') || name.includes('vl') || name.includes('gpt-4o') || name.includes('claude-3-5') || name.includes('gemini-1.5') || name.includes('gemini-2.0')) {
        caps.isVision = true;
    }
    
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

const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';
    try {
        await configStore.saveConfig();
        setTimeout(() => {
            saveStatus.value = '保存完了！';
            isSaving.value = false;
            setTimeout(() => {
                saveStatus.value = '設定を保存';
            }, 2000);
        }, 600);
    } catch (e) {
        saveStatus.value = '保存エラー';
        isSaving.value = false;
    }
};

onMounted(() => {
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
});
</script>

<template>
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
</template>
