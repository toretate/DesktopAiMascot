<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import mascotEmotionIcon from '../../assets/mascot_emotion_icon.png';
import mascotOutfitIcon from '../../assets/mascot_outfilt_icon.png';
import mascotProfileIcon from '../../assets/mascot_profile_icon.png';
import Button from 'primevue/button';
import { useConfigStore } from '../../store/config';
import { useMascotSettings } from './composables/useMascotSettings';

// 新規切り出しモーダルのインポート
import MascotVerticalList from './components/MascotVerticalList.vue';
import MascotProfileSettings from './mascot/MascotProfileSettings.vue';
import MascotOutfitSettngs from './mascot/MascotOutfitSettngs.vue';
import ExpressionEditorModal from './mascot/ExpressionEditorModal.vue';
import EmotionAssignmentModal from './mascot/EmotionAssignmentModal.vue';
import ImageCropModal from './mascot/ImageCropModal.vue';
import AiExpressionGeneratorModal from './mascot/AiExpressionGeneratorModal.vue';
import BackgroundRemovalModal from './mascot/BackgroundRemovalModal.vue';
import PromptEditorModal from './mascot/PromptEditorModal.vue';
import SpriteImportModal from './mascot/SpriteImportModal.vue';
import MascotEmotionGrid from './components/MascotEmotionGrid.vue';


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
        chat: { engine: string; model: string; temperature: number; };
        voice: { engine?: string; speaker_id?: number; style?: string; irodori_voice?: string; irodori_model?: string; };
    };
    assets: { outfits: MascotAsset[]; expressions: MascotAsset[]; poses: MascotAsset[]; };
}

const props = defineProps<{
    mascots: MascotData[];
    activeMascotId: string;
    geminiApiKey: string;
}>();

const emit = defineEmits<{
    (e: 'update:activeMascotId', id: string): void;
    (e: 'live-update'): void;
    (e: 'save-settings'): void;
    (e: 'add-mascot'): void;
    (e: 'delete-mascot', id: string): void;
}>();

const configStore = useConfigStore();

const {
    activeMascotSubTab,
    showDetailOnMobile,
    mascotPrompts,
    editingMascot,
    activeOutfit,
    activePose,
    activeExpression,
    currentExpressions,
    defaultFrontAvatar,
    activePreviewExpression,
    computedListPreviewExpressionStyle,
    isBatchAligningV2,
    batchAlignV2Progress,
    isImage,
    resolveImageUrl,
    ensure28Expressions,
    loadMascotPrompts,
    updateMascotPreview,
    selectExpressionForPreview,
    selectMascot,
    initEditingMascot,
    syncAndSave,
    setDefaultExpression,
    handleBatchAlignV2,
    isScanningSprite,
    scannedSprites,
    isAssigningEmotionsModal,
    importFromSpriteSheet,
    closeAssigningEmotionsModal
} = useMascotSettings(props, emit);

// モーダル管理用の状態
const isEditingExpressionsModal = ref(false);
const isCropModalActive = ref(false);
const isAiGeneratingModalActive = ref(false);
const isBackgroundRemovalModalActive = ref(false);
const isSpriteImportModalActive = ref(false);
const isPromptModalActive = ref(false);
const backgroundRemovalTargetOutfitId = ref<string | null>(null);

// --- 立ち絵アセット（全身像）操作関数群 ---
const addOutfitImage = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        if (!editingMascot.value.assets.outfits) {
            editingMascot.value.assets.outfits = [];
        }
        
        const newOutfit: MascotAsset & { expressions?: MascotAsset[] } = {
            id: 'outfit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: '衣装_' + (editingMascot.value.assets.outfits.length + 1),
            path: result.path,
            offsetX: 0,
            offsetY: 0,
            scale: 1.0,
            expressions: []
        };
        
        editingMascot.value.assets.outfits.push(newOutfit);
        
        if (editingMascot.value.assets.outfits.length === 1 || !editingMascot.value.currentOutfitId) {
            editingMascot.value.currentOutfitId = newOutfit.id;
            updateMascotPreview({ outfitId: newOutfit.id });
        }
        
        await syncAndSave();
        emit('save-settings');
    }
};

