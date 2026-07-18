<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useConfigStore } from '@/store/config';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import Select from 'primevue/select';

const props = defineProps<{
    visible: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const configStore = useConfigStore();
const {
    selectedImageEngine,
    forgeEndpoint,
    forgeModel,
    forgeLora,
    forgeSteps,
    forgeCfgScale,
    forgeWidth,
    forgeHeight,
    forgePrompt,
    forgeNegativePrompt,
    forgeSampler,
    forgePresets,
    forgeModelsList,
    forgeLorasList
} = storeToRefs(configStore);

// ダイアログ内のローカル状態
interface LoraItem {
    name: string;
    weight: number;
}

const localEngine = ref(selectedImageEngine.value);
const localModel = ref(forgeModel.value);
const localLoras = ref<LoraItem[]>([]);
const localSteps = ref(forgeSteps.value);
const localCfgScale = ref(forgeCfgScale.value);
const localPrompt = ref(forgePrompt.value);
const localNegativePrompt = ref(forgeNegativePrompt.value);
const localSampler = ref(forgeSampler.value);
const resolution = ref(`${forgeWidth.value}x${forgeHeight.value}`);

// プリセット用構造定義
interface ImageGenPreset {
    name: string;
    engine: string;
    model: string;
    lora: string;
    prompt: string;
    negativePrompt: string;
    resolution: string;
    sampler: string;
    steps: number;
    cfgScale: number;
}

// プリセットの状態
const presetsList = ref<ImageGenPreset[]>([]);
const selectedPresetName = ref('');
const newPresetName = ref('');

// プリセット操作メソッド
const loadPresetsFromStore = () => {
    try {
        presetsList.value = JSON.parse(forgePresets.value || '[]');
    } catch (e) {
        presetsList.value = [];
    }
};

const applyPreset = (name: string) => {
    const preset = presetsList.value.find(p => p.name === name);
    if (!preset) return;
    localEngine.value = preset.engine;
    localModel.value = preset.model;
    localPrompt.value = preset.prompt;
    localNegativePrompt.value = preset.negativePrompt;
    resolution.value = preset.resolution;
    localSampler.value = preset.sampler;
    localSteps.value = preset.steps;
    localCfgScale.value = preset.cfgScale;
    
    // LoRAパース
    localLoras.value = preset.lora 
        ? preset.lora.split(',').map(item => {
            const parts = item.split(':');
            return {
                name: parts[0]?.trim() || '',
                weight: parts[1] !== undefined ? parseFloat(parts[1]) : 1.0
            };
        }).filter(l => l.name)
        : [];
    
    selectedPresetName.value = name;
    newPresetName.value = name;
};

const savePreset = async () => {
    const name = newPresetName.value.trim();
    if (!name) {
        alert('プリセット名を入力してください。');
        return;
    }
    
    presetsList.value = presetsList.value.filter(p => p.name !== name);
    
    const loraString = localLoras.value
        .filter(l => l.name)
        .map(l => `${l.name}:${l.weight.toFixed(2)}`)
        .join(', ');
        
    presetsList.value.push({
        name,
        engine: localEngine.value,
        model: localModel.value,
        lora: loraString,
        prompt: localPrompt.value,
        negativePrompt: localNegativePrompt.value,
        resolution: resolution.value,
        sampler: localSampler.value,
        steps: localSteps.value,
        cfgScale: localCfgScale.value
    });
    
    forgePresets.value = JSON.stringify(presetsList.value);
    selectedPresetName.value = name;
    
    try {
        await configStore.saveConfig();
        alert(`プリセット「${name}」を保存しました。`);
    } catch (e: any) {
        alert(`プリセットの保存に失敗しました: ${e.message}`);
    }
};

const deletePreset = async (name: string) => {
    if (!name) return;
    if (!confirm(`プリセット「${name}」を削除しますか？`)) return;
    
    presetsList.value = presetsList.value.filter(p => p.name !== name);
    forgePresets.value = JSON.stringify(presetsList.value);
    
    if (selectedPresetName.value === name) {
        selectedPresetName.value = '';
        newPresetName.value = '';
    }
    
    try {
        await configStore.saveConfig();
        alert(`プリセット「${name}」を削除しました。`);
    } catch (e: any) {
        alert(`プリセットの削除に失敗しました: ${e.message}`);
    }
};

// LoRAのフォルダフィルタ状態とロジック
const selectedFolder = ref('');

const loraFolders = computed(() => {
    const folders = new Set<string>();
    for (const path of forgeLorasList.value) {
        if (path.includes('/') || path.includes('\\')) {
            const lastSlashIdx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
            if (lastSlashIdx > 0) {
                folders.add(path.substring(0, lastSlashIdx));
            }
        }
    }
    return Array.from(folders).sort();
});

const filteredLorasList = computed(() => {
    if (!selectedFolder.value) return forgeLorasList.value;
    return forgeLorasList.value.filter(path => {
        const normalizedPath = path.replace(/\\/g, '/');
        const normalizedFolder = selectedFolder.value.replace(/\\/g, '/');
        return normalizedPath.startsWith(normalizedFolder + '/');
    });
});

const addLora = () => {
    localLoras.value.push({ name: '', weight: 1.0 });
};

const removeLora = (index: number) => {
    localLoras.value.splice(index, 1);
};

const engines = ref([
    { name: 'DALL-E 3 (OpenAI)', value: 'dalle3' },
    { name: 'Stable Diffusion Forge', value: 'sd_forge' }
]);

const resolutions = ref([
    { name: '1024 x 1024 (1:1 正方形 - 標準)', value: '1024x1024' },
    { name: '832 x 1216 (2:3 縦長 - キャラ立ち絵推奨)', value: '832x1216' },
    { name: '896 x 1152 (3:4 縦長 - ポートレート)', value: '896x1152' },
    { name: '768 x 1024 (3:4 縦長 - キャラ標準)', value: '768x1024' },
    { name: '1216 x 832 (3:2 横長 - 風景向け)', value: '1216x832' },
    { name: '1152 x 896 (4:3 横長 - グループ写真等)', value: '1152x896' },
    { name: '720 x 1280 (9:16 縦長 - 壁紙向け)', value: '720x1280' },
    { name: '1280 x 720 (16:9 横長 - シネマティック)', value: '1280x720' }
]);

const samplers = ref([
    { name: 'Euler a', value: 'Euler a' },
    { name: 'Euler', value: 'Euler' },
    { name: 'Heun', value: 'Heun' },
    { name: 'DPM++ 2M Karras', value: 'DPM++ 2M Karras' },
    { name: 'DPM++ SDE Karras', value: 'DPM++ SDE Karras' },
    { name: 'DPM++ 2M SDE Karras', value: 'DPM++ 2M SDE Karras' },
    { name: 'DDIM', value: 'DDIM' }
]);

// モーダル表示時に初期化
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            localEngine.value = selectedImageEngine.value;
            localModel.value = forgeModel.value;
            localLoras.value = forgeLora.value 
                ? forgeLora.value.split(',').map(item => {
                    const parts = item.split(':');
                    return {
                        name: parts[0]?.trim() || '',
                        weight: parts[1] !== undefined ? parseFloat(parts[1]) : 1.0
                    };
                }).filter(l => l.name)
                : [];
            localSteps.value = forgeSteps.value;
            localCfgScale.value = forgeCfgScale.value;
            localPrompt.value = forgePrompt.value;
            localNegativePrompt.value = forgeNegativePrompt.value;
            localSampler.value = forgeSampler.value;
            resolution.value = `${forgeWidth.value}x${forgeHeight.value}`;
            
            // プリセットの初期化ロード
            loadPresetsFromStore();
            selectedPresetName.value = '';
            newPresetName.value = '';
            selectedFolder.value = '';
        }
    }
);

