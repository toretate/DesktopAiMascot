<script setup lang="ts">
import { ref, watch } from 'vue';
import Button from 'primevue/button';

const props = defineProps<{
    visible: boolean;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'import', base64Image: string): void;
}>();

const selectedImage = ref<string>('');
const isDragOver = ref(false);

watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            selectedImage.value = '';
            isDragOver.value = false;
        }
    }
);

// ファイル選択ハンドラー（Electronのダイアログを使用）
const selectFile = async () => {
    if (window.electronAPI?.selectLocalImage) {
        const result = await window.electronAPI.selectLocalImage();
        if (result && result.success) {
            selectedImage.value = result.path;
        }
    } else {
        // Webフォールバック用
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    selectedImage.value = reader.result as string;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }
};

// ドラッグ＆ドロップイベントハンドラー
const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    isDragOver.value = true;
};

const onDragLeave = () => {
    isDragOver.value = false;
};

const onDrop = (e: DragEvent) => {
    e.preventDefault();
    isDragOver.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
            selectedImage.value = reader.result as string;
        };
        reader.readAsDataURL(file);
    }
};

const handleImport = () => {
    if (!selectedImage.value) return;
    emit('import', selectedImage.value);
    emit('close');
};
</script>

<template>
    <div v-if="visible" class="custom-modal-overlay sprite-import-overlay">
        <div class="custom-modal-card sprite-import-card">
            <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
                <h2 class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-file-import text-purple-600 text-sm"></i>
                    <span>AIスプライトインポート (スプライトシートから切り出し)</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <div class="modal-body-container flex flex-column gap-3 mt-3 flex-1 overflow-hidden" style="min-height: 0;">
                <!-- D&Dおよび画像表示エリア -->
                <div 
                    class="flex-1 border-2 border-round flex flex-column align-items-center justify-content-center relative overflow-hidden transition-all"
                    :class="{
                        'border-purple-400 bg-purple-50/20': isDragOver,
                        'border-dashed border-gray-300 bg-slate-50 hover:bg-slate-100/50': !isDragOver && !selectedImage,
                        'border-solid border-gray-200 checkerboard-bg': selectedImage
                    }"
                    @dragover="onDragOver"
                    @dragleave="onDragLeave"
                    @drop="onDrop"
                    style="min-height: 300px;"
                >
                    <template v-if="selectedImage">
                        <img :src="selectedImage" class="max-w-full max-h-full object-contain p-2" />
                    </template>
                    <template v-else>
                        <i class="pi pi-cloud-upload text-slate-400 text-5xl mb-2"></i>
                        <span class="text-xs font-bold text-slate-600">画像をここにドラッグ＆ドロップ</span>
                        <span class="text-xxs text-slate-400 mt-1">または 下記のボタンからファイルを選択してください</span>
                    </template>
                </div>

                <!-- ボタンエリア -->
                <div class="bg-slate-50 border-round p-3 border-1 border-gray-200 flex justify-content-between align-items-center">
                    <Button 
                        label="ファイル選択" 
                        icon="pi pi-image" 
                        class="p-button-outlined p-button-secondary p-button-sm font-bold" 
                        @click="selectFile" 
                    />

                    <div class="flex gap-2">
                        <Button 
                            label="スプライトインポート" 
                            icon="pi pi-file-import" 
                            class="p-button-success p-button-sm px-4 font-bold shadow-sm" 
                            :disabled="!selectedImage"
                            @click="handleImport" 
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.sprite-import-overlay {
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
    z-index: 2000;
}

.sprite-import-card {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    width: 60vw !important;
    max-width: 680px !important;
    height: 70vh !important;
    max-height: 540px !important;
    display: flex;
    flex-direction: column;
    color: #1e293b;
    overflow: hidden !important;
    padding: 10px 20px 16px 20px !important;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}

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
</style>
