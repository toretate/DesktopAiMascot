<script setup lang="ts">
import { ref, computed } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { MascotImageSetBuilder } from '../../mascots/MascotImageSetBuilder';

// 新規切り出しモーダルのインポート
import ExpressionEditorModal from './ExpressionEditorModal.vue';
import EmotionAssignmentModal from './EmotionAssignmentModal.vue';
import ImageCropModal from './ImageCropModal.vue';

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
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
            engine: string;
            speaker_id: number;
            style: string;
        };
    };
    assets: {
        outfits: MascotAsset[];
        expressions: MascotAsset[];
        poses: MascotAsset[];
    };
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
}>();

const activeMascotSubTab = ref<'profile' | 'outfit' | 'expression'>('expression');

// 編集・追加対象のワークバッファ
const editingMascot = ref<MascotData>({
    id: '',
    name: '',
    avatar: '🤖',
    profile: '',
    aiConfig: {
        chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
        voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
    },
    assets: { outfits: [], expressions: [], poses: [] }
});

const activeOutfit = computed(() => {
    const mascot = editingMascot.value;
    if (!mascot || !mascot.assets?.outfits) return null;
    return mascot.assets.outfits.find(o => o.id === mascot.currentOutfitId) || mascot.assets.outfits[0] || null;
});

const activePose = computed(() => {
    const mascot = editingMascot.value;
    if (!mascot || !mascot.assets?.poses) return null;
    return mascot.assets.poses.find(p => p.id === mascot.currentPoseId) || mascot.assets.poses[0] || null;
});

const activeExpression = ref<MascotAsset | null>(null);

const editingMascotImageSet = computed(() => {
    const mascot = editingMascot.value;
    if (!mascot) return null;
    
    const assets = [
        ...(mascot.assets?.outfits || []),
        ...(mascot.assets?.expressions || []),
        ...(mascot.assets?.poses || [])
    ];
    
    return MascotImageSetBuilder.CreateFromAssets(mascot.name, assets);
});

const defaultFrontAvatar = computed(() => {
    return editingMascotImageSet.value?.getFrontImage() || null;
});

// 左側アバター表示およびデスクトップマスコットへの表情リアルタイムプレビュー用状態
const activePreviewExpression = ref<MascotAsset | null>(null);

const computedListPreviewExpressionStyle = computed(() => {
    const expr = activePreviewExpression.value;
    if (!expr) return {};
    
    const ox = expr.offsetX ?? 0;
    const oy = expr.offsetY ?? 0;
    const sc = expr.scale ?? 1.0;
    
    // 大画面（420px）からリストアバター（200px）へのスケール比率
    const scaleFactor = 200 / 420;
    const scaledOx = ox * scaleFactor;
    const scaledOy = oy * scaleFactor;
    
    const baseWidthHeight = 140 * scaleFactor;
    
    return {
        position: 'absolute' as const,
        width: `${baseWidthHeight}px`,
        height: `${baseWidthHeight}px`,
        objectFit: 'contain' as const,
        pointerEvents: 'none' as const,
        transform: `translate(${scaledOx}px, ${scaledOy}px) scale(${sc})`,
        zIndex: 10
    };
});

const selectExpressionForPreview = (expr: MascotAsset) => {
    activePreviewExpression.value = expr;
    
    // デスクトップマスコット（別プロセス・別ウィンドウ）へのリアルタイム表情プレビュー状態の通知
    if (window.electronAPI && window.electronAPI.previewMascotState) {
        window.electronAPI.previewMascotState({
            expressionId: expr.id,
            expressionOffsetX: expr.offsetX ?? 0,
            expressionOffsetY: expr.offsetY ?? 0,
            expressionScale: expr.scale ?? 1.0,
            outfitId: editingMascot.value.currentOutfitId,
            poseId: editingMascot.value.currentPoseId
        });
    }
};