const setMainOutfit = (outfit: MascotAsset) => {
    editingMascot.value.currentOutfitId = outfit.id;
    
    if (activePreviewExpression.value) {
        const newExpr = outfit.expressions?.find(e => e.name === activePreviewExpression.value?.name);
        if (newExpr) {
            activePreviewExpression.value = newExpr;
        }
    }

    updateMascotPreview({ 
        outfitId: outfit.id,
        poseId: '' 
    });

    syncAndSave();
    emit('save-settings');
};

const deleteOutfit = (outfit: MascotAsset) => {
    if (confirm(`立ち絵アセットを削除しますか？`)) {
        editingMascot.value.assets.outfits = editingMascot.value.assets.outfits.filter(o => o.id !== outfit.id);
        if (editingMascot.value.currentOutfitId === outfit.id) {
            const nextOutfit = editingMascot.value.assets.outfits[0];
            const nextOutfitId = nextOutfit?.id || '';
            editingMascot.value.currentOutfitId = nextOutfitId;
            
            if (nextOutfit) {
                const newExpr = nextOutfit.expressions?.find(e => e.name === activePreviewExpression.value?.name);
                if (newExpr) activePreviewExpression.value = newExpr;
            }
            updateMascotPreview({ outfitId: nextOutfitId });
        }
        syncAndSave();
        emit('save-settings');
    }
};

const backgroundRemovalTargetOutfitPath = computed(() => {
    if (!backgroundRemovalTargetOutfitId.value) return '';
    const outfit = editingMascot.value.assets.outfits.find(o => o.id === backgroundRemovalTargetOutfitId.value);
    return outfit?.path || '';
});

const openBackgroundRemovalModal = (outfit: MascotAsset) => {
    backgroundRemovalTargetOutfitId.value = outfit.id;
    isBackgroundRemovalModalActive.value = true;
};

const handleBackgroundRemovalDone = async (newBase64: string) => {
    if (backgroundRemovalTargetOutfitId.value) {
        const targetOutfit = editingMascot.value.assets.outfits.find(o => o.id === backgroundRemovalTargetOutfitId.value);
        if (targetOutfit) {
            targetOutfit.path = newBase64;
            const idx = configStore.mascots.findIndex(m => m.id === editingMascot.value.id);
            if (idx !== -1) {
                configStore.mascots.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
                emit('save-settings');
            }
        }
    }
    isBackgroundRemovalModalActive.value = false;
    backgroundRemovalTargetOutfitId.value = null;
};

const cropImageSrc = ref('');
const selectedCropExpression = ref<MascotAsset | null>(null);

const openExpressionEditModal = () => { isEditingExpressionsModal.value = true; };

const closeExpressionEditModal = async () => {
    isEditingExpressionsModal.value = false;
    const currentMascotExpressions = activeOutfit.value?.expressions || editingMascot.value.assets.expressions || [];
    activeExpression.value = currentMascotExpressions.find((e: any) => e.name === '通常') || currentMascotExpressions[0] || null;
    
    const idx = configStore.mascots.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        configStore.mascots[idx] = JSON.parse(JSON.stringify(editingMascot.value));
        emit('save-settings');
    }
};

const handleClearExpression = (slot: MascotAsset) => {
    if (confirm(`表情ラベル「${slot.name}」の画像を登録解除しますか？`)) {
        slot.path = '';
        if (editingMascot.value.defaultExpressionId === slot.id) {
            editingMascot.value.defaultExpressionId = '';
        }
        syncAndSave();
    }
};

const handleCropCurrent = (slot: MascotAsset) => {
    if (slot.path) {
        selectedCropExpression.value = slot;
        cropImageSrc.value = slot.path;
        isCropModalActive.value = true;
    }
};

