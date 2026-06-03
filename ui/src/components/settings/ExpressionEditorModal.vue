<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useConfigStore } from '../../store/config';
import Button from 'primevue/button';
import Slider from 'primevue/slider';

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
    if (!path) return '';
    if (path.startsWith('data:image/')) {
        return path;
    }
    let resolved = path;
    if (path.startsWith('/mascots/') && configStore.useServer) {
        resolved = `http://${configStore.serverHost}:${configStore.serverPort}${path}`;
    }
    if (/^[a-zA-Z]:\\/.test(resolved)) {
        return resolved;
    }
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}v=${configStore.configVersion}`;
};

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    originalPath?: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    expressions?: MascotAsset[];
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
    defaultExpressionId?: string;
    assets: {
        expressions: MascotAsset[];
    };
}

const props = defineProps<{
    visible: boolean;
    editingMascot: MascotData;
    activeOutfit: MascotAsset | null;
    activePose: MascotAsset | null;
    defaultFrontAvatar: MascotAsset | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'live-update'): void;
    (e: 'clear-expression', slot: MascotAsset): void;
    (e: 'crop-current', slot: MascotAsset): void;
    (e: 'crop-new', slot?: MascotAsset): void;
}>();

const currentExpressions = computed(() => {
    return props.activeOutfit?.expressions || props.editingMascot.assets?.expressions || [];
});

const selectedModalExpression = ref<MascotAsset | null>(null);

// visible が true になった時やマスコットデータが渡された時に、表情初期選択を確実に実行する
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            const expressions = currentExpressions.value;
            if (expressions && expressions.length > 0) {
                selectedModalExpression.value = expressions.find((e: any) => e.name === '通常') || expressions[0] || null;
            } else {
                selectedModalExpression.value = null;
            }
        }
    },
    { immediate: true }
);

// editingMascot 自体が外部から切り替えられた場合もリアクティブに表情の選択を解決する
watch(
    () => props.editingMascot,
    (newMascot) => {
        if (props.visible) {
            const expressions = currentExpressions.value;
            if (expressions && expressions.length > 0) {
                selectedModalExpression.value = expressions.find((e: any) => e.name === '通常') || expressions[0] || null;
            }
        }
    }
);

const selectExpression = (slot: MascotAsset) => {
    selectedModalExpression.value = slot;
};

const handleLiveUpdate = () => {
    emit('live-update');
};

const toggleDefaultExpression = (checked: boolean) => {
    if (selectedModalExpression.value) {
        if (checked) {
            props.editingMascot.defaultExpressionId = selectedModalExpression.value.id;
        } else {
            props.editingMascot.defaultExpressionId = '';
        }
        handleLiveUpdate();
    }
};

const clearExpression = () => {
    if (selectedModalExpression.value) {
        emit('clear-expression', selectedModalExpression.value);
    }
};

const adjustScale = (delta: number) => {
    if (selectedModalExpression.value) {
        const current = selectedModalExpression.value.scale ?? 1.0;
        let next = Math.round((current + delta) * 100) / 100;
        next = Math.max(0.3, Math.min(2.0, next));
        selectedModalExpression.value.scale = next;
        handleLiveUpdate();
    }
};
</script>

<template>
    <div v-if="visible" class="custom-modal-overlay expression-edit-modal-overlay">
        <div class="custom-modal-card expression-edit-modal-card">
            <!-- スリム化されたヘッダー (縦幅約半分) -->
            <div class="modal-header flex justify-content-between align-items-center pb-2 pt-0 border-bottom border-gray-200">
                <h2 class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-sliders-h text-purple-500 text-sm"></i>
                    <span>表情エディタ & 位置調整 (SillyTavern 28感情互換)</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <div class="modal-body-container flex gap-4 mt-2 overflow-hidden flex-1" style="min-height: 0;">
                <!-- 左カラム: 表情スロット縦スリムリスト (幅240px、ラベルなし) -->
                <div class="flex flex-column" style="width: 240px; min-width: 240px; height: 570px; overflow: hidden !important;">
                    <div class="pr-1 expression-vertical-list">
                        <div 
                            v-for="slot in currentExpressions" 
                            :key="slot.id"
                            class="expression-vertical-item flex align-items-center gap-2 p-2 border-round cursor-pointer transition-all border-1"
                            :class="{
                                'active': selectedModalExpression?.id === slot.id,
                                'has-image': slot.path,
                                'empty': !slot.path
                            }"
                            @click="selectExpression(slot)"
                        >
                            <div class="slot-thumbnail flex align-items-center justify-content-center border-round overflow-hidden bg-slate-100">
                                <img v-if="slot.path && isImage(slot.path)" :src="resolveImageUrl(slot.path)" class="thumbnail-img" />
                                <i v-else class="pi pi-image text-slate-400 text-xs"></i>
                            </div>
                            <div class="flex flex-column flex-1 overflow-hidden">
                                <span class="text-xs font-bold text-slate-700 text-ellipsis overflow-hidden">{{ slot.name }}</span>
                                <span class="text-xxs text-slate-400 font-medium select-none">
                                    {{ slot.path ? '画像登録済み' : '未登録 (D&D可)' }}
                                </span>
                            </div>
                            <div v-if="editingMascot.defaultExpressionId === slot.id" class="default-badge" title="標準表情">
                                <i class="pi pi-star-fill text-yellow-500 text-xs"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 右カラム: 大型マスコットプレビュー & 位置調整コントロール (ラベルなし) -->
                <div v-if="selectedModalExpression" class="flex-1 flex flex-column gap-2 overflow-hidden">
                    <!-- プレビューと縦スライダーのコンテナ -->
                    <div class="flex-1 flex gap-3 align-items-center justify-content-center overflow-hidden">
                        <!-- プレビューカード (白飛びを防ぐための高級感のある市松模様背景) -->
                        <div class="flex-1 border-1 border-gray-200 border-round checkerboard-bg flex align-items-center justify-content-center relative overflow-hidden" style="height: 570px;">
                            <div class="mascot-composite-preview large-preview relative flex align-items-center justify-content-center" style="width: 420px; height: 560px;">
                                <!-- ポーズ/服装ベースアバター（画像アセット優先解決） -->
                                <template v-if="activePose && isImage(activePose.path)">
                                    <img :src="resolveImageUrl(activePose.path)" class="preview-full-img w-full h-full object-contain" />
                                </template>
                                <template v-else-if="activeOutfit && isImage(activeOutfit.path)">
                                    <img :src="resolveImageUrl(activeOutfit.path)" class="preview-full-img w-full h-full object-contain" />
                                </template>
                                <template v-else-if="defaultFrontAvatar && isImage(defaultFrontAvatar.path)">
                                    <img :src="resolveImageUrl(defaultFrontAvatar.path)" class="preview-full-img w-full h-full object-contain" />
                                </template>
                                <template v-else-if="editingMascot && editingMascot.avatar && isImage(editingMascot.avatar)">
                                    <img :src="resolveImageUrl(editingMascot.avatar)" class="preview-full-img w-full h-full object-contain" />
                                </template>
                                <template v-else-if="activePose && activePose.path">
                                    <span class="preview-base-avatar font-bold text-6xl text-slate-400 select-none">{{ activePose.path }}</span>
                                </template>
                                <template v-else-if="activeOutfit && activeOutfit.path">
                                    <span class="preview-base-avatar font-bold text-6xl text-slate-400 select-none">{{ activeOutfit.path }}</span>
                                </template>
                                <template v-else-if="editingMascot">
                                    <span class="preview-base-avatar font-bold text-6xl text-slate-400 select-none">{{ editingMascot.avatar || '🤖' }}</span>
                                </template>
                                <span v-else class="preview-base-avatar font-bold text-6xl text-slate-400 select-none">🤖</span>

                                <!-- 表情重ね合わせ (offsetX, offsetY, scale 補正) -->
                                <template v-if="selectedModalExpression.path">
                                    <img 
                                        v-if="isImage(selectedModalExpression.path)" 
                                        :src="resolveImageUrl(selectedModalExpression.path)" 
                                        class="preview-layer-img expression absolute"
                                        :style="{
                                            width: '140px',
                                            height: '140px',
                                            objectFit: 'contain',
                                            transform: `translate(${selectedModalExpression.offsetX || 0}px, ${(selectedModalExpression.offsetY || 0)}px) scale(${selectedModalExpression.scale || 1.0})`
                                        }"
                                    />
                                    <span 
                                        v-else 
                                        class="preview-layer expression absolute font-bold text-4xl"
                                        :style="{
                                            transform: `translate(${selectedModalExpression.offsetX || 0}px, ${(selectedModalExpression.offsetY || 0)}px) scale(${selectedModalExpression.scale || 1.0})`
                                        }"
                                    >{{ selectedModalExpression.path }}</span>
                                </template>
                            </div>
                        </div>

                        <!-- 縦スライダー (Y方向オフセット) -->
                        <div class="flex flex-column align-items-center gap-2" style="width: 40px;">
                            <span class="text-xxs text-slate-500 select-none font-bold">上 (Y-)</span>
                            <div class="vertical-slider-wrapper flex justify-content-center py-2" style="height: 450px;">
                                <Slider 
                                    v-model="selectedModalExpression.offsetY" 
                                    :min="-250" 
                                    :max="250" 
                                    :step="1" 
                                    orientation="vertical"
                                    class="h-full vertical-slider"
                                    @change="handleLiveUpdate"
                                />
                            </div>
                            <span class="text-xxs text-slate-500 select-none font-bold">下 (Y+)</span>
                        </div>
                    </div>

                    <!-- 下部コントロール: 横スライダー, 拡大率, ボタン類 (白基調) -->
                    <div class="bg-slate-50 border-round p-3 border-1 border-gray-200 flex flex-column gap-3">
                        <div class="grid flex gap-3 align-items-center">
                            <!-- 横スライダー (X方向オフセット) -->
                            <div class="flex-1 flex flex-column gap-1">
                                <div class="flex justify-content-between align-items-center">
                                    <label class="text-xs font-semibold text-slate-700 select-none">横位置調整 (X)</label>
                                    <span class="text-xxs text-purple-600 font-mono font-bold">{{ selectedModalExpression.offsetX || 0 }}px</span>
                                </div>
                                <Slider v-model="selectedModalExpression.offsetX" :min="-250" :max="250" :step="1" @change="handleLiveUpdate" />
                            </div>

                            <!-- 拡大率スライダー (Scale) -->
                            <div class="flex-1 flex flex-column gap-1">
                                <div class="flex justify-content-between align-items-center">
                                    <label class="text-xs font-semibold text-slate-700 select-none">拡大率 / スケール (S)</label>
                                    <div class="flex align-items-center gap-1 bg-purple-50 border-round px-2 py-0.5 border-1 border-purple-200 select-none">
                                        <span class="text-xxs text-purple-600 font-mono font-bold">{{ (selectedModalExpression.scale || 1.0).toFixed(2) }}倍</span>
                                        <div class="flex flex-column gap-0" style="line-height: 0.8;">
                                            <i 
                                                class="pi pi-chevron-up text-purple-400 hover:text-purple-600 cursor-pointer" 
                                                style="font-size: 8px; padding: 1px;" 
                                                @click="adjustScale(0.01)"
                                                title="拡大率を0.01増やす"
                                            ></i>
                                            <i 
                                                class="pi pi-chevron-down text-purple-400 hover:text-purple-600 cursor-pointer" 
                                                style="font-size: 8px; padding: 1px;" 
                                                @click="adjustScale(-0.01)"
                                                title="拡大率を0.01減らす"
                                            ></i>
                                        </div>
                                    </div>
                                </div>
                                <Slider v-model="selectedModalExpression.scale" :min="0.3" :max="2.0" :step="0.05" @change="handleLiveUpdate" />
                            </div>
                        </div>

                        <!-- ボタン類 & 標準設定 -->
                        <div class="flex justify-content-between align-items-center pt-2 border-top border-gray-200">
                            <!-- 標準表情チェックボックス -->
                            <div v-if="selectedModalExpression.path" class="flex align-items-center gap-2">
                                <input 
                                    id="default-expr-checkbox"
                                    type="checkbox" 
                                    :checked="editingMascot.defaultExpressionId === selectedModalExpression.id"
                                    @change="toggleDefaultExpression(($event.target as HTMLInputElement).checked)"
                                    class="cursor-pointer"
                                />
                                <label for="default-expr-checkbox" class="text-xs text-slate-700 font-bold cursor-pointer select-none flex align-items-center gap-1">
                                    <i class="pi pi-star-fill text-yellow-500"></i>
                                    <span>この表情をマスコットの標準（通常表示）にする</span>
                                </label>
                            </div>
                            <div v-else class="text-xs text-slate-400 font-semibold select-none">
                                ※画像を登録またはクロップすると各種パラメータの調整が行えます。
                            </div>

                            <!-- アクションボタン (ライトモード調) -->
                            <div class="flex gap-2">
                                <Button 
                                    label="リセット" 
                                    icon="pi pi-refresh" 
                                    class="p-button-outlined p-button-secondary p-button-sm" 
                                    @click="selectedModalExpression.offsetX = 0; selectedModalExpression.offsetY = 0; selectedModalExpression.scale = 1.0; handleLiveUpdate()" 
                                />
                                <Button 
                                    v-if="selectedModalExpression.path"
                                    label="表情解除" 
                                    icon="pi pi-trash" 
                                    class="p-button-outlined p-button-danger p-button-sm" 
                                    @click="clearExpression" 
                                />
                                <Button 
                                    v-if="selectedModalExpression.path && isImage(selectedModalExpression.path)"
                                    label="切り抜き直す" 
                                    icon="pi pi-scissors" 
                                    class="p-button-outlined p-button-info p-button-sm" 
                                    @click="emit('crop-current', selectedModalExpression)" 
                                />
                                <Button 
                                    label="画像から切り出し" 
                                    icon="pi pi-file-import" 
                                    class="p-button-outlined p-button-success p-button-sm" 
                                    @click="emit('crop-new', selectedModalExpression)" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-footer flex justify-content-end gap-2 pt-3 border-top border-gray-200 mt-3 no-drag">
                <Button label="エディタを閉じる" icon="pi pi-check" class="p-button-primary px-4 p-button-sm" @click="emit('close')" />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 白基調の表情編集モーダル用CSS */
.expression-edit-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(241, 245, 249, 0.8) !important; /* ライトグレー半透明 */
    backdrop-filter: blur(12px) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.expression-edit-modal-card {
    background: #ffffff !important; /* 純白 */
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    width: 90vw !important;
    max-width: 1040px !important;
    height: 90vh !important;
    max-height: 780px !important;
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
.border-top {
    border-top: 1px solid #e2e8f0 !important;
}

/* 縦スリムリスト (高さを512pxに固定し、スクロールバーを紫に) */
.expression-vertical-list {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    height: 560px !important;
    max-height: 560px !important;
    overflow-y: auto !important;
    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 247, 0.4) transparent;
}
.expression-vertical-list::-webkit-scrollbar {
    width: 6px;
}
.expression-vertical-list::-webkit-scrollbar-thumb {
    background: rgba(168, 85, 247, 0.4);
    border-radius: 3px;
}
.expression-vertical-list::-webkit-scrollbar-thumb:hover {
    background: rgba(168, 85, 247, 0.7);
}

.expression-vertical-item {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    position: relative;
}
.expression-vertical-item:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
}
.expression-vertical-item.active {
    background: #f5f3ff !important; /* 薄い紫背景 */
    border-color: #a855f7 !important;
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.15);
}
.expression-vertical-item.empty {
    border-style: dashed;
    opacity: 0.7;
}
.expression-vertical-item.empty:hover {
    opacity: 1.0;
}

.slot-thumbnail {
    width: 38px;
    height: 38px;
    border: 1px solid #e2e8f0;
}
.thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.default-badge {
    position: absolute;
    top: 4px;
    right: 4px;
}

.text-xxs {
    font-size: 10px;
}

/* 透過アセット白飛び防止のためのプレミアムな市松模様背景 */
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

.vertical-slider-wrapper {
    display: flex;
    align-items: center;
}
.vertical-slider {
    height: 100% !important;
}

.mascot-composite-preview {
    position: relative;
    width: 420px;
    height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.preview-full-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    z-index: 1;
}
.preview-base-avatar {
    position: absolute;
    z-index: 1;
}
.preview-layer-img {
    position: absolute;
    object-fit: contain;
    pointer-events: none;
    z-index: 10;
}
.preview-layer {
    position: absolute;
    z-index: 10;
}
</style>