const selectMascot = (mascot: MascotData) => {
    // 選択切り替え時に編集バッファの内容を親リストに同期
    if (editingMascot.value && editingMascot.value.id) {
        const idx = props.mascots.findIndex(m => m.id === editingMascot.value.id);
        if (idx !== -1) {
            props.mascots.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
        }
    }
    emit('update:activeMascotId', mascot.id);
    editingMascot.value = JSON.parse(JSON.stringify(mascot));
    activeExpression.value = mascot.assets.expressions.find(e => e.name === '通常') || mascot.assets.expressions[0] || null;
    activePreviewExpression.value = activeExpression.value;
};

// 初期ロード時の選択処理用
if (props.mascots.length > 0) {
    const active = props.mascots.find(m => m.id === props.activeMascotId) || props.mascots[0];
    editingMascot.value = JSON.parse(JSON.stringify(active));
    activeExpression.value = editingMascot.value.assets.expressions.find(e => e.name === '通常') || editingMascot.value.assets.expressions[0] || null;
    activePreviewExpression.value = activeExpression.value;
}

// 編集バッファと親のリストを同期し保存するハンドラー
const syncAndSave = async () => {
    const idx = props.mascots.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        props.mascots.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
        emit('live-update');
    }
};

// --- 立ち絵アセット（全身像）操作関数群 ---
const addOutfitImage = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        if (!editingMascot.value.assets.outfits) {
            editingMascot.value.assets.outfits = [];
        }
        
        const newOutfit: MascotAsset = {
            id: 'outfit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: '衣装_' + (editingMascot.value.assets.outfits.length + 1),
            path: result.path,
            offsetX: 0,
            offsetY: 0,
            scale: 1.0
        };
        
        editingMascot.value.assets.outfits.push(newOutfit);
        
        if (editingMascot.value.assets.outfits.length === 1 || !editingMascot.value.currentOutfitId) {
            editingMascot.value.currentOutfitId = newOutfit.id;
        }
        
        syncAndSave();
    }
};

const setMainOutfit = (outfit: MascotAsset) => {
    editingMascot.value.currentOutfitId = outfit.id;
    syncAndSave();
};

const deleteOutfit = (outfit: MascotAsset) => {
    if (confirm(`立ち絵アセットを削除しますか？`)) {
        editingMascot.value.assets.outfits = editingMascot.value.assets.outfits.filter(o => o.id !== outfit.id);
        if (editingMascot.value.currentOutfitId === outfit.id) {
            editingMascot.value.currentOutfitId = editingMascot.value.assets.outfits[0]?.id || '';
        }
        syncAndSave();
    }
};

// モーダル管理用の状態
const isEditingExpressionsModal = ref(false);
const isAssigningEmotionsModal = ref(false);
const isCropModalActive = ref(false);

const cropImageSrc = ref('');
const selectedCropExpression = ref<MascotAsset | null>(null);
const scannedSprites = ref<{ id: string; name: string; path: string }[]>([]);
const isScanningSprite = ref(false);

const openExpressionEditModal = () => {
    isEditingExpressionsModal.value = true;
};

const openExpressionEditModalWithExpression = (expr: MascotAsset) => {
    isEditingExpressionsModal.value = true;
};

const closeExpressionEditModal = async () => {
    isEditingExpressionsModal.value = false;
    activeExpression.value = editingMascot.value.assets.expressions.find(e => e.name === '通常') || editingMascot.value.assets.expressions[0] || null;
    
    // 一括保存
    const idx = props.mascots.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        props.mascots[idx] = JSON.parse(JSON.stringify(editingMascot.value));
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

const handleCropNew = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        cropImageSrc.value = result.path;
        isCropModalActive.value = true;
    }
};

const handleCropDone = (croppedBase64: string) => {
    // もし切り出し対象の表情スロットが選択されていれば、そのスロットに割り当てる
    const targetSlot = selectedCropExpression.value || editingMascot.value.assets.expressions.find(e => e.name === '通常') || editingMascot.value.assets.expressions[0];
    if (targetSlot) {
        targetSlot.path = croppedBase64;
    }
    
    isCropModalActive.value = false;
    selectedCropExpression.value = null;
    syncAndSave();
};

const registeredExpressions = computed(() => {
    if (!editingMascot.value || !Array.isArray(editingMascot.value.assets?.expressions)) return [];
    return editingMascot.value.assets.expressions.filter(e => e.path) || [];
});