const handleCropNew = async (slot?: MascotAsset) => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        if (slot) selectedCropExpression.value = slot;
        cropImageSrc.value = result.path;
        isCropModalActive.value = true;
    }
};

const handleCropDone = async (croppedBase64: string) => {
    const currentMascotExpressions = activeOutfit.value?.expressions || editingMascot.value.assets.expressions || [];
    const targetSlot = selectedCropExpression.value || currentMascotExpressions.find((e: any) => e.name === '通常') || currentMascotExpressions[0];
    if (targetSlot) {
        let finalPath = croppedBase64;
        let finalOriginalPath = cropImageSrc.value;
        if (window.electronAPI?.saveMascotImage && editingMascot.value?.id) {
            try {
                const sanitizedLabel = targetSlot.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_');
                const outfitName = activeOutfit.value?.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_') || 'default';

                if (cropImageSrc.value.startsWith('data:image/')) {
                    try {
                        const originalFilename = `expressions/${outfitName}/original/orig_expr_${sanitizedLabel}.png`;
                        const saveOriginalResult = await window.electronAPI.saveMascotImage(editingMascot.value.id, originalFilename, cropImageSrc.value);
                        if (saveOriginalResult.success && saveOriginalResult.path) finalOriginalPath = saveOriginalResult.path;
                    } catch (originalErr) { console.warn('[MascotSettings] 元画像の保存に失敗しました:', originalErr); }
                }

                if (croppedBase64.startsWith('data:image/')) {
                    const filename = `expressions/${outfitName}/expr_${sanitizedLabel}.png`;
                    const saveResult = await window.electronAPI.saveMascotImage(editingMascot.value.id, filename, croppedBase64);
                    if (saveResult.success && saveResult.path) finalPath = saveResult.path;
                }
            } catch (err) { console.warn('[MascotSettings] 切り抜き画像の保存に失敗しました:', err); }
        }
        targetSlot.path = finalPath;
        targetSlot.originalPath = finalOriginalPath;
    }
    
    isCropModalActive.value = false;
    selectedCropExpression.value = null;
    await syncAndSave();
    emit('save-settings');
    updateMascotPreview();
};

const registeredExpressions = computed(() => {
    if (!editingMascot.value) return [];
    const expressions = activeOutfit.value?.expressions || editingMascot.value.assets?.expressions || [];
    return expressions.filter((e: any) => e.path) || [];
});

// 設定画面読み込み時およびアクティブマスコット変更時に初期化を行う
initEditingMascot();
watch(() => props.activeMascotId, () => {
    initEditingMascot();
});
watch(() => props.mascots, () => {
    initEditingMascot();
}, { deep: true });
</script>

