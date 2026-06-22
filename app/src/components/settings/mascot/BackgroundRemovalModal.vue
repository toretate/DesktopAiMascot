<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import Select from 'primevue/select';

const props = defineProps<{
    visible: boolean;
    imageSrc: string;
    mascotId: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'done', newPathOrBase64: string): void;
}>();

const engines = ref([
    { label: 'サーバ (node.js)', value: 'node' },
    { label: 'ToonOut (アニメ向け/BiRefNet)', value: 'toonout' },
    { label: 'BiRefNet general (汎用)', value: 'birefnet-general' },
    { label: 'BiRefNet lite (軽量/高速)', value: 'birefnet-lite' },
    { label: 'ISNet-anime (アニメ/rembg)', value: 'isnet-anime' },
    { label: 'Comfy UI', value: 'comfy' }
]);

const selectedEngine = ref('node');
const isProcessing = ref(false);
const processingStatus = ref('');
const resultImage = ref<string | null>(null);

const bgColors = ref([
    { label: '透過 (市松模様)', value: 'transparent' },
    { label: '白', value: '#ffffff' },
    { label: '黒', value: '#000000' },
    { label: '緑 (クロマキー)', value: '#00ff00' }
]);
const selectedBgColor = ref('transparent');

// comfy ui用テンプレート（一応用意）
const comfyTemplate = ref('');

// 静的画像URLの解決（親と同様）
const resolveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // APIサーバー経由
    return `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;
};

const handleRemoveBackground = async () => {
    const allowed = ['node', 'toonout', 'birefnet-general', 'birefnet-lite', 'isnet-anime', 'comfy'];
    if (!allowed.includes(selectedEngine.value)) {
        alert('対応していないエンジンが選択されています。');
        return;
    }

    isProcessing.value = true;
    processingStatus.value = '背景を削除しています... (数秒から十数秒かかる場合があります)';
    resultImage.value = null;

    try {
        // バックエンドに背景削除リクエストを送信
        const response = await fetch('http://localhost:3000/api/remove-background', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imagePath: props.imageSrc,
                mascotId: props.mascotId,
                engine: selectedEngine.value
            })
        });

        if (!response.ok) {
            throw new Error(`背景削除エラー: ${response.statusText}`);
        }

        const resData = await response.json();
        if (resData.success && resData.image) {
            resultImage.value = resData.image; // Base64データを受け取る
            processingStatus.value = '背景の削除が完了しました！';
        } else {
            throw new Error(resData.error || '背景削除処理に失敗しました。');
        }
    } catch (err: any) {
        console.error(err);
        alert(`背景削除処理中にエラーが発生しました: ${err.message}`);
        processingStatus.value = 'エラーが発生しました。';
    } finally {
        isProcessing.value = false;
    }
};

const handleApply = () => {
    if (resultImage.value) {
        emit('done', resultImage.value);
    }
};
</script>

<template>
    <div v-if="visible" class="custom-modal-overlay remove-bg-overlay">
        <div class="custom-modal-card remove-bg-card">
            <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
                <h2 class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-eraser text-purple-500"></i>
                    <span>立ち絵の背景削除</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" :disabled="isProcessing" />
            </div>

            <div class="modal-body flex-1 flex flex-column gap-3 mt-3 overflow-hidden" style="min-height: 0;">
                <div class="flex gap-3 h-full overflow-hidden">
                    <!-- 左半分: 設定とプレビュー -->
                    <div class="flex flex-column gap-3 flex-1" style="max-width: 300px;">
                        <div class="form-field flex flex-column gap-1">
                            <label class="text-xs font-bold text-gray-700">背景削除エンジン</label>
                            <Select 
                                v-model="selectedEngine" 
                                :options="engines" 
                                optionLabel="label" 
                                optionValue="value" 
                                class="w-full p-inputtext-sm"
                                :disabled="isProcessing"
                                :pt="{ overlay: { style: 'z-index: 4000 !important' } }"
                            />
                        </div>

                        <div class="form-field flex flex-column gap-1">
                            <label class="text-xs font-bold text-gray-700">結果プレビュー背景色</label>
                            <Select 
                                v-model="selectedBgColor" 
                                :options="bgColors" 
                                optionLabel="label" 
                                optionValue="value" 
                                class="w-full p-inputtext-sm"
                                :pt="{ overlay: { style: 'z-index: 4000 !important' } }"
                            />
                        </div>



                        <div class="flex flex-column gap-2 mt-auto">
                            <Button 
                                label="背景削除を実行" 
                                icon="pi pi-play" 
                                class="p-button-primary w-full" 
                                :loading="isProcessing" 
                                @click="handleRemoveBackground"
                            />
                            <div v-if="processingStatus" class="text-xs text-center font-bold" :class="resultImage ? 'text-green-500' : 'text-slate-500'">
                                {{ processingStatus }}
                            </div>
                        </div>
                    </div>

                    <!-- 右半分: プレビュー画面 -->
                    <div class="flex-1 flex gap-2 h-full overflow-hidden">
                        <!-- オリジナル画像 -->
                        <div class="flex-1 flex flex-column border-round border-1 border-gray-200 bg-slate-50 p-2 overflow-hidden h-full">
                            <span class="text-xxs font-bold text-slate-500 mb-1 select-none">オリジナル</span>
                            <div class="flex-1 flex align-items-center justify-content-center bg-white border-round overflow-hidden relative">
                                <img :src="resolveImageUrl(imageSrc)" class="w-full h-full object-contain" />
                            </div>
                        </div>

                        <!-- 処理後画像 -->
                        <div class="flex-1 flex flex-column border-round border-1 border-gray-200 bg-slate-50 p-2 overflow-hidden h-full">
                            <span class="text-xxs font-bold text-slate-500 mb-1 select-none">背景削除結果</span>
                            <div 
                                class="flex-1 flex align-items-center justify-content-center border-round overflow-hidden relative"
                                :class="{ 'bg-transparent-pattern': selectedBgColor === 'transparent' }"
                                :style="selectedBgColor !== 'transparent' ? { backgroundColor: selectedBgColor } : {}"
                            >
                                <img v-if="resultImage" :src="resultImage" class="w-full h-full object-contain" />
                                <div v-else class="text-xs text-gray-400 text-center px-2 select-none">
                                    背景削除を実行するとここにプレビューが表示されます。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer flex justify-content-end gap-2 pt-2 border-top border-gray-200 mt-2">
                <Button label="キャンセル" icon="pi pi-times" class="p-button-outlined p-button-secondary p-button-sm px-3" @click="emit('close')" :disabled="isProcessing" />
                <Button label="適用して保存" icon="pi pi-check" class="p-button-primary p-button-sm px-4" :disabled="!resultImage || isProcessing" @click="handleApply" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.remove-bg-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(241, 245, 249, 0.8) !important;
    backdrop-filter: blur(12px) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 3000;
}

.remove-bg-card {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    width: 800px !important;
    height: 500px !important;
    display: flex;
    flex-direction: column;
    padding: 16px !important;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}
.border-top {
    border-top: 1px solid #e2e8f0 !important;
}

/* 透過背景パターン */
.bg-transparent-pattern {
    background-color: #ffffff;
    background-image: linear-gradient(45deg, #efefef 25%, transparent 25%),
                      linear-gradient(-45deg, #efefef 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #efefef 75%),
                      linear-gradient(-45deg, transparent 75%, #efefef 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}
</style>

<style>
/* 自前ダイアログの前面にドロップダウンパネルを表示させるためのグローバル上書き */
.p-select-overlay,
.p-select-panel,
.p-dropdown-panel {
    z-index: 9999 !important;
}
</style>
