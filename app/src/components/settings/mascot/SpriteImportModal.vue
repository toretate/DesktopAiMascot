<script setup lang="ts">
import Button from 'primevue/button';
import { onBeforeUnmount, ref, watch } from 'vue';
import AppModalShell from '../../common/AppModalShell.vue';
import { useConfigStore } from '@/store/config';
import { type MascotImageSource, selectMascotImage } from '../../../utils/mascot-image-upload';
import { resolveMascotImageUrl } from '../../../utils/mascot-image-url';

const props = defineProps<{
    visible: boolean;
    mascotId?: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'import', image: MascotImageSource): void;
}>();

const configStore = useConfigStore();
const selectedImage = ref<string>('');
const selectedImageSource = ref<MascotImageSource | null>(null);
let releaseSelectedImage: () => void = () => undefined;
const isDragOver = ref(false);
const activeTab = ref<'upload' | 'history'>('upload');
const generatedSheets = ref<{ url: string; timestamp: string; date: string }[]>([]);
const isLoadingSheets = ref(false);

const clearSelectedImage = () => {
    releaseSelectedImage();
    releaseSelectedImage = () => undefined;
    selectedImage.value = '';
    selectedImageSource.value = null;
};

const resolveImageUrl = (path: string | undefined | null): string => {
    return resolveMascotImageUrl(path, {
        serverHost: configStore.serverHost,
        serverPort: configStore.serverPort,
        absoluteMascotUrl: configStore.useServer
    });
};

const fetchGeneratedSheets = async () => {
    if (!props.mascotId) return;
    isLoadingSheets.value = true;
    try {
        const response = await fetch(`/api/mascots/get-generated-spritesheets?mascotId=${props.mascotId}`);
        const data = await response.json();
        if (data.success && data.list) {
            generatedSheets.value = data.list;
        }
    } catch (e) {
        console.error('[SpriteImportModal] Failed to fetch generated sheets:', e);
    } finally {
        isLoadingSheets.value = false;
    }
};

watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            clearSelectedImage();
            isDragOver.value = false;
            activeTab.value = 'upload';
            generatedSheets.value = [];
            fetchGeneratedSheets();
        } else {
            clearSelectedImage();
        }
    }
);

// ファイル選択ハンドラー（Electronのダイアログを使用）
const selectFile = async () => {
    const result = await selectMascotImage();
    if (!result) return;
    clearSelectedImage();
    selectedImage.value = result.previewUrl;
    selectedImageSource.value = result.source;
    releaseSelectedImage = result.release;
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
        clearSelectedImage();
        const previewUrl = URL.createObjectURL(file);
        selectedImage.value = previewUrl;
        selectedImageSource.value = file;
        releaseSelectedImage = () => URL.revokeObjectURL(previewUrl);
    }
};

const selectGeneratedSheet = (url: string) => {
    clearSelectedImage();
    selectedImage.value = resolveImageUrl(url);
    selectedImageSource.value = selectedImage.value;
    activeTab.value = 'upload'; // プレビュー確認のためアップロード/表示タブに戻す
};

const handleImport = () => {
    if (!selectedImage.value) return;
    emit('import', selectedImageSource.value || selectedImage.value);
    emit('close');
};

onBeforeUnmount(clearSelectedImage);
</script>