<template>
    <div class="mascot-settings-container" :class="{ 'show-detail-mobile': showDetailOnMobile }">
        <!-- 左側: マスコットリスト -->
        <MascotVerticalList
            :mascots="mascots"
            :active-mascot-id="activeMascotId"
            :active-pose="activePose"
            :active-outfit="activeOutfit"
            :default-front-avatar="defaultFrontAvatar"
            :active-preview-expression="activePreviewExpression"
            :computed-list-preview-expression-style="computedListPreviewExpressionStyle"
            @select-mascot="selectMascot"
            @delete-mascot="(id) => emit('delete-mascot', id)"
            @add-mascot="emit('add-mascot')"
        />

        <!-- 右側: マスコットアセット・詳細調整 (白基調) -->
        <div class="mascot-detail-panel">
            <!-- モバイル用戻るボタン -->
            <div class="mobile-back-header">
                <Button 
                    label="マスコット一覧に戻る" 
                    icon="pi pi-arrow-left" 
                    class="p-button-outlined p-button-secondary p-button-sm mb-3 w-full"
                    @click="showDetailOnMobile = false"
                />
            </div>
            <div class="flex justify-content-between align-items-center">
                <h3 class="m-0 text-gray-800 font-bold flex align-items-center gap-2">
                    <i class="pi pi-cog text-purple-400"></i>
                    <span>マスコット詳細設定</span>
                </h3>
            </div>

            <!-- サブタブ -->
            <div class="flex border-bottom border-gray-200 pb-2 gap-2">
                <Button 
                    class="p-button-sm flex align-items-center justify-content-center"
                    :class="activeMascotSubTab === 'expression' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                    @click="activeMascotSubTab = 'expression'"
                    title="表情"
                >
                    <img :src="mascotEmotionIcon" class="subtab-icon" style="margin-right: 4px; object-fit: contain; border-radius: 2px;" />
                    <span class="subtab-label">表情</span>
                </Button>
                <Button 
                    class="p-button-sm flex align-items-center justify-content-center"
                    :class="activeMascotSubTab === 'outfit' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                    @click="activeMascotSubTab = 'outfit'"
                    title="立ち絵"
                >
                    <img :src="mascotOutfitIcon" class="subtab-icon" style="margin-right: 4px; object-fit: contain; border-radius: 2px;" />
                    <span class="subtab-label">立ち絵</span>
                </Button>
                <Button 
                    class="p-button-sm flex align-items-center justify-content-center"
                    :class="activeMascotSubTab === 'profile' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                    @click="activeMascotSubTab = 'profile'"
                    title="プロフィール"
                >
                    <img :src="mascotProfileIcon" class="subtab-icon" style="margin-right: 4px; object-fit: contain; border-radius: 2px;" />
                    <span class="subtab-label">プロフィール</span>
                </Button>
            </div>

            <!-- サブタブ中身エリア (スクロール可能) -->
            <div class="detail-tab-content">
                <!-- サブタブ中身: 表情アセット -->
                <div v-if="activeMascotSubTab === 'expression'" class="flex flex-column gap-3">
                    <div class="flex gap-2">
                        <Button 
                            icon="pi pi-sliders-h" 
                            class="p-button-primary p-button-sm flex-1"
                            @click="openExpressionEditModal"
                        >
                            <span class="desktop-text">表情編集</span>
                            <span class="mobile-text">表情編集</span>
                        </Button>
                        <Button 
                            v-if="scannedSprites.length > 0"
                            label="感情割り当て画面を開く" 
                            icon="pi pi-sparkles" 
                            class="p-button-sm p-button-outlined p-button-info"
                            @click="isAssigningEmotionsModal = true"
                        />
                        <Button 
                            label="表情生成" 
                            icon="pi pi-sparkles" 
                            class="p-button-sm p-button-outlined p-button-primary"
                            @click="isAiGeneratingModalActive = true"
                        />
                        <Button
                            label="スプライトインポート"
                            icon="pi pi-sparkles"
                            class="p-button-sm p-button-outlined p-button-secondary"
                            :loading="isScanningSprite"
                            @click="isSpriteImportModalActive = true"
                        />
                    </div>
    
                    <!-- 一括 AI 位置合わせ v2 -->
                    <div class="flex align-items-center gap-2">
                        <Button
                            label="一括 AI 位置合わせ"
                            icon="pi pi-magic-wand"
                            class="p-button-sm p-button-success flex-1"
                            :loading="isBatchAligningV2"
                            :disabled="isBatchAligningV2"
                            @click="handleBatchAlignV2"
                        />
                        <span v-if="batchAlignV2Progress" class="text-xs" :class="batchAlignV2Progress.startsWith('エラー') ? 'text-red-500' : batchAlignV2Progress.includes('低信頼度') ? 'text-yellow-600' : 'text-green-600'">
                            {{ batchAlignV2Progress }}
                        </span>
                    </div>
    
                    <!-- 表情アセットグリッド -->
                    <div class="form-field p-3 bg-white border-round border-1 border-gray-200 mt-2 flex flex-column gap-2">
                        <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-images text-purple-500"></i>
                            <span>表情グリッド ({{ registeredExpressions.length }} / 28 登録済み)</span>
                        </label>
                        
                        <MascotEmotionGrid
                            :current-expressions="currentExpressions"
                            :editing-mascot="editingMascot"
                            :active-preview-expression="activePreviewExpression"
                            :resolve-image-url="resolveImageUrl"
                            :cols="4"
                            @select-expression="selectExpressionForPreview"
                            @set-default="setDefaultExpression"
                            @clear-expression="handleClearExpression"
                        />
                    </div>
                </div>
    
                <!-- サブタブ中身: 立ち絵（全身像） -->
                <MascotOutfitSettngs
                    v-else-if="activeMascotSubTab === 'outfit'"
                    :editing-mascot="editingMascot"
                    @add-outfit="addOutfitImage"
                    @delete-outfit="deleteOutfit"
                    @background-removal="openBackgroundRemovalModal"
                    @set-main-outfit="setMainOutfit"
                />
    
                <!-- サブタブ中身: プロフィール -->
                <MascotProfileSettings
                    v-else
                    :editing-mascot="editingMascot"
                    :mascot-prompts="mascotPrompts"
                    @change="() => { syncAndSave(); emit('save-settings'); }"
                    @open-prompt-modal="isPromptModalActive = true"
                />
            </div>
        </div>
    </div>

    <!-- 表情大画面エディタモーダル -->
    <ExpressionEditorModal 
        :visible="isEditingExpressionsModal"
        :editing-mascot="editingMascot"
        :active-outfit="activeOutfit"
        :active-pose="activePose"
        :default-front-avatar="defaultFrontAvatar"
        @close="closeExpressionEditModal"
        @live-update="syncAndSave"
        @clear-expression="handleClearExpression"
        @crop-current="handleCropCurrent"
        @crop-new="handleCropNew"
    />

    <!-- AI表情スプライト感情割り当てモーダル -->
    <EmotionAssignmentModal 
        :visible="isAssigningEmotionsModal"
        v-model:scanned-sprites="scannedSprites"
        :editing-mascot="editingMascot"
        :active-outfit="activeOutfit"
        @close="closeAssigningEmotionsModal"
        @live-update="syncAndSave"
    />

    <!-- 画像トリミング（クロップ）モーダル -->
    <ImageCropModal 
        :visible="isCropModalActive"
        :image-src="cropImageSrc"
        @close="isCropModalActive = false"
        @crop="handleCropDone"
    />

    <!-- AI表情スプライト自動生成モーダル -->
    <AiExpressionGeneratorModal 
        :visible="isAiGeneratingModalActive"
        :editing-mascot="editingMascot"
        :default-front-avatar="defaultFrontAvatar"
        :active-outfit="activeOutfit"
        :gemini-api-key="geminiApiKey"
        @close="isAiGeneratingModalActive = false"
        @import-sprite="importFromSpriteSheet"
    />

    <!-- 背景削除モーダル -->
    <BackgroundRemovalModal
        :visible="isBackgroundRemovalModalActive"
        :image-src="backgroundRemovalTargetOutfitPath"
        :mascot-id="editingMascot.id"
        @close="isBackgroundRemovalModalActive = false"
        @done="handleBackgroundRemovalDone"
    />

    <!-- プロンプト編集モーダル -->
    <PromptEditorModal
        :visible="isPromptModalActive"
        :mascot-id="editingMascot.id"
        @close="isPromptModalActive = false"
        @save-done="loadMascotPrompts"
    />

    <!-- AIスプライトインポートモーダル -->
    <SpriteImportModal
        :visible="isSpriteImportModalActive"
        @close="isSpriteImportModalActive = false"
        @import="importFromSpriteSheet"
    />
