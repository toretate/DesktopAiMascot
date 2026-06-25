<script setup lang="ts">
import { ref, watch } from 'vue';
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
    forgeModelsList,
    forgeLorasList
} = storeToRefs(configStore);

// ダイアログ内のローカル状態
const localEngine = ref(selectedImageEngine.value);
const localModel = ref(forgeModel.value);
const localLora = ref(forgeLora.value);
const localSteps = ref(forgeSteps.value);
const localCfgScale = ref(forgeCfgScale.value);
const resolution = ref(`${forgeWidth.value}x${forgeHeight.value}`);

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

// モーダル表示時に初期化
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            localEngine.value = selectedImageEngine.value;
            localModel.value = forgeModel.value;
            localLora.value = forgeLora.value;
            localSteps.value = forgeSteps.value;
            localCfgScale.value = forgeCfgScale.value;
            resolution.value = `${forgeWidth.value}x${forgeHeight.value}`;
        }
    }
);

const handleSave = async () => {
    // 縦横解像度の分解
    const [w, h] = resolution.value.split('x').map(Number);

    // configStoreに適用
    selectedImageEngine.value = localEngine.value;
    forgeModel.value = localModel.value;
    forgeLora.value = localLora.value;
    forgeSteps.value = localSteps.value;
    forgeCfgScale.value = localCfgScale.value;
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
                    <i class="pi pi-cog text-purple-600 text-sm"></i>
                    <span>画像生成・編集パラメータ設定</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <!-- モーダルボディ -->
            <div class="modal-body-container flex flex-column gap-3 mt-3 overflow-y-auto flex-1 pr-1" style="min-height: 0;">
                <!-- 生成エンジンの選択 -->
                <div class="form-field flex flex-column gap-1">
                    <label class="font-bold text-xs text-slate-700 select-none">画像生成エンジン</label>
                    <select 
                        v-model="localEngine" 
                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-purple-400 focus:outline-none cursor-pointer"
                    >
                        <option v-for="eng in engines" :key="eng.value" :value="eng.value">{{ eng.name }}</option>
                    </select>
                </div>

                <!-- 縦横解像度選択 -->
                <div class="form-field flex flex-column gap-1">
                    <label class="font-bold text-xs text-slate-700 select-none">画像解像度</label>
                    <select 
                        v-model="resolution" 
                        class="w-full p-2 bg-slate-50 border-1 border-gray-200 border-round text-slate-800 text-xs focus:border-purple-400 focus:outline-none cursor-pointer"
                    >
                        <option v-for="res in resolutions" :key="res.value" :value="res.value">{{ res.name }}</option>
                    </select>
                </div>

                <!-- Stable Diffusion Forge 専用の追加パラメータ設定 -->
                <template v-if="localEngine === 'sd_forge'">
                    <!-- モデル名 -->
                    <div class="form-field flex flex-column gap-1">
                        <label class="font-bold text-xs text-slate-700 select-none">使用モデル (チェックポイント)</label>
                        <Select 
                            v-model="localModel" 
                            :options="forgeModelsList" 
                            editable 
                            class="w-full text-xs" 
                            placeholder="空欄でデフォルトを使用"
                        />
                    </div>

                    <!-- LoRA名 -->
                    <div class="form-field flex flex-column gap-1">
                        <label class="font-bold text-xs text-slate-700 select-none">使用 LoRA名</label>
                        <Select 
                            v-model="localLora" 
                            :options="forgeLorasList" 
                            editable 
                            class="w-full text-xs" 
                            placeholder="空欄でLoRAなし"
                        />
                    </div>

                    <!-- Steps -->
                    <div class="form-field flex flex-column gap-1">
                        <div class="flex justify-content-between align-items-center">
                            <label class="font-bold text-xs text-slate-700 select-none">Sampling Steps</label>
                            <span class="text-xxs font-mono font-bold text-purple-600">{{ localSteps }}</span>
                        </div>
                        <Slider v-model="localSteps" :min="1" :max="100" :step="1" class="mt-1" />
                    </div>

                    <!-- CFG Scale -->
                    <div class="form-field flex flex-column gap-1">
                        <div class="flex justify-content-between align-items-center">
                            <label class="font-bold text-xs text-slate-700 select-none">CFG Scale</label>
                            <span class="text-xxs font-mono font-bold text-purple-600">{{ localCfgScale.toFixed(1) }}</span>
                        </div>
                        <Slider v-model="localCfgScale" :min="1.0" :max="20.0" :step="0.5" class="mt-1" />
                    </div>
                </template>
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