// AI表情インポート処理
const importFromSpriteSheet = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (!result || !result.success) return;
    
    isScanningSprite.value = true;
    
    try {
        const configData = await window.electronAPI.getAppConfig();
        const apiKey = configData.googleAiStudioApiKey || props.geminiApiKey;
        if (!apiKey) {
            alert('Google AI Studio APIキーを設定してください。');
            isScanningSprite.value = false;
            return;
        }
        
        const scanResults = await window.electronAPI.analyzeSpriteSheet(result.path, apiKey);
        if (scanResults.error) {
            throw new Error(scanResults.error);
        }
        
        const img = new Image();
        img.src = result.path;
        await new Promise((resolve) => (img.onload = resolve));
        
        scannedSprites.value = [];
        
        const emotionTranslationMap: Record<string, string> = {
            admiration: '賞賛', amusement: '面白がり', anger: '怒り', annoyance: '苛立ち', approval: '賛同',
            caring: '気遣い', confusion: '混乱', curiosity: '好奇心', desire: '欲求', disappointment: '失望',
            disapproval: '不賛成', disgust: '嫌悪', embarrassment: '当惑', excitement: '興奮', fear: '恐れ',
            gratitude: '感謝', grief: '深い悲しみ', joy: '喜び', love: '愛情', nervousness: '緊張',
            optimism: '楽観', pride: '誇り', realization: '気づき', relief: '安堵', remorse: '後悔',
            sadness: '悲しみ', surprise: '驚き', neutral: '通常'
        };
        
        for (const res of scanResults) {
            const [ymin, xmin, ymax, xmax] = res.box_2d;
            const label = res.label;
            
            const canvas = document.createElement('canvas');
            const width = ((xmax - xmin) * img.width) / 1000;
            const height = ((ymax - ymin) * img.height) / 1000;
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(
                    img,
                    (xmin * img.width) / 1000,
                    (ymin * img.height) / 1000,
                    width,
                    height,
                    0,
                    0,
                    width,
                    height
                );
                
                const croppedBase64 = canvas.toDataURL('image/png');
                const rawLabel = label.trim();
                const translatedLabel = emotionTranslationMap[rawLabel.toLowerCase()] || rawLabel;
                
                // 自動分別
                const targetSlot = editingMascot.value.assets.expressions.find(
                    e => e.name.toLowerCase() === translatedLabel.toLowerCase()
                );
                if (targetSlot) {
                    targetSlot.path = croppedBase64;
                }
                
                scannedSprites.value.push({
                    id: 'sprite_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: translatedLabel,
                    path: croppedBase64
                });
            }
        }
        
        alert(`${scanResults.length}個の表情を検出しました。感情割り当て画面で調整してください。`);
        isAssigningEmotionsModal.value = true;
    } catch (e: any) {
        alert('解析に失敗しました: ' + e.message);
    } finally {
        isScanningSprite.value = false;
    }
};

const closeAssigningEmotionsModal = async () => {
    isAssigningEmotionsModal.value = false;
    activeExpression.value = editingMascot.value.assets.expressions.find(e => e.name === '通常') || editingMascot.value.assets.expressions[0] || null;
    
    // 一括保存
    const idx = props.mascots.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        props.mascots[idx] = JSON.parse(JSON.stringify(editingMascot.value));
        emit('save-settings');
    }
};
</script>

