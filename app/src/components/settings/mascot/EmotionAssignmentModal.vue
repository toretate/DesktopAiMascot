<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import AppModalShell from '../../common/AppModalShell.vue';
import { useConfigStore } from '../../../store/config';
import { resolveMascotImageUrl } from '../../../utils/mascot-image-url';

const configStore = useConfigStore();

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
    assets: {
        expressions: MascotAsset[];
    };
}

const props = defineProps<{
    visible: boolean;
    scannedSprites: { id: string; name: string; path: string }[];
    editingMascot: MascotData;
    activeOutfit?: MascotAsset | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'update:scannedSprites', sprites: { id: string; name: string; path: string }[]): void;
    (e: 'live-update'): void;
}>();

const currentExpressions = computed(() => {
    return props.activeOutfit?.expressions || props.editingMascot.assets?.expressions || [];
});

const localSelectedSprite = ref<{ id: string; name: string; path: string } | null>(null);

const selectScannedSprite = (sprite: any) => {
    if (localSelectedSprite.value?.id === sprite.id) {
        localSelectedSprite.value = null;
    } else {
        localSelectedSprite.value = sprite;
    }
};

const assignSpriteToSlot = (slot: MascotAsset) => {
    if (!localSelectedSprite.value) return;
    
    // スロットのパスにスプライト画像を割り当て
    slot.path = localSelectedSprite.value.path;
    
    // トレイから除外
    const updatedSprites = props.scannedSprites.filter(s => s.id !== localSelectedSprite.value!.id);
    emit('update:scannedSprites', updatedSprites);
    
    localSelectedSprite.value = null;
    emit('live-update');
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
    
    const sprite = props.scannedSprites.find(s => s.id === spriteId);
    if (sprite) {
        slot.path = sprite.path;
        const updatedSprites = props.scannedSprites.filter(s => s.id !== spriteId);
        emit('update:scannedSprites', updatedSprites);
        emit('live-update');
    }
};
</script>

<template>
    <AppModalShell
        :visible="visible"
        title-id="emotion-assignment-modal-title"
        backdrop="light"
        :z-index="2000"
        width="90vw"
        max-width="960px"
        height="90vh"
        max-height="680px"
        padding="10px 20px 16px"
        @close="emit('close')"
    >
        <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
            <h2 id="emotion-assignment-modal-title" class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-sparkles text-brand-500"></i>
                    <span>AI表情スプライト - 感情割り当て設定</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <div class="modal-body-container flex flex-column gap-3 mt-3 overflow-hidden flex-1" style="min-height: 0;">
                <!-- 上部: 検出スプライトトレイ (明るいラベンダー色・薄い影) -->
                <div class="scanned-sprites-section p-3 bg-brand-50 border-round border-1 border-brand-100 flex flex-column gap-2" style="max-height: 160px; min-height: 140px; flex-shrink: 0;">
                    <div class="flex justify-content-between align-items-center mb-1">
                        <span class="text-xs font-bold text-brand-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-palette"></i>
                            <span>検出された表情パーツ（スロットをクリック、またはドラッグして感情をマッピングしてください）</span>
                        </span>
                        <span class="text-xxs text-brand-500 font-mono font-bold">残り {{ scannedSprites.length }} 個の表情スプライト</span>
                    </div>
                    <div class="flex gap-3 overflow-x-auto pb-2 scanned-sprites-tray">
                        <div 
                            v-for="sprite in scannedSprites" 
                            :key="sprite.id"
                            class="scanned-sprite-item flex flex-column align-items-center gap-1 p-2 border-round border-1 cursor-pointer transition-all drag-item"
                            :class="{ 'active': localSelectedSprite?.id === sprite.id }"
                            draggable="true"
                            @dragstart="onSpriteDragStart($event, sprite)"
                            @click="selectScannedSprite(sprite)"
                        >
                            <img :src="resolveImageUrl(sprite.path)" class="sprite-preview object-contain border-round bg-slate-200" style="width: 54px; height: 54px;" />
                            <span class="text-xxs font-bold text-slate-600 text-ellipsis overflow-hidden w-full text-center">{{ sprite.name }}</span>
                        </div>
                        <div v-if="scannedSprites.length === 0" class="flex-1 flex align-items-center justify-content-center text-xs text-brand-600 font-semibold select-none">
                            全てのスプライトをスロットに割り当て完了しました！
                        </div>
                    </div>
                </div>

                <!-- 下部: 28感情スロットの割り当てグリッド (白基調スクロール) -->
                <div class="flex-1 overflow-y-auto pr-1">
                    <div class="grid-modal-slots flex flex-wrap gap-2 justify-content-start">
                        <div 
                            v-for="slot in currentExpressions" 
                            :key="slot.id"
                            class="assignment-slot-card border-round p-2 border-1 cursor-pointer transition-all flex align-items-center gap-2 bg-slate-50 border-gray-200"
                            :class="{
                                'has-image': slot.path,
                                'target-active': localSelectedSprite,
                                'hover-assign': localSelectedSprite && !slot.path
                            }"
                            @click="assignSpriteToSlot(slot)"
                            @dragover.prevent
                            @drop="onSpriteDrop($event, slot)"
                            style="width: calc(25% - 6px); min-width: 170px;"
                        >
                            <div class="slot-thumbnail flex align-items-center justify-content-center border-round overflow-hidden bg-slate-100" style="width: 44px; height: 44px; flex-shrink: 0;">
                                <img v-if="slot.path" :src="resolveImageUrl(slot.path)" class="thumbnail-img object-contain w-full h-full" />
                                <i v-else class="pi pi-image text-slate-400 text-sm"></i>
                            </div>
                            <div class="flex flex-column flex-1 overflow-hidden">
                                <span class="text-xs font-bold text-slate-800 text-ellipsis overflow-hidden">{{ slot.name }}</span>
                                <span class="text-xxs font-bold select-none" :class="slot.path ? 'text-green-600' : 'text-slate-400'">
                                    {{ slot.path ? '割り当て済み' : '未設定' }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        <div class="modal-footer flex justify-content-end gap-2 pt-3 border-top border-gray-200 mt-3">
            <Button label="割り当てを完了する" icon="pi pi-check" class="p-button-primary px-4 p-button-sm" @click="emit('close')" />
        </div>
    </AppModalShell>
</template>

<style scoped>
/* 白基調の感情割り当てモーダル用CSS */
.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}
.border-top {
    border-top: 1px solid #e2e8f0 !important;
}

