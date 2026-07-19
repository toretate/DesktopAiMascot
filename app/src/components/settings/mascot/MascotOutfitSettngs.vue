<script setup lang="ts">
import Button from 'primevue/button';
import { useConfigStore } from '../../../store/config';
import { resolveMascotImageUrl } from '../../../utils/mascot-image-url';

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    originalPath?: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
    expressions?: MascotAsset[];
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
            engine?: string;
            speaker_id?: number;
            style?: string;
            irodori_voice?: string;
            irodori_model?: string;
        };
    };
    assets: {
        outfits: MascotAsset[];
        expressions: MascotAsset[];
        poses: MascotAsset[];
    };
}

const props = defineProps<{
    editingMascot: MascotData;
}>();

const emit = defineEmits<{
    (e: 'add-outfit'): void;
    (e: 'delete-outfit', outfit: MascotAsset): void;
    (e: 'background-removal', outfit: MascotAsset): void;
    (e: 'set-main-outfit', outfit: MascotAsset): void;
}>();

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
</script>

<template>
    <div class="flex flex-column gap-3">
        <div class="flex gap-2">
            <Button 
                label="ローカル画像から立ち絵を追加" 
                icon="pi pi-file-import" 
                class="p-button-primary p-button-sm flex-1"
                @click="emit('add-outfit')"
            />
        </div>

        <div class="form-field p-3 bg-white border-round border-1 border-gray-200 mt-2 flex flex-column gap-2">
            <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                <i class="pi pi-image text-brand-500"></i>
                <span>登録済みの立ち絵 (全身像)</span>
            </label>

            <div v-if="editingMascot.assets.outfits && editingMascot.assets.outfits.length > 0" class="outfit-grid-container pt-1">
                <div 
                    v-for="outfit in editingMascot.assets.outfits" 
                    :key="outfit.id"
                    class="outfit-grid-cell relative flex flex-column align-items-center justify-content-center border-round border-1 border-gray-200 bg-white p-2"
                    :class="{ 'is-active-outfit': editingMascot.currentOutfitId === outfit.id }"
                >
                    <div v-if="editingMascot.currentOutfitId === outfit.id" class="active-outfit-badge absolute" title="現在使用中">
                        <i class="pi pi-check-circle text-green-500 active-outfit-badge-icon"></i>
                    </div>

                    <div class="outfit-thumbnail flex align-items-center justify-content-center border-round bg-white overflow-hidden cursor-pointer" @click="emit('set-main-outfit', outfit)" title="クリックしてデフォルトの立ち絵に設定">
                        <img v-if="isImage(outfit.path)" :src="resolveImageUrl(outfit.path)" class="w-full h-full object-contain" />
                        <span v-else class="text-xs">{{ outfit.path }}</span>
                    </div>
                    
                    <div class="flex gap-2 mt-2 w-full justify-content-center">
                        <Button icon="pi pi-trash" class="p-button-danger p-button-text p-button-sm" @click="emit('delete-outfit', outfit)" title="削除" />
                        <Button icon="pi pi-eraser" class="p-button-secondary p-button-text p-button-sm" @click="emit('background-removal', outfit)" title="背景削除" />
                        <Button :icon="editingMascot.currentOutfitId === outfit.id ? 'pi pi-star-fill text-yellow-500' : 'pi pi-star'" class="p-button-text p-button-sm" @click="emit('set-main-outfit', outfit)" title="メイン立ち絵に設定" />
                    </div>
                </div>
            </div>
            <div v-else class="text-xs text-gray-400 text-center py-4 select-none">
                ※立ち絵が登録されていません。「ローカル画像から立ち絵を追加」から全身画像を設定してください。
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 立ち絵全身像グリッドセル */
.outfit-grid-cell {
    height: 160px;
    min-width: 0;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    transition: all 0.2s ease;
}
.outfit-grid-cell:hover {
    border-color: #cbd5e1;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.outfit-grid-cell.is-active-outfit {
    border: 2px solid var(--color-primary) !important;
    background-color: var(--color-primary-subtle) !important;
    box-shadow: 0 0 0 1px var(--color-primary), 0 4px 6px -1px var(--color-primary-alpha-10) !important;
}

.active-outfit-badge {
    top: 6px;
    right: 6px;
    z-index: 2;
}

.active-outfit-badge-icon {
    font-size: 14px;
}

.outfit-thumbnail {
    width: 70px;
    height: 100px;
    border: 1px solid rgba(0, 0, 0, 0.03);
    flex-shrink: 0;
}

.outfit-grid-container {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 8px !important;
    max-height: 300px !important;
    overflow-y: auto !important;
    width: 100% !important;
}

@media (max-width: 768px) {
    .outfit-grid-container {
        grid-template-columns: 1fr !important;
    }
}
</style>