<template>
    <div class="mascot-settings-container">
        <!-- 左側: マスコットリスト -->
        <div class="mascot-list">
            <div 
                v-for="mascot in mascots" 
                :key="mascot.id"
                class="mascot-item"
                :class="{ active: activeMascotId === mascot.id }"
                @click="selectMascot(mascot)"
            >
                <div class="avatar-container flex align-items-center justify-content-center bg-slate-50 border-round overflow-hidden relative" style="width: 150px; height: 200px; font-size: 64px; flex-shrink: 0; border: 1px solid rgba(0, 0, 0, 0.04);">
                    <!-- 1. ベースキャラクターアバターの優先度表示 -->
                    <template v-if="activeMascotId === mascot.id">
                        <!-- ポーズ画像優先 -->
                        <template v-if="activePose && activePose.path.startsWith('data:image/')">
                            <img :src="activePose.path" style="width: 100%; height: 100%; object-fit: contain;" />
                        </template>
                        <!-- 衣装画像優先 -->
                        <template v-else-if="activeOutfit && activeOutfit.path.startsWith('data:image/')">
                            <img :src="activeOutfit.path" style="width: 100%; height: 100%; object-fit: contain;" />
                        </template>
                        <!-- フロント画像優先 -->
                        <template v-else-if="defaultFrontAvatar && defaultFrontAvatar.path.startsWith('data:image/')">
                            <img :src="defaultFrontAvatar.path" style="width: 100%; height: 100%; object-fit: contain;" />
                        </template>
                        <!-- ベースアバター優先 -->
                        <template v-else-if="mascot.avatar && mascot.avatar.startsWith('data:image/')">
                            <img :src="mascot.avatar" style="width: 100%; height: 100%; object-fit: contain;" />
                        </template>
                        <span v-else class="avatar">{{ mascot.avatar || '🤖' }}</span>
                    </template>
                    <template v-else>
                        <!-- 非アクティブなマスコットはベースアバターを表示 -->
                        <img v-if="mascot.avatar && mascot.avatar.startsWith('data:image/')" :src="mascot.avatar" style="width: 100%; height: 100%; object-fit: contain;" />
                        <span v-else class="avatar">{{ mascot.avatar || '🤖' }}</span>
                    </template>

                    <!-- 2. 表情画像の重ね合わせプレビュー (アクティブマスコットかつ表情プレビュー中) -->
                    <template v-if="activeMascotId === mascot.id && activePreviewExpression && activePreviewExpression.path">
                        <img 
                            v-if="activePreviewExpression.path.startsWith('data:image/')" 
                            :src="activePreviewExpression.path" 
                            class="absolute"
                            :style="computedListPreviewExpressionStyle"
                        />
                        <span 
                            v-else 
                            class="absolute font-bold text-lg"
                            :style="computedListPreviewExpressionStyle"
                        >{{ activePreviewExpression.path }}</span>
                    </template>
                </div>
                <div class="info">
                    <span class="name">{{ mascot.name }}</span>
                </div>
            </div>
        </div>

        <!-- 右側: マスコットアセット・詳細調整 (白基調) -->
        <div class="mascot-detail-panel">
            <div class="flex justify-content-between align-items-center">
                <h3 class="m-0 text-gray-800 font-bold flex align-items-center gap-2">
                    <i class="pi pi-cog text-purple-400"></i>
                    <span>マスコット詳細設定</span>
                </h3>
            </div>

            <!-- サブタブ -->
            <div class="flex border-bottom border-gray-200 pb-2 gap-2">
                <Button 
                    label="表情アセット" 
                    icon="pi pi-sliders-h" 
                    class="p-button-sm"
                    :class="activeMascotSubTab === 'expression' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                    @click="activeMascotSubTab = 'expression'"
                />
                <Button 
                    label="立ち絵（全身像）" 
                    icon="pi pi-image" 
                    class="p-button-sm"
                    :class="activeMascotSubTab === 'outfit' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                    @click="activeMascotSubTab = 'outfit'"
                />
                <Button 
                    label="プロフィール" 
                    icon="pi pi-user" 
                    class="p-button-sm"
                    :class="activeMascotSubTab === 'profile' ? 'p-button-primary' : 'p-button-text p-button-secondary'"
                    @click="activeMascotSubTab = 'profile'"
                />
            </div>

            <!-- サブタブ中身: 表情アセット -->
            <div v-if="activeMascotSubTab === 'expression'" class="flex flex-column gap-3">
                <div class="flex gap-2">
                    <Button 
                        label="表情を編集・位置調整 (大画面エディタ)" 
                        icon="pi pi-sliders-h" 
                        class="p-button-primary p-button-sm flex-1"
                        @click="openExpressionEditModal"
                    />
                    <Button 
                        v-if="scannedSprites.length > 0"
                        label="感情割り当て画面を開く" 
                        icon="pi pi-sparkles" 
                        class="p-button-sm p-button-outlined p-button-info"
                        @click="isAssigningEmotionsModal = true"
                    />
                    <Button 
                        label="AIスプライトインポート" 
                        icon="pi pi-sparkles" 
                        class="p-button-sm p-button-outlined p-button-secondary"
                        :loading="isScanningSprite"
                        @click="importFromSpriteSheet"
                    />
                </div>

                <!-- 4列 x n行 の表情アセットグリッド -->
                <div class="form-field p-3 bg-white border-round border-1 border-gray-200 mt-2 flex flex-column gap-2">
                    <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                        <i class="pi pi-images text-purple-500"></i>
                        <span>表情グリッド ({{ registeredExpressions.length }} / 28 登録済み)</span>
                    </label>
                    
                    <div class="expression-grid-container pt-1" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-height: 420px; overflow-y: auto; width: 100%;">
                        <div 
                            v-for="expr in editingMascot.assets.expressions" 
                            :key="expr.id"
                            class="expression-grid-cell"
                            :class="{
                                'has-image': expr.path,
                                'default-expression': editingMascot.defaultExpressionId === expr.id
                            }"
                            @click="selectExpressionForPreview(expr)"
                            title="クリックして左側のマスコット表示にプレビュー"
                        >
                            <!-- 右上の標準（通常表示）スターバッジ -->
                            <div v-if="editingMascot.defaultExpressionId === expr.id" class="default-star-badge" title="通常表示（標準）">
                                <i class="pi pi-star-fill"></i>
                            </div>

                            <div class="flex align-items-center justify-content-center border-round bg-white overflow-hidden" style="width: 52px; height: 52px; border: 1px solid rgba(0,0,0,0.03); flex-shrink: 0; position: relative;">
                                <img 
                                    v-if="expr.path" 
                                    :src="expr.path" 
                                    class="w-full h-full object-contain" 
                                    style="width: 52px !important; height: 52px !important; max-width: 52px !important; max-height: 52px !important; object-fit: contain !important; position: static !important;"
                                />
                                <i v-else class="pi pi-plus text-gray-300 hover-text-gray-400" style="font-size: 12px;" title="表情を追加"></i>
                            </div>

                            <span class="text-xxs font-bold text-gray-600 text-center w-full text-ellipsis overflow-hidden mt-2 select-none flex align-items-center justify-content-center" style="height: 20px; line-height: 1; text-align: center; justify-content: center; align-items: center;">
                                {{ expr.name }}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- 標準（通常表示）の表情設定 -->
                <div class="form-field p-3 bg-white border-round border-1 border-gray-200 flex flex-column gap-2 mt-2">
                    <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                        <i class="pi pi-star text-yellow-500"></i>
                        <span>通常表示（標準）の表情</span>
                    </label>
                    <Select 
                        v-model="editingMascot.defaultExpressionId" 
                        :options="registeredExpressions" 
                        optionLabel="name" 
                        optionValue="id" 
                        placeholder="標準として表示する表情を選択..." 
                        class="w-full p-inputtext-sm" 
                        @change="syncAndSave"
                    />
                </div>
            </div>

            <!-- サブタブ中身: 立ち絵（全身像） -->
            <div v-else-if="activeMascotSubTab === 'outfit'" class="flex flex-column gap-3">
                <div class="flex gap-2">
                    <Button 
                        label="ローカル画像から立ち絵を追加" 
                        icon="pi pi-file-import" 
                        class="p-button-primary p-button-sm flex-1"
                        @click="addOutfitImage"
                    />
                </div>

                <div class="form-field p-3 bg-white border-round border-1 border-gray-200 mt-2 flex flex-column gap-2">
                    <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                        <i class="pi pi-image text-purple-500"></i>
                        <span>登録済みの立ち絵 (全身像)</span>
                    </label>

                    <div v-if="editingMascot.assets.outfits && editingMascot.assets.outfits.length > 0" class="outfit-grid-container pt-1" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 300px; overflow-y: auto; width: 100%;">
                        <div 
                            v-for="outfit in editingMascot.assets.outfits" 
                            :key="outfit.id"
                            class="outfit-grid-cell relative flex flex-column align-items-center justify-content-center border-round border-1 border-gray-200 bg-white p-2"
                            style="height: 160px; min-width: 0;"
                        >
                            <div v-if="editingMascot.currentOutfitId === outfit.id" class="absolute" style="top: 6px; right: 6px; z-index: 2;" title="現在使用中">
                                <i class="pi pi-check-circle text-green-500" style="font-size: 14px;"></i>
                            </div>

                            <div class="flex align-items-center justify-content-center border-round bg-white overflow-hidden cursor-pointer" style="width: 70px; height: 100px; border: 1px solid rgba(0,0,0,0.03); flex-shrink: 0;" @click="setMainOutfit(outfit)" title="クリックしてデフォルトの立ち絵に設定">
                                <img :src="outfit.path" class="w-full h-full object-contain" />
                            </div>
                            
                            <div class="flex gap-2 mt-2 w-full justify-content-center">
                                <Button icon="pi pi-trash" class="p-button-danger p-button-text p-button-sm" @click="deleteOutfit(outfit)" title="削除" />
                                <Button :icon="editingMascot.currentOutfitId === outfit.id ? 'pi pi-star-fill text-yellow-500' : 'pi pi-star'" class="p-button-text p-button-sm" @click="setMainOutfit(outfit)" title="メイン立ち絵に設定" />
                            </div>
                        </div>
                    </div>
                    <div v-else class="text-xs text-gray-400 text-center py-4 select-none">
                        ※立ち絵が登録されていません。「ローカル画像から立ち絵を追加」から全身画像を設定してください。
                    </div>
                </div>
            </div>

            <!-- サブタブ中身: プロフィール -->
            <div v-else class="flex flex-column gap-2">
                <div class="form-field">
                    <label class="text-xs font-semibold text-gray-700">マスコットキャラクターの性格・プロファイル</label>
                    <textarea 
                        v-model="editingMascot.profile" 
                        placeholder="例: ツンデレなアンドロイド女子高生..." 
                        rows="5"
                        class="w-full p-2 bg-white border-1 border-gray-200 border-round text-gray-800 text-sm focus:border-purple-400 focus:outline-none"
                        style="resize: none;"
                        @change="syncAndSave"
                    ></textarea>
                </div>
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
</template>