.scanned-sprites-section {
    border: 1px solid var(--color-primary-alpha-20);
    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);
}

.scanned-sprites-tray {
    display: flex;
    gap: 12px;
    overflow-x: auto !important;
    white-space: nowrap;
    padding-bottom: 8px;
    scrollbar-width: thin;
    scrollbar-color: var(--color-primary-alpha-30) transparent;
}
.scanned-sprites-tray::-webkit-scrollbar {
    height: 6px;
}
.scanned-sprites-tray::-webkit-scrollbar-thumb {
    background: var(--color-primary-alpha-30);
    border-radius: 3px;
}

.scanned-sprite-item {
    min-width: 76px;
    height: 82px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    transition: all 0.15s ease;
}
.scanned-sprite-item:hover {
    background: #f8fafc;
    border-color: var(--color-primary-alpha-30);
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.scanned-sprite-item.active {
    background: var(--color-primary-subtle) !important;
    border-color: var(--color-primary) !important;
    box-shadow: 0 0 10px var(--color-primary-alpha-15);
}

/* 感情スロット割り当てカード (ライトモード) */
.assignment-slot-card {
    background: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    transition: all 0.2s ease;
}
.assignment-slot-card:hover {
    background: #f8fafc !important;
    border-color: #cbd5e1 !important;
}
.assignment-slot-card.has-image {
    background: #f0fdf4 !important; /* 薄い緑背景 */
    border-color: #bbf7d0 !important;
}
.assignment-slot-card.has-image:hover {
    background: #dcfce7 !important;
    border-color: #86efac !important;
}
.assignment-slot-card.hover-assign {
    border-style: dashed !important;
    border-color: var(--color-primary) !important;
    animation: pulseBorder 1.5s infinite;
}

@keyframes pulseBorder {
    0% { border-color: var(--color-primary-alpha-30); }
    50% { border-color: var(--color-primary-alpha-80); }
    100% { border-color: var(--color-primary-alpha-30); }
}

.slot-thumbnail {
    border: 1px solid #e2e8f0;
}
.thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
</style>