</template>

<style scoped>
.mascot-settings-container {
    display: flex !important;
    flex-direction: row !important;
    gap: 24px !important;
    width: 100% !important;
    height: 100% !important;
    align-items: stretch !important;
}


.mascot-detail-panel {
    flex: 1 !important;
    min-width: 0 !important; /* グリッドのはみ出しと巨大化を完璧に防止 */
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
    background: #f8fafc !important; /* bg-slate-50 と同等 */
    border: 1px solid #e2e8f0 !important;
    border-radius: 8px !important;
    padding: 16px !important;
    height: 100% !important;
    box-sizing: border-box !important;
}

.detail-tab-content {
    flex: 1 !important;
    overflow-y: auto !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
    padding-right: 4px !important;
}

.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}

/* マスコット選択アイテムのスタイル */
.mascot-list {
    scrollbar-width: thin;
}

.mascot-item {
    position: relative !important;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}
.mascot-item:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.mascot-delete-btn {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    z-index: 20 !important;
    opacity: 0;
    transition: opacity 0.2s ease;
    background: rgba(255, 255, 255, 0.9) !important;
    border-radius: 50% !important;
    width: 28px !important;
    height: 28px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 !important;
}
.mascot-item:hover .mascot-delete-btn {
    opacity: 1;
}
.mascot-item.active {
    border-color: #a855f7;
    background: #f5f3ff;
    box-shadow: 0 0 0 1px #a855f7, 0 4px 6px -1px rgba(168, 85, 247, 0.1);
}
.mascot-item .name {
    font-weight: bold;
    font-size: 14px;
    color: #1e293b;
}