<style scoped>
.mascot-settings-container {
    display: flex !important;
    flex-direction: row !important;
    gap: 24px !important;
    width: 100% !important;
    align-items: flex-start !important;
}

.mascot-list {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
    width: 240px !important;
    min-width: 240px !important;
    max-height: calc(100vh - 160px) !important;
    overflow-y: auto !important;
    scrollbar-width: thin;
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
}

.border-bottom {
    border-bottom: 1px solid #e2e8f0 !important;
}

/* マスコット選択アイテムのスタイル */
.mascot-list {
    scrollbar-width: thin;
}

.mascot-item {
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

/* 28スロット表情グリッドセル (フレックスボックスとセンタリングを強力に強制) */
.expression-grid-cell {
    position: relative !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    border: 1px dashed #cbd5e1 !important;
    border-radius: 8px !important;
    height: 108px !important;
    width: 100% !important;
    background-color: #f8fafc !important;
    padding: 8px !important;
    box-sizing: border-box !important;
    cursor: pointer !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.expression-grid-cell:hover {
    background-color: #ffffff !important;
    border: 1.5px dashed #a855f7 !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.08) !important;
}
.expression-grid-cell.has-image {
    border-style: solid !important;
    border-color: #e2e8f0 !important;
    background-color: #ffffff !important;
}
.expression-grid-cell.default-expression {
    border: 1.5px dashed #eab308 !important;
    background-color: #fefce8 !important;
}
.expression-grid-cell.default-expression:hover {
    box-shadow: 0 4px 12px rgba(234, 179, 8, 0.12) !important;
}

/* 通常表示の黄色い星のバッジ (右上に完全に固定、レイアウトフローから隔離) */
.default-star-badge {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    z-index: 10 !important;
    line-height: 1 !important;
    display: block !important;
}
.default-star-badge i {
    font-size: 11px !important;
    color: #eab308 !important; /* 星のゴールド */
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
</style>
