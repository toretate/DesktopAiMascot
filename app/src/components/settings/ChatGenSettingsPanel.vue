<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Slider from 'primevue/slider';
import Textarea from 'primevue/textarea';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';
import radioIcon from '../../assets/radio_icon.svg';

const configStore = useConfigStore();
const {
    selectedEngine,
    lmstudioEndpoint,
    lmstudioModel,
    geminiModel,
    openaiModel,
    anthropicModel,
    temperature,
    frequencyPenalty,
    repetitionPenalty,
    googleAiStudioApiKey: geminiApiKey,
    useExRadio,
    summaryEngine,
    summaryGeminiModel,
    summaryOpenaiModel,
    summaryAnthropicModel,
    summaryLmstudioModel,
    summaryMaxCharLimit
} = storeToRefs(configStore);

// --- AIエンジンのデータ定義 ---
const aiEngines = ref([
    { name: 'Gemini AI Studio', value: 'gemini', disabled: false },
    { name: 'LM Studio (ローカル)', value: 'lmstudio', disabled: false },
    { name: 'OpenAI (未実装)', value: 'openai', disabled: true },
    { name: 'Claude (Anthropic) (未実装)', value: 'anthropic', disabled: true }
]);

// --- 要約用AIエンジンのデータ定義 ---
const summaryAiEngines = ref([
    { name: '対話AIエンジンと同期する', value: 'chat-sync' },
    { name: 'Gemini AI Studio', value: 'gemini' },
    { name: 'LM Studio (ローカル)', value: 'lmstudio' },
    { name: 'OpenAI', value: 'openai' },
    { name: 'Claude (Anthropic)', value: 'anthropic' }
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
            caps.isVision = !!found.capabilities.vision;
            caps.isToolUse = !!found.capabilities.trained_for_tool_use;
            caps.isThought = !!found.capabilities.reasoning;
        }
        return caps;
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

const activeTab = ref('engine');
const radioModePrompt = ref('');
const activeTalkPrompt = ref('');
const exRadioModePrompt = ref('');
const exActiveTalkPrompt = ref('');

const DEFAULT_RADIO_MODE_PROMPT = `# Radio Mode Instructions\nあなたは現在、1人喋りの「ラジオパーソナリティ（MC）」としてラジオ番組を配信しています。目の前のリスナー（マスター）に向けてラジオ風の楽しいトークを展開してください。挨拶（「リスナーのみなさんこんにちは！」「お便りありがとうございます」など）や、ラジオ番組らしい進行の言い回しを効果的に使ってください。`;

const DEFAULT_ACTIVE_TALK_PROMPT = `# Active Radio Talk Instructions\n現在、リスナー（ユーザー）からの発話がない状態（沈黙）です。ラジオパーソナリティとして沈黙を破り、リスナーを退屈させないように能動的にフリートークを開始するか、新しい面白い話題（季節、天気、雑談、リスナーへの問いかけなど）を自発的に切り出して、リスナーに楽しく語りかけてください。余計なメタテキストは出力せず、セリフのみを出力してください。`;

const DEFAULT_EX_RADIO_MODE_PROMPT = `# Ex Radio Mode Instructions\nあなたは現在、特別番組「Exラジオ」を配信しています。より専門的で、リスナー（マスター）を驚かせるような先進的な話題（最新AI、科学技術、SFなど）をユーモラスに語ってください。`;

const DEFAULT_EX_ACTIVE_TALK_PROMPT = `# Ex Active Radio Talk Instructions\n現在、リスナーからの反応がありません。「Exラジオ」の進行役として、リスナーが思わず反応したくなるようなSF的仮説や難解なクイズ、面白い豆知識を能動的にフリートークで語りかけてください。`;

const resetRadioPrompts = () => {
    radioModePrompt.value = DEFAULT_RADIO_MODE_PROMPT;
    activeTalkPrompt.value = DEFAULT_ACTIVE_TALK_PROMPT;
};

const resetExRadioPrompts = () => {
    exRadioModePrompt.value = DEFAULT_EX_RADIO_MODE_PROMPT;
    exActiveTalkPrompt.value = DEFAULT_EX_ACTIVE_TALK_PROMPT;
};

const loadFromFile = (target: 'radio' | 'active' | 'exradio' | 'exactive') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md';
    input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt: any) => {
            if (target === 'radio') {
                radioModePrompt.value = evt.target.result as string;
            } else if (target === 'active') {
                activeTalkPrompt.value = evt.target.result as string;
            } else if (target === 'exradio') {
                exRadioModePrompt.value = evt.target.result as string;
            } else if (target === 'exactive') {
                exActiveTalkPrompt.value = evt.target.result as string;
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

const saveToFile = (target: 'radio' | 'active' | 'exradio' | 'exactive') => {
    const text = target === 'radio' ? radioModePrompt.value 
               : target === 'active' ? activeTalkPrompt.value
               : target === 'exradio' ? exRadioModePrompt.value
               : exActiveTalkPrompt.value;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const filename = target === 'radio' ? 'radio_mode_instructions.md'
                   : target === 'active' ? 'active_radio_talk_instructions.md'
                   : target === 'exradio' ? 'ex_radio_mode_instructions.md'
                   : 'ex_active_radio_talk_instructions.md';
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';
    try {
        await configStore.saveConfig();
        if (window.electronAPI && window.electronAPI.saveRadioPrompts) {
            await window.electronAPI.saveRadioPrompts({
                radioMode: radioModePrompt.value,
                activeTalk: activeTalkPrompt.value,
                exRadioMode: exRadioModePrompt.value,
                exActiveTalk: exActiveTalkPrompt.value
            });
        }
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

onMounted(async () => {
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

    // ラジオプロンプトのロード
    if (window.electronAPI && window.electronAPI.getRadioPrompts) {
        try {
            const prompts = await window.electronAPI.getRadioPrompts();
            radioModePrompt.value = prompts.radioMode || (window.electronAPI.isWeb ? DEFAULT_RADIO_MODE_PROMPT : '');
            activeTalkPrompt.value = prompts.activeTalk || (window.electronAPI.isWeb ? DEFAULT_ACTIVE_TALK_PROMPT : '');
            exRadioModePrompt.value = prompts.exRadioMode || (window.electronAPI.isWeb ? DEFAULT_EX_RADIO_MODE_PROMPT : '');
            exActiveTalkPrompt.value = prompts.exActiveTalk || (window.electronAPI.isWeb ? DEFAULT_EX_ACTIVE_TALK_PROMPT : '');
        } catch (e) {
            console.error('Failed to load radio prompts', e);
        }
    }
});
</script>

<template>
    <Card class="premium-card">
        <template #title>チャットAIエンジン設定</template>
        <template #content>
            <!-- タブヘッダー -->
            <div class="tabs-container">
                <button 
                    class="tab-btn" 
                    :class="{ 'active': activeTab === 'engine' }" 
                    @click="activeTab = 'engine'"
                    type="button"
                >
                    <i class="pi pi-cog mr-2"></i>エンジン設定
                </button>
                <button 
                    class="tab-btn" 
                    :class="{ 'active': activeTab === 'radio' }" 
                    @click="activeTab = 'radio'"
                    type="button"
                >
                    <img :src="radioIcon" class="tab-radio-icon mr-2" />ラジオ設定
                </button>
                <button 
                    v-if="selectedEngine === 'lmstudio'"
                    class="tab-btn" 
                    :class="{ 'active': activeTab === 'exradio' }" 
                    @click="activeTab = 'exradio'"
                    type="button"
                >
                    <i class="pi pi-sliders-h mr-2"></i>Exラジオ設定
                </button>
            </div>

            <!-- エンジン設定タブ -->
            <div v-if="activeTab === 'engine'" class="flex flex-column gap-4">
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

                <div class="form-field mt-3">
                    <label class="font-medium flex justify-content-between">
                        <span>Frequency Penalty: {{ frequencyPenalty }}</span>
                    </label>
                    <Slider v-model="frequencyPenalty" :min="-2.0" :max="2.0" :step="0.1" class="mt-2" />
                </div>

                <div class="form-field mt-3">
                    <label class="font-medium flex justify-content-between">
                        <span>Repeat Penalty (繰り返しペナルティ): {{ repetitionPenalty }}</span>
                    </label>
                    <Slider v-model="repetitionPenalty" :min="0.5" :max="2.0" :step="0.05" class="mt-2" />
                </div>

                <div class="form-field mt-3">
                    <label class="font-medium flex justify-content-between">
                        <span>応答長制限 (Max Output Tokens): {{ maxOutputTokens }}</span>
                    </label>
                    <Slider v-model="maxOutputTokens" :min="128" :max="8192" :step="128" class="mt-2" />
                </div>

                <div class="form-field mt-3 flex align-items-center gap-2">
                    <input type="checkbox" id="enableThinking" v-model="enableThinking" class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                    <label for="enableThinking" class="font-medium cursor-pointer">
                        思考機能を有効にする (Enable Thinking / Reasoning)
                    </label>
                </div>

                <!-- 区切り線 -->
                <hr class="my-4" style="border: 0; border-top: 1px solid var(--surface-border); opacity: 0.5;" />

                <!-- 要約用AI設定セクション -->
                <div class="flex flex-column gap-3">
                    <h3 class="text-base font-semibold m-0 flex align-items-center gap-2">
                        <i class="pi pi-file-edit text-purple-500"></i>
                        <span>メッセージ履歴の要約設定</span>
                    </h3>
                    <p class="text-xs text-gray-500 m-0">
                        一定の会話数を超えた際、過去の履歴を圧縮（要約）するために使用するAIエンジンとモデルを指定します。
                    </p>

                    <div class="form-field">
                        <label class="font-medium">要約用AIエンジン</label>
                        <Select 
                            v-model="summaryEngine" 
                            :options="summaryAiEngines" 
                            optionLabel="name" 
                            optionValue="value" 
                            class="w-full" 
                        />
                    </div>

                    <div v-if="summaryEngine !== 'chat-sync'" class="form-field mt-2">
                        <label class="font-medium">要約用モデル名</label>

                        <!-- Gemini -->
                        <div v-if="summaryEngine === 'gemini'" class="flex flex-column gap-2 w-full">
                            <Select 
                                v-model="summaryGeminiModel" 
                                :options="geminiModelOptions" 
                                editable
                                placeholder="モデルを選択または直接入力..." 
                                class="w-full" 
                            />
                        </div>

                        <!-- LM Studio -->
                        <div v-else-if="summaryEngine === 'lmstudio'" class="flex flex-column gap-2 w-full">
                            <Select 
                                v-if="lmstudioModels.length > 0"
                                v-model="summaryLmstudioModel" 
                                :options="lmstudioModels" 
                                optionLabel="id"
                                optionValue="id"
                                editable
                                placeholder="モデルを選択または直接入力..." 
                                class="w-full" 
                            />
                            <InputText 
                                v-else
                                v-model="summaryLmstudioModel" 
                                placeholder="例: Meta-Llama-3-8B-Instruct-GGUF" 
                                class="w-full" 
                            />
                        </div>

                        <!-- OpenAI -->
                        <Select 
                            v-else-if="summaryEngine === 'openai'"
                            v-model="summaryOpenaiModel" 
                            :options="openaiModelOptions" 
                            editable
                            placeholder="モデルを選択または直接入力..." 
                            class="w-full" 
                        />

                        <!-- Anthropic -->
                        <Select 
                            v-else-if="summaryEngine === 'anthropic'"
                            v-model="summaryAnthropicModel" 
                            :options="anthropicModelOptions" 
                            editable
                            placeholder="モデルを選択または直接入力..." 
                            class="w-full" 
                        />
                    </div>

                    <div class="form-field mt-3">
                        <label class="font-medium flex justify-content-between">
                            <span>要約対象の最大総文字数</span>
                        </label>
                        <InputText 
                            v-model.number="summaryMaxCharLimit" 
                            type="number"
                            placeholder="例: 2500" 
                            class="w-full" 
                        />
                        <small class="text-xs text-gray-500 mt-1">
                            ※ ローカルLLMなどのコンテキスト制限エラーを防ぐため、要約対象となる履歴の総文字数を制限します（デフォルト: 2500）。
                        </small>
                    </div>
                </div>
            </div>

            <!-- ラジオ設定タブ -->
            <div v-else-if="activeTab === 'radio'" class="flex flex-column gap-4">
                <div class="form-field">
                    <div class="flex justify-content-between align-items-center mb-1">
                        <label class="font-medium">ラジオパーソナリティ・システムプロンプト</label>
                        <div class="flex gap-2">
                            <Button 
                                icon="pi pi-file-import" 
                                class="p-button-text p-button-sm p-button-secondary py-1" 
                                label="ファイルからロード" 
                                @click="loadFromFile('radio')" 
                                title="ローカルのテキストファイルまたはMarkdownファイルから読み込みます"
                            />
                            <Button 
                                icon="pi pi-file-export" 
                                class="p-button-text p-button-sm p-button-secondary py-1" 
                                label="ファイルに保存" 
                                @click="saveToFile('radio')" 
                                title="現在のプロンプトをテキストファイルとしてダウンロードします"
                            />
                        </div>
                    </div>
                    <Textarea 
                        v-model="radioModePrompt" 
                        rows="6" 
                        class="w-full" 
                        autoResize 
                        placeholder="ラジオモード時の振る舞いについてプロンプトを入力..."
                    />
                    <small class="text-xs text-gray-500 mt-1">
                        ※ ラジオモード（自動でお喋りするモード）における基本的なキャラクター設定やラジオの進行ルールを記述します。
                    </small>
                </div>

                <div class="form-field mt-3">
                    <div class="flex justify-content-between align-items-center mb-1">
                        <label class="font-medium">能動フリートーク（アクティブトーク）・システムプロンプト</label>
                        <div class="flex gap-2">
                            <Button 
                                icon="pi pi-file-import" 
                                class="p-button-text p-button-sm p-button-secondary py-1" 
                                label="ファイルからロード" 
                                @click="loadFromFile('active')" 
                                title="ローカルのテキストファイルまたはMarkdownファイルから読み込みます"
                            />
                            <Button 
                                icon="pi pi-file-export" 
                                class="p-button-text p-button-sm p-button-secondary py-1" 
                                label="ファイルに保存" 
                                @click="saveToFile('active')" 
                                title="現在のプロンプトをテキストファイルとしてダウンロードします"
                            />
                        </div>
                    </div>
                    <Textarea 
                        v-model="activeTalkPrompt" 
                        rows="6" 
                        class="w-full" 
                        autoResize 
                        placeholder="沈黙時のフリートークに関するプロンプトを入力..."
                    />
                    <small class="text-xs text-gray-500 mt-1">
                        ※ ユーザーからの発話がない状態（沈黙）から能動的に話題を切り出す際の指示を記述します。
                    </small>
                </div>

                <div class="reset-btn-container mt-2">
                    <Button 
                        label="プロンプトをデフォルトに戻す" 
                        icon="pi pi-refresh" 
                        class="p-button-outlined p-button-secondary p-button-sm" 
                        @click="resetRadioPrompts"
                    />
                </div>
            </div>

            <!-- Exラジオ設定タブ -->
            <div v-else-if="activeTab === 'exradio' && selectedEngine === 'lmstudio'" class="flex flex-column gap-4">
                <div class="form-field">
                    <label class="font-medium">Exラジオ機能の有効化</label>
                    <div class="flex align-items-center gap-3">
                        <Button 
                            :label="useExRadio ? '有効' : '無効'" 
                            :icon="useExRadio ? 'pi pi-check-circle' : 'pi pi-times-circle'" 
                            :class="useExRadio ? 'p-button-success' : 'p-button-secondary'" 
                            @click="useExRadio = !useExRadio"
                            style="width: 100px;"
                        />
                        <span class="text-xs text-gray-600">
                            LM Studio使用時に、Exラジオプロンプト（拡張用プロンプト）を優先して使用します。
                        </span>
                    </div>
                </div>

                <div class="form-field mt-3">
                    <div class="flex justify-content-between align-items-center mb-1">
                        <label class="font-medium">Exラジオパーソナリティ・システムプロンプト</label>
                        <div class="flex gap-2">
                            <Button 
                                icon="pi pi-file-import" 
                                class="p-button-text p-button-sm p-button-secondary py-1" 
                                label="ファイルからロード" 
                                @click="loadFromFile('exradio')" 
                                title="ローカルのテキストファイルまたはMarkdownファイルから読み込みます"
                            />
                            <Button 
                                icon="pi pi-file-export" 
                                class="p-button-text p-button-sm p-button-secondary py-1" 
                                label="ファイルに保存" 
                                @click="saveToFile('exradio')" 
                                title="現在のプロンプトをテキストファイルとしてダウンロードします"
                            />
                        </div>
                    </div>
                    <Textarea 
                        v-model="exRadioModePrompt" 
                        rows="6" 
                        class="w-full" 
                        autoResize 
                        placeholder="Exラジオモード時の振る舞いについてプロンプトを入力..."
                    />
                    <small class="text-xs text-gray-500 mt-1">
                        ※ Exラジオモードにおける基本的なキャラクター設定やラジオの進行ルールを記述します。
                    </small>
                </div>

                <div class="form-field mt-3">
                    <div class="flex justify-content-between align-items-center mb-1">
                        <label class="font-medium">Ex能動フリートーク（アクティブトーク）・システムプロンプト</label>
                        <div class="flex gap-2">
                            <Button 
                                icon="pi pi-file-import" 
                                class="p-button-text p-button-sm p-button-secondary py-1" 
                                label="ファイルからロード" 
                                @click="loadFromFile('exactive')" 
                                title="ローカルのテキストファイルまたはMarkdownファイルから読み込みます"
                            />
                            <Button 
                                icon="pi pi-file-export" 
                                class="p-button-text p-button-sm p-button-secondary py-1" 
                                label="ファイルに保存" 
                                @click="saveToFile('exactive')" 
                                title="現在のプロンプトをテキストファイルとしてダウンロードします"
                            />
                        </div>
                    </div>
                    <Textarea 
                        v-model="exActiveTalkPrompt" 
                        rows="6" 
                        class="w-full" 
                        autoResize 
                        placeholder="Exラジオの沈黙時のフリートークに関するプロンプトを入力..."
                    />
                    <small class="text-xs text-gray-500 mt-1">
                        ※ ユーザーからの発話がない状態（沈黙）から能動的に話題を切り出す際の指示を記述します。
                    </small>
                </div>

                <div class="reset-btn-container mt-2">
                    <Button 
                        label="Exプロンプトをデフォルトに戻す" 
                        icon="pi pi-refresh" 
                        class="p-button-outlined p-button-secondary p-button-sm" 
                        @click="resetExRadioPrompts"
                    />
                </div>
            </div>

            <!-- 保存ボタン（共通） -->
            <div class="flex justify-content-end mt-4">
                <Button 
                    :label="saveStatus" 
                    :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                    class="p-button-primary" 
                    :disabled="isSaving"
                    @click="saveSettings" 
                />
            </div>
        </template>
    </Card>
</template>

<style scoped>
.tabs-container {
    display: flex;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 1.5rem;
    gap: 1.5rem;
}

.tab-btn {
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 0.75rem 0.5rem;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.2s ease;
    margin-bottom: -2px;
}

.tab-btn:hover {
    color: #a855f7;
}

.tab-btn.active {
    color: #a855f7;
    border-bottom-color: #a855f7;
}

.tab-radio-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    opacity: 0.6;
    transition: opacity 0.2s ease;
}

.tab-btn:hover .tab-radio-icon,
.tab-btn.active .tab-radio-icon {
    opacity: 1;
    filter: invert(39%) sepia(51%) saturate(1514%) hue-rotate(235deg) brightness(101%) contrast(98%);
}

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

.reset-btn-container {
    display: flex;
    justify-content: flex-start;
}
</style>