/* 立ち絵全身像グリッドセル */
.outfit-grid-cell {
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
    border: 2px solid #a855f7 !important;
    background-color: #f5f3ff !important;
    box-shadow: 0 0 0 1px #a855f7, 0 4px 6px -1px rgba(168, 85, 247, 0.1) !important;
}

.outfit-grid-container {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 8px !important;
    max-height: 300px !important;
    overflow-y: auto !important;
    width: 100% !important;
}

.subtab-icon {
    width: 48px !important;
    height: 48px !important;
}

.mobile-text {
    display: none;
}

/* モバイル表示用の戻るボタンはデフォルト非表示 */
.mobile-back-header {
    display: none;
}

@media (max-width: 768px) {
    .mascot-settings-container {
        display: block !important;
    }

    /* 通常は一覧を表示し、詳細を非表示に */
    .mascot-settings-container .mascot-list-container {
        display: flex !important;
        width: 100% !important;
        min-width: 100% !important;
        max-height: none !important;
        margin-bottom: 24px;
    }
    
    .mascot-settings-container .mascot-detail-panel {
        display: none !important;
    }

    /* show-detail-mobile が true の時は一覧を非表示、詳細を表示 */
    .mascot-settings-container.show-detail-mobile .mascot-list-container {
        display: none !important;
    }
    
    .mascot-settings-container.show-detail-mobile .mascot-detail-panel {
        display: flex !important;
        width: 100% !important;
    }

    /* モバイル時のみ戻るボタンを表示 */
    .mobile-back-header {
        display: block !important;
    }

    /* 立ち絵全身像グリッドを縦一列にする */
    .outfit-grid-container {
        grid-template-columns: 1fr !important;
    }

    /* サブタブのラベルを非表示にしてアイコンのみにする */
    .subtab-label {
        display: none !important;
    }
    .subtab-icon {
        width: 48px !important;
        height: 48px !important;
    }
    .mascot-detail-panel .pb-2 button svg,
    .mascot-detail-panel .pb-2 button img {
        margin-right: 0 !important;
    }

    .mascot-detail-panel .pb-2 button.p-button-sm {
        padding: 0px !important;     /* パディング */
        width: 48px !important;      /* ボタン自体の横幅 */
        height: 48px !important;     /* ボタン自体の高さ */
        justify-content: center !important; /* 中央寄せ */
    }

    .desktop-text {
        display: none !important;
    }
    .mobile-text {
        display: inline !important;
    }
}
</style>