<template>
    <AppModalShell
        :visible="visible"
        title-id="sprite-import-modal-title"
        backdrop="light"
        :z-index="2000"
        width="60vw"
        max-width="680px"
        height="70vh"
        max-height="540px"
        padding="10px 20px 16px"
        @close="emit('close')"
    >
        <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
            <h2 id="sprite-import-modal-title" class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-file-import text-brand-600 text-sm"></i>
                    <span>AIスプライトインポート (スプライトシートから切り出し)</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <!-- タブ選択 -->
            <div class="flex border-bottom border-gray-200 mt-2 mb-1">
                <button 
                    class="py-2 px-3 font-semibold text-xs border-bottom-2 transition-all cursor-pointer bg-transparent border-transparent"
                    :class="activeTab === 'upload' ? 'border-brand-500 text-brand-600 font-bold border-solid' : 'text-slate-500 hover:text-slate-700'"
                    style="border-bottom-width: 2px;"
                    @click="activeTab = 'upload'"
                >
                    ファイルをアップロード
                </button>
                <button 
                    class="py-2 px-3 font-semibold text-xs border-bottom-2 transition-all cursor-pointer bg-transparent border-transparent flex align-items-center gap-1"
                    :class="activeTab === 'history' ? 'border-brand-500 text-brand-600 font-bold border-solid' : 'text-slate-500 hover:text-slate-700'"
                    style="border-bottom-width: 2px;"
                    @click="activeTab = 'history'"
                >
                    <span>生成履歴から選択</span>
                    <span v-if="generatedSheets.length > 0" class="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full text-xxs font-bold">
                        {{ generatedSheets.length }}
                    </span>
                </button>
            </div>

            <div class="modal-body-container flex flex-column gap-3 mt-2 flex-1 overflow-hidden" style="min-height: 0;">
                <!-- タブ1: ファイルアップロード -->
                <div 
                    v-if="activeTab === 'upload'"
                    class="flex-1 border-2 border-round flex flex-column align-items-center justify-content-center relative overflow-hidden transition-all"
                    :class="{
                        'border-brand-400 bg-theme-alpha-05': isDragOver,
                        'border-dashed border-gray-300 bg-slate-50 hover:bg-slate-100/50': !isDragOver && !selectedImage,
                        'border-solid border-gray-200 checkerboard-bg': selectedImage
                    }"
                    @dragover="onDragOver"
                    @dragleave="onDragLeave"
                    @drop="onDrop"
                    style="min-height: 280px;"
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

                <!-- タブ2: 生成履歴 -->
                <div v-else-if="activeTab === 'history'" class="flex-1 overflow-y-auto min-h-0 bg-slate-50 border-round border-1 border-gray-200 p-3">
                    <div v-if="isLoadingSheets" class="flex flex-column align-items-center justify-content-center py-5">
                        <i class="pi pi-spin pi-spinner text-2xl text-brand-600 mb-2"></i>
                        <span class="text-xs font-medium text-slate-500">履歴を取得中...</span>
                    </div>
                    <div v-else-if="generatedSheets.length === 0" class="flex flex-column align-items-center justify-content-center py-5 text-slate-400">
                        <i class="pi pi-images text-4xl mb-2"></i>
                        <span class="text-xs font-medium">過去に生成されたスプライトシートはありません。</span>
                    </div>
                    <div v-else class="sheets-grid">
                        <div 
                            v-for="sheet in generatedSheets" 
                            :key="sheet.timestamp"
                            class="sheet-card cursor-pointer"
                            @click="selectGeneratedSheet(sheet.url)"
                        >
                            <div class="sheet-thumbnail-container checkerboard-bg">
                                <img :src="resolveImageUrl(sheet.url)" class="sheet-thumbnail" />
                            </div>
                            <div class="sheet-info">
                                <span class="sheet-name" :title="'spritesheet_' + sheet.timestamp">spritesheet_{{ sheet.timestamp }}</span>
                                <span class="sheet-date">{{ sheet.date }}</span>
                            </div>
                        </div>
                    </div>
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
    </AppModalShell>
</template>

<style scoped>
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

.sheets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px;
}
.sheet-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.sheet-card:hover {
    border-color: var(--color-primary-hover);
    box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.1);
}
.sheet-thumbnail-container {
    width: 100%;
    aspect-ratio: 1 / 1;
    background: #f1f5f9;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}
.sheet-thumbnail {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}
.sheet-info {
    display: flex;
    flex-direction: column;
    font-size: 10px;
    color: #64748b;
    line-height: 1.25;
}
.sheet-name {
    font-weight: 700;
    color: #334155;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
}
.sheet-date {
    margin-top: 2px;
}
</style>