const handleSave = async () => {
    // 縦横解像度の分解
    const [w, h] = resolution.value.split('x').map(Number);

    // configStoreに適用
    selectedImageEngine.value = localEngine.value;
    forgeModel.value = localModel.value;
    forgeLora.value = localLoras.value
        .filter(l => l.name)
        .map(l => `${l.name}:${l.weight.toFixed(2)}`)
        .join(', ');
    forgeSteps.value = localSteps.value;
    forgeCfgScale.value = localCfgScale.value;
    forgePrompt.value = localPrompt.value;
    forgeNegativePrompt.value = localNegativePrompt.value;
    forgeSampler.value = localSampler.value;
    if (w && h) {
        forgeWidth.value = w;
        forgeHeight.value = h;
    }

    try {
        await configStore.saveConfig();
        alert('生成設定を保存しました。');
        emit('close');
    } catch (e: any) {
        alert(`設定の保存に失敗しました: ${e.message}`);
    }
};
</script>

<template>
    <div v-if="visible" class="custom-modal-overlay image-gen-dialog-overlay">
        <div class="custom-modal-card image-gen-dialog-card">
            <!-- ヘッダー -->
            <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
                <h2 class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-cog text-brand-600 text-sm"></i>
                    <span>画像生成・編集パラメータ設定</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <!-- モーダルボディ -->
            <div class="modal-body-container flex flex-column gap-3 mt-3 overflow-y-auto flex-1 pr-1" style="min-height: 0;">
                <!-- 0. プリセット機能 (共通・最上部) -->
                <div class="form-field flex flex-column gap-2 border-1 border-slate-100 border-round p-2 bg-theme-alpha-05 mb-2">
                    <label class="font-bold text-xs text-brand-700 select-none flex align-items-center gap-1">
                        <i class="pi pi-bookmark text-brand-600"></i>
                        パラメータプリセット
                    </label>
                    <div class="flex flex-column gap-2">
                        <!-- プリセットの選択 & 削除 -->
                        <div class="flex gap-2">
                            <select 
                                v-model="selectedPresetName" 
                                class="flex-1 p-2 bg-white border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none cursor-pointer"
                                @change="applyPreset(selectedPresetName)"
                            >
                                <option value="">-- プリセットを選択 --</option>
                                <option v-for="p in presetsList" :key="p.name" :value="p.name">{{ p.name }}</option>
                            </select>
                            <Button 
                                icon="pi pi-trash" 
                                class="p-button-danger p-button-outlined p-button-sm text-red-500 hover:bg-red-50" 
                                style="width: 32px; height: 32px; padding: 0;"
                                :disabled="!selectedPresetName"
                                @click="deletePreset(selectedPresetName)"
                                title="選択中のプリセットを削除"
                            />
                        </div>
                        <!-- 新規保存 -->
                        <div class="flex gap-2 align-items-center">
                            <input 
                                type="text" 
                                v-model="newPresetName" 
                                placeholder="プリセット名を入力して保存" 
                                class="flex-1 p-2 bg-white border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none"
                            />
                            <Button 
                                label="保存" 
                                icon="pi pi-save" 
                                class="p-button-primary p-button-sm py-1 px-3 text-xs" 
                                style="height: 32px;"
                                @click="savePreset"
                            />
                        </div>
                    </div>
                </div>

                <!-- 1. 画像生成エンジン (共通) -->
                <div class="form-field flex flex-column gap-1">
                    <label class="font-bold text-xs text-slate-700 select-none">画像生成エンジン</label>
                    <select 
                        v-model="localEngine" 
                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none cursor-pointer"
                    >
                        <option v-for="eng in engines" :key="eng.value" :value="eng.value">{{ eng.name }}</option>
                    </select>
                </div>

                <!-- 2. 使用モデル (チェックポイント) (SD系のみ) -->
                <div v-if="localEngine === 'sd_forge'" class="form-field flex flex-column gap-1">
                    <label class="font-bold text-xs text-slate-700 select-none">使用モデル (チェックポイント)</label>
                    <Select 
                        v-model="localModel" 
                        :options="forgeModelsList" 
                        editable 
                        class="w-full text-xs" 
                        placeholder="空欄でデフォルトを使用"
                    />
                </div>

                <!-- 3. 使用 LoRA (SD系のみ - 複数追加および強度調整) -->
                <div v-if="localEngine === 'sd_forge'" class="form-field flex flex-column gap-2 border-1 border-slate-100 border-round p-2 bg-slate-50/50">
                    <div class="flex justify-content-between align-items-center mb-1">
                        <label class="font-bold text-xs text-slate-700 select-none flex align-items-center gap-1">
                            <i class="pi pi-sliders-h text-brand-500"></i>
                            使用 LoRA (複数追加・個別強度調整)
                        </label>
                        <div class="flex gap-1 align-items-center">
                            <!-- フォルダフィルタ -->
                            <select 
                                v-model="selectedFolder" 
                                class="p-1 border-1 border-gray-200 border-round text-slate-700 text-xxs focus:border-brand-400 focus:outline-none cursor-pointer bg-white"
                                style="max-width: 100px;"
                            >
                                <option value="">(すべて)</option>
                                <option v-for="f in loraFolders" :key="f" :value="f">{{ f }}</option>
                            </select>
                            
                            <Button 
                                icon="pi pi-plus" 
                                label="LoRAを追加" 
                                class="p-button-outlined p-button-secondary p-button-xs py-1 text-xxs font-bold animate-pulse" 
                                style="padding: 2px 6px; font-size: 9px;"
                                @click="addLora" 
                            />
                        </div>
                    </div>
                    
                    <!-- 追加された LoRA リスト -->
                    <div v-if="localLoras.length > 0" class="flex flex-column gap-2 mt-1">
                        <div 
                            v-for="(lora, idx) in localLoras" 
                            :key="idx" 
                            class="flex align-items-center gap-2 border-bottom border-gray-100 pb-2 mb-1 text-xs"
                        >
                            <!-- LoRA名選択ドロップダウン -->
                            <Select 
                                v-model="lora.name" 
                                :options="filteredLorasList" 
                                editable 
                                class="flex-1 text-xs select-lora" 
                                placeholder="LoRAを選択"
                            />
                            
                            <!-- 強度スライダー -->
                            <div class="flex flex-column gap-1 flex-1" style="min-width: 100px;">
                                <div class="flex justify-content-between align-items-center text-xxs text-slate-500 select-none">
                                    <span>強度 (Weight)</span>
                                    <span class="font-mono font-bold text-brand-600">{{ lora.weight.toFixed(2) }}</span>
                                </div>
                                <Slider v-model="lora.weight" :min="-2.0" :max="2.0" :step="0.05" class="py-1" />
                            </div>

                            <!-- 削除ボタン -->
                            <Button 
                                icon="pi pi-trash" 
                                class="p-button-rounded p-button-danger p-button-text p-button-sm text-red-500 hover:bg-red-50" 
                                style="width: 28px; height: 28px; padding: 0;"
                                @click="removeLora(idx)" 
                            />
                        </div>
                    </div>
                    <div v-else class="text-center text-xxs text-slate-400 py-2 border-1 border-dashed border-gray-200 border-round bg-white select-none">
                        LoRAは設定されていません
                    </div>
                </div>

                <!-- 4. Prompt (共通) -->
                <div class="form-field flex flex-column gap-1">
                    <label class="font-bold text-xs text-slate-700 select-none">Prompt (ベースプロンプト)</label>
                    <textarea 
                        v-model="localPrompt" 
                        rows="3" 
                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none resize-y"
                        placeholder="生成時に常に適用される基本プロンプト（例: masterpiece, best quality）。空欄時はチャット入力のみを使用。"
                    ></textarea>
                </div>

                <!-- 5. Negative Prompt (SD系のみ) -->
                <div v-if="localEngine === 'sd_forge'" class="form-field flex flex-column gap-1">
                    <label class="font-bold text-xs text-slate-700 select-none">Negative Prompt (ネガティブプロンプト)</label>
                    <textarea 
                        v-model="localNegativePrompt" 
                        rows="2" 
                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none resize-y"
                        placeholder="生成から除外したい要素（例: nsfw, low quality, deformed 等）"
                    ></textarea>
                </div>

                <!-- 6. 画像解像度 (共通) -->
                <div class="form-field flex flex-column gap-1">
                    <label class="font-bold text-xs text-slate-700 select-none">画像解像度</label>
                    <select 
                        v-model="resolution" 
                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none cursor-pointer"
                    >
                        <option v-for="res in resolutions" :key="res.value" :value="res.value">{{ res.name }}</option>
                    </select>
                </div>

                <!-- 7. Sampler (SD系のみ) -->
                <div v-if="localEngine === 'sd_forge'" class="form-field flex flex-column gap-1">
                    <label class="font-bold text-xs text-slate-700 select-none">Sampler</label>
                    <select 
                        v-model="localSampler" 
                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-brand-400 focus:outline-none cursor-pointer"
                    >
                        <option v-for="samp in samplers" :key="samp.value" :value="samp.value">{{ samp.name }}</option>
                    </select>
                </div>

                <!-- 8. Sampling Steps (SD系のみ) -->
                <div v-if="localEngine === 'sd_forge'" class="form-field flex flex-column gap-1">
                    <div class="flex justify-content-between align-items-center">
                        <label class="font-bold text-xs text-slate-700 select-none">Sampling Steps</label>
                        <span class="text-xxs font-mono font-bold text-brand-600">{{ localSteps }}</span>
                    </div>
                    <Slider v-model="localSteps" :min="1" :max="100" :step="1" class="mt-1" />
                </div>

                <!-- 9. CFG Scale (SD系のみ) -->
                <div v-if="localEngine === 'sd_forge'" class="form-field flex flex-column gap-1">
                    <div class="flex justify-content-between align-items-center">
                        <label class="font-bold text-xs text-slate-700 select-none">CFG Scale</label>
                        <span class="text-xxs font-mono font-bold text-brand-600">{{ localCfgScale.toFixed(1) }}</span>
                    </div>
                    <Slider v-model="localCfgScale" :min="1.0" :max="20.0" :step="0.5" class="mt-1" />
                </div>
            </div>

            <!-- フッター -->
            <div class="modal-footer flex justify-content-end gap-2 pt-3 border-top border-gray-200 mt-3 no-drag">
                <Button label="キャンセル" class="p-button-secondary p-button-sm" @click="emit('close')" />
                <Button label="設定を保存" icon="pi pi-check" class="p-button-primary p-button-sm px-4" @click="handleSave" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.image-gen-dialog-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.9) !important;
    backdrop-filter: blur(12px) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    border-radius: 16px;
    overflow: hidden;
}

.image-gen-dialog-card {
    background: #ffffff !important;
    border: none !important;
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    display: flex;
    flex-direction: column;
    color: #1e293b;
    overflow: hidden !important;
    padding: 12px 16px !important;
    border-radius: 16px;
    box-shadow: none !important;
    box-sizing: border-box;
}

.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}
.border-top {
    border-top: 1px solid #e2e8f0 !important;
}

.text-xxs {
    font-size: 10px;
}
</style>
