<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useConfigStore } from '../../store/config';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import { alignSingle, isValidImageSource, autoCropImage, autoCropFaceRegion } from '../../skills/expression-alignment/expression-auto-align';
import { autoAlignSingle, CONFIDENCE_THRESHOLD, type AutoAlignV2Result } from '../../skills/expression-alignment/auto-align-v2';
import type { SharedTransform } from '@desktop-ai-mascot/expression-alignment';

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
    rotation?: number;
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

// キーボードイベントハンドラ
const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible || !selectedModalExpression.value) return;
    
    // 入力フォーム等のフォーカス時は矢印移動を行わない
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
    }

    let handled = false;
    const step = 1; // 1pxずつ移動

    if (e.key === 'ArrowUp') {
        const current = selectedModalExpression.value.offsetY || 0;
        selectedModalExpression.value.offsetY = Math.max(-250, current - step);
        handled = true;
    } else if (e.key === 'ArrowDown') {
        const current = selectedModalExpression.value.offsetY || 0;
        selectedModalExpression.value.offsetY = Math.min(250, current + step);
        handled = true;
    } else if (e.key === 'ArrowLeft') {
        const current = selectedModalExpression.value.offsetX || 0;
        selectedModalExpression.value.offsetX = Math.max(-250, current - step);
        handled = true;
    } else if (e.key === 'ArrowRight') {
        const current = selectedModalExpression.value.offsetX || 0;
        selectedModalExpression.value.offsetX = Math.min(250, current + step);
        handled = true;
    }

    if (handled) {
        e.preventDefault();
        handleLiveUpdate();
    }
};

// visible が true になった時やマスコットデータが渡された時に、表情初期選択を確実に実行する
watch(
    () => props.visible,
    (newVal) => {
        if (newVal) {
            window.addEventListener('keydown', handleKeyDown);
            const expressions = currentExpressions.value;
            if (expressions && expressions.length > 0) {
                selectedModalExpression.value = expressions.find((e: any) => e.name === '通常') || expressions[0] || null;
            } else {
                selectedModalExpression.value = null;
            }
        } else {
            window.removeEventListener('keydown', handleKeyDown);
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

const isSidebarOpen = ref(false);

const selectExpression = (slot: MascotAsset) => {
    selectedModalExpression.value = slot;
    isSidebarOpen.value = false;
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

const adjustRotation = (delta: number) => {
    if (selectedModalExpression.value) {
        const current = selectedModalExpression.value.rotation ?? 0;
        let next = Math.round(current + delta);
        next = Math.max(-45, Math.min(45, next));
        selectedModalExpression.value.rotation = next;
        handleLiveUpdate();
    }
};

// --- ドラッグ操作の実装 ---
const isDragging = ref(false);
let startX = 0;
let startY = 0;
let startOffsetX = 0;
let startOffsetY = 0;

const startDrag = (e: MouseEvent) => {
    if (!selectedModalExpression.value) return;
    isDragging.value = true;
    startX = e.clientX;
    startY = e.clientY;
    startOffsetX = selectedModalExpression.value.offsetX || 0;
    startOffsetY = selectedModalExpression.value.offsetY || 0;

    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', stopDrag);
};

const handleDrag = (e: MouseEvent) => {
    if (!isDragging.value || !selectedModalExpression.value) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    selectedModalExpression.value.offsetX = Math.round(startOffsetX + dx);
    selectedModalExpression.value.offsetY = Math.round(startOffsetY + dy);
    
    // スライダーの範囲制限に合わせる
    selectedModalExpression.value.offsetX = Math.max(-250, Math.min(250, selectedModalExpression.value.offsetX));
    selectedModalExpression.value.offsetY = Math.max(-250, Math.min(250, selectedModalExpression.value.offsetY));
    
    handleLiveUpdate();
};

const stopDrag = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', handleDrag);
    window.removeEventListener('mouseup', stopDrag);
};

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('mousemove', handleDrag);
    window.removeEventListener('mouseup', stopDrag);
});

// --- 自動調整機能 ---
const isAutoCropping = ref(false);
const isAutoScaling = ref(false);
const isAutoAligning = ref(false);

/**
 * ベース画像のパスを解決する（位置合わせ共通ロジック）
 */
const resolveBaseImagePath = (): string => {
    if (props.activePose && isImage(props.activePose.path)) {
        return resolveImageUrl(props.activePose.path);
    } else if (props.activeOutfit && isImage(props.activeOutfit.path)) {
        return resolveImageUrl(props.activeOutfit.path);
    } else if (props.defaultFrontAvatar && isImage(props.defaultFrontAvatar.path)) {
        return resolveImageUrl(props.defaultFrontAvatar.path);
    } else if (props.editingMascot?.avatar && isImage(props.editingMascot.avatar)) {
        return resolveImageUrl(props.editingMascot.avatar);
    }
    return '';
};

/**
 * 表情画像の有効領域を自動で検出して切り抜く
 */
const handleAutoCrop = async () => {
    if (!selectedModalExpression.value || !selectedModalExpression.value.path) return;
    if (!isImage(selectedModalExpression.value.path)) return;

    isAutoCropping.value = true;
    try {
        const expressionImagePath = resolveImageUrl(selectedModalExpression.value.path);
        const cropped = await autoCropFaceRegion(expressionImagePath);
        
        let finalPath = cropped;
        // Electron環境であればクロップ後の画像をファイルとして保存する
        if (window.electronAPI?.saveMascotImage && props.editingMascot?.id) {
            try {
                const sanitizedLabel = selectedModalExpression.value.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_');
                const outfitName = props.activeOutfit?.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_') || 'default';
                const filename = `expressions/${outfitName}/expr_${sanitizedLabel}.png`;
                
                const saveResult = await window.electronAPI.saveMascotImage(
                    props.editingMascot.id,
                    filename,
                    cropped
                );
                if (saveResult.success && saveResult.path) {
                    finalPath = saveResult.path;
                }
            } catch (saveErr) {
                console.warn('[ExpressionEditorModal] 自動切り抜き後画像の保存に失敗しました:', saveErr);
            }
        }

        // 自動切り抜き前の元の画像パスを originalPath に退避（未設定の場合のみ）
        if (!selectedModalExpression.value.originalPath) {
            selectedModalExpression.value.originalPath = selectedModalExpression.value.path;
        }

        selectedModalExpression.value.path = finalPath;
        handleLiveUpdate();
        console.log('[ExpressionEditorModal] 自動切り抜きに成功しました');
    } catch (e) {
        console.error('[ExpressionEditorModal] 自動切り抜きに失敗しました:', e);
    } finally {
        isAutoCropping.value = false;
    }
};

/**
 * ベース画像の顔サイズに合わせて表情の拡大率のみを自動調整する
 */
const handleAutoScaling = async () => {
    if (!selectedModalExpression.value || !selectedModalExpression.value.path) return;
    if (!isImage(selectedModalExpression.value.path)) return;

    const baseImagePath = resolveBaseImagePath();
    if (!isValidImageSource(baseImagePath)) {
        console.warn('[ExpressionEditorModal] ベース画像が見つからないため自動Scalingをスキャンします');
        return;
    }

    isAutoScaling.value = true;
    try {
        const expressionImagePath = resolveImageUrl(selectedModalExpression.value.path);
        const result = await alignSingle(baseImagePath, expressionImagePath, {
            useAIDetection: false,
        });
        selectedModalExpression.value.scale = result.params.scale;
        handleLiveUpdate();
        console.log('[ExpressionEditorModal] 自動Scalingに成功しました:', result.params.scale);
    } catch (e) {
        console.error('[ExpressionEditorModal] 自動Scalingに失敗しました:', e);
    } finally {
        isAutoScaling.value = false;
    }
};

/**
 * ベース画像の顔位置に合わせて表情の表示位置(X, Y)のみを自動調整する
 */
const handleAutoAlign = async () => {
    if (!selectedModalExpression.value || !selectedModalExpression.value.path) return;
    if (!isImage(selectedModalExpression.value.path)) return;

    const baseImagePath = resolveBaseImagePath();
    if (!isValidImageSource(baseImagePath)) {
        console.warn('[ExpressionEditorModal] ベース画像が見つからないため自動位置合わせをスキップします');
        return;
    }

    isAutoAligning.value = true;
    try {
        const expressionImagePath = resolveImageUrl(selectedModalExpression.value.path);
        const currentScale = selectedModalExpression.value.scale ?? 1.0;
        const result = await alignSingle(baseImagePath, expressionImagePath, {
            useAIDetection: false,
            overrideScale: currentScale
        });
        selectedModalExpression.value.offsetX = result.params.offsetX;
        selectedModalExpression.value.offsetY = result.params.offsetY;
        handleLiveUpdate();
        console.log('[ExpressionEditorModal] 自動位置合わせ(位置のみ)に成功しました:', result.params.offsetX, result.params.offsetY);
    } catch (e) {
        console.error('[ExpressionEditorModal] 自動位置合わせに失敗しました:', e);
    } finally {
        isAutoAligning.value = false;
    }
};

// --- AI 位置合わせ v2 ---
const isAutoAligningV2 = ref(false);
const lastAlignV2Confidence = ref<number | null>(null);
// シート（衣装×ポーズ）単位でキャッシュする SharedTransform（scale/rotation/mask）
const cachedSharedTransform = ref<SharedTransform | undefined>(undefined);

/**
 * packages/expression-alignment の solveTransform を使った高精度な自動位置合わせ（v2）。
 * confidence >= CONFIDENCE_THRESHOLD: 自動適用
 * confidence <  CONFIDENCE_THRESHOLD: プリセット適用 + 低信頼度表示
 */
const handleAutoAlignV2 = async () => {
    if (!selectedModalExpression.value?.path) return;
    if (!isImage(selectedModalExpression.value.path)) return;

    const baseImagePath = resolveBaseImagePath();
    if (!isValidImageSource(baseImagePath)) {
        console.warn('[ExpressionEditorModal] ベース画像が見つからないため AI 位置合わせをスキップします');
        return;
    }

    isAutoAligningV2.value = true;
    lastAlignV2Confidence.value = null;
    try {
        const expressionImagePath = resolveImageUrl(selectedModalExpression.value.path);
        const result: AutoAlignV2Result = await autoAlignSingle(
            baseImagePath,
            expressionImagePath,
            cachedSharedTransform.value,
        );

        // SharedTransform が新たに確立された場合はキャッシュに保存
        if (result.shared) {
            cachedSharedTransform.value = result.shared;
        }

        lastAlignV2Confidence.value = result.confidence;

        // 結果をエディタに反映
        selectedModalExpression.value.offsetX = result.params.offsetX;
        selectedModalExpression.value.offsetY = result.params.offsetY;
        selectedModalExpression.value.scale = result.params.scale;
        selectedModalExpression.value.rotation = result.params.rotation;
        handleLiveUpdate();

        if (result.confidence >= CONFIDENCE_THRESHOLD) {
            console.log(`[ExpressionEditorModal] AI 位置合わせ成功 confidence=${result.confidence.toFixed(2)}`);
        } else {
            console.warn(`[ExpressionEditorModal] AI 位置合わせ 低信頼度 confidence=${result.confidence.toFixed(2)} — 手動で確認してください`);
        }
    } catch (e) {
        console.error('[ExpressionEditorModal] AI 位置合わせ v2 に失敗しました:', e);
    } finally {
        isAutoAligningV2.value = false;
    }
};

// outfit/pose が切り替わったら SharedTransform キャッシュをリセット
watch(
    () => [props.activeOutfit?.id, props.activePose?.id],
    () => { cachedSharedTransform.value = undefined; lastAlignV2Confidence.value = null; },
);

// --- 背景除去 ---
const isRemovingBackground = ref(false);

const handleRemoveBackground = async () => {
    if (!selectedModalExpression.value || !selectedModalExpression.value.path) return;
    if (!isImage(selectedModalExpression.value.path)) return;

    isRemovingBackground.value = true;
    try {
        const expressionImagePath = selectedModalExpression.value.path;
        
        console.log(`[ExpressionEditorModal] 背景除去サービスへリクエスト送信: http://localhost:3000/api/remove-background`);
        const response = await fetch('http://localhost:3000/api/remove-background', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imagePath: expressionImagePath,
                mascotId: props.editingMascot.id,
                engine: 'node'
            })
        });

        if (!response.ok) {
            throw new Error(`背景削除エラー: ${response.statusText}`);
        }

        const resData = await response.json();
        if (resData.success && resData.image) {
            let finalPath = resData.image;

            // Electron環境であれば背景除去済み画像をファイルとして保存する
            if (window.electronAPI?.saveMascotImage && props.editingMascot?.id) {
                try {
                    const sanitizedLabel = selectedModalExpression.value.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_');
                    const outfitName = props.activeOutfit?.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_') || 'default';
                    const filename = `expressions/${outfitName}/expr_${sanitizedLabel}.png`;
                    
                    const saveResult = await window.electronAPI.saveMascotImage(
                        props.editingMascot.id,
                        filename,
                        resData.image
                    );
                    if (saveResult.success && saveResult.path) {
                        finalPath = saveResult.path;
                    }
                } catch (saveErr) {
                    console.warn('[ExpressionEditorModal] 背景除去後画像の保存に失敗しました:', saveErr);
                }
            }

            // 背景削除前の元の画像パスを originalPath に退避（未設定の場合のみ）
            if (!selectedModalExpression.value.originalPath) {
                selectedModalExpression.value.originalPath = selectedModalExpression.value.path;
            }

            selectedModalExpression.value.path = finalPath;
            handleLiveUpdate();
            console.log('[ExpressionEditorModal] 背景除去に成功しました');
        } else {
            throw new Error(resData.error || '背景削除処理に失敗しました。');
        }
    } catch (e: any) {
        // 外部通信接続エラー時のハンドリング
        if (e instanceof TypeError && e.message.includes('fetch')) {
            console.warn('[ExpressionEditorModal] 背景除去サービスとの接続エラー');
            alert('背景除去サービスに接続できませんでした。サーバーが起動しているか確認してください。');
        } else {
            console.error('[ExpressionEditorModal] 背景除去に失敗しました:', e);
            alert(`背景除去に失敗しました: ${e.message}`);
        }
    } finally {
        isRemovingBackground.value = false;
    }
};
</script>

<template>
    <div v-if="visible" class="custom-modal-overlay expression-edit-modal-overlay">
        <div class="custom-modal-card expression-edit-modal-card">
            <!-- スリム化されたヘッダー (縦幅約半分) -->
            <div class="modal-header flex justify-content-between align-items-center pb-2 pt-0 border-bottom border-gray-200">
                <div class="flex align-items-center gap-2">
                    <Button 
                        icon="pi pi-bars" 
                        class="p-button-rounded p-button-text p-button-secondary sidebar-toggle-btn" 
                        style="width: 28px; height: 28px; padding: 0; display: none;" 
                        @click="isSidebarOpen = !isSidebarOpen"
                        title="表情一覧を開く"
                    />
                    <h2 class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                        <i class="pi pi-sliders-h text-purple-500 text-sm header-icon"></i>
                        <span>表情エディタ & 位置調整 (SillyTavern 28感情互換)</span>
                    </h2>
                </div>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <div class="modal-body-container flex gap-4 mt-2 overflow-hidden flex-1 relative" style="min-height: 0;">
                <!-- モバイル用サイドバー背景オーバーレイ -->
                <div 
                    v-if="isSidebarOpen" 
                    class="sidebar-overlay" 
                    @click="isSidebarOpen = false"
                ></div>

                <!-- 左カラム: 表情スロット縦スリムリスト -->
                <div 
                    class="flex flex-column expression-sidebar-panel" 
                    :class="{ 'open': isSidebarOpen }"
                    style="height: 570px; overflow: hidden !important;"
                >
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
                            <div class="flex flex-column flex-1 overflow-hidden expression-slot-info">
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
                <div v-if="selectedModalExpression" class="flex-1 flex flex-column gap-2 overflow-hidden expression-main-panel">
                    <!-- プレビューと縦スライダーのコンテナ -->
                    <div class="flex-1 gap-3 overflow-hidden preview-slider-wrapper">
                        <!-- プレビューカード (白飛びを防ぐための高級感のある市松模様背景) -->
                        <div class="border-1 border-gray-200 border-round checkerboard-bg flex align-items-center justify-content-center relative overflow-hidden preview-container" style="height: 570px;">
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

                                <!-- 表情重ね合わせ (offsetX, offsetY, scale, rotation 補正) -->
                                <template v-if="selectedModalExpression.path">
                                    <img
                                        v-if="isImage(selectedModalExpression.path)"
                                        :src="resolveImageUrl(selectedModalExpression.path)"
                                        class="preview-layer-img expression absolute"
                                        :style="{
                                            top: '210px',
                                            left: '140px',
                                            width: '140px',
                                            height: '140px',
                                            objectFit: 'contain',
                                            transform: `translate(${selectedModalExpression.offsetX || 0}px, ${selectedModalExpression.offsetY || 0}px) scale(${selectedModalExpression.scale || 1.0}) rotate(${selectedModalExpression.rotation || 0}deg)`
                                        }"
                                        draggable="false"
                                        @dragstart.prevent
                                        @mousedown="startDrag"
                                    />
                                    <span
                                        v-else
                                        class="preview-layer expression absolute font-bold text-4xl"
                                        :style="{
                                            top: '50%',
                                            left: '50%',
                                            transform: `translate(calc(-50% + ${selectedModalExpression.offsetX || 0}px), calc(-50% + ${selectedModalExpression.offsetY || 0}px)) scale(${selectedModalExpression.scale || 1.0}) rotate(${selectedModalExpression.rotation || 0}deg)`
                                        }"
                                        @mousedown="startDrag"
                                        @dragstart.prevent
                                    >{{ selectedModalExpression.path }}</span>
                                </template>
                            </div>
                        </div>

                        <!-- 縦スライダー (Y方向オフセット) -->
                        <div class="flex flex-column align-items-center gap-2 vertical-slider-container" style="width: 40px;">
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

                            <!-- 回転スライダー (Rotation) -->
                            <div class="flex-1 flex flex-column gap-1">
                                <div class="flex justify-content-between align-items-center">
                                    <label class="text-xs font-semibold text-slate-700 select-none">回転 (R)</label>
                                    <div class="flex align-items-center gap-1 bg-blue-50 border-round px-2 py-0.5 border-1 border-blue-200 select-none">
                                        <span class="text-xxs text-blue-600 font-mono font-bold">{{ (selectedModalExpression.rotation || 0) }}°</span>
                                        <div class="flex flex-column gap-0" style="line-height: 0.8;">
                                            <i
                                                class="pi pi-chevron-up text-blue-400 hover:text-blue-600 cursor-pointer"
                                                style="font-size: 8px; padding: 1px;"
                                                @click="adjustRotation(1)"
                                                title="1度右回転"
                                            ></i>
                                            <i
                                                class="pi pi-chevron-down text-blue-400 hover:text-blue-600 cursor-pointer"
                                                style="font-size: 8px; padding: 1px;"
                                                @click="adjustRotation(-1)"
                                                title="1度左回転"
                                            ></i>
                                        </div>
                                    </div>
                                </div>
                                <Slider v-model="selectedModalExpression.rotation" :min="-45" :max="45" :step="1" @change="handleLiveUpdate" />
                            </div>
                        </div>

                        <!-- ボタン類 (2段レイアウト) -->
                        <div class="flex flex-column gap-2 pt-2 border-top border-gray-200">
                            <!-- 上の段 -->
                            <div class="flex align-items-center gap-3">
                                <div class="text-xs text-slate-500 font-bold select-none" style="width: 60px; min-width: 60px;">自動調整</div>
                                <div class="text-slate-300 text-xs select-none">|</div>
                                <div class="flex gap-2 flex-1">
                                    <Button 
                                        v-if="selectedModalExpression.path && isImage(selectedModalExpression.path)"
                                        :label="isAutoCropping ? '処理中...' : '自動切り抜き'" 
                                        icon="pi pi-scissors" 
                                        class="p-button-outlined p-button-warning p-button-sm" 
                                        :loading="isAutoCropping"
                                        :disabled="isAutoCropping || isAutoScaling || isAutoAligning || isRemovingBackground"
                                        @click="handleAutoCrop" 
                                        title="表情画像の余白を自動的に検出して切り抜きます"
                                    />
                                    <Button 
                                        v-if="selectedModalExpression.path && isImage(selectedModalExpression.path)"
                                        :label="isRemovingBackground ? '処理中...' : '背景削除'" 
                                        icon="pi pi-eraser" 
                                        class="p-button-outlined p-button-secondary p-button-sm" 
                                        :loading="isRemovingBackground"
                                        :disabled="isRemovingBackground || isAutoCropping || isAutoScaling || isAutoAligning"
                                        @click="handleRemoveBackground" 
                                        title="表情スプライト画像の背景を除去します"
                                    />
                                    <Button 
                                        v-if="selectedModalExpression.path && isImage(selectedModalExpression.path)"
                                        :label="isAutoScaling ? '処理中...' : '自動Scaling'" 
                                        icon="pi pi-external-link" 
                                        class="p-button-outlined p-button-help p-button-sm" 
                                        :loading="isAutoScaling"
                                        :disabled="isAutoCropping || isAutoScaling || isAutoAligning || isRemovingBackground"
                                        @click="handleAutoScaling" 
                                        title="ベース画像の顔の大きさに合わせて表情の拡大率を自動調整します"
                                    />
                                    <Button
                                        v-if="selectedModalExpression.path && isImage(selectedModalExpression.path)"
                                        :label="isAutoAligning ? '処理中...' : '自動位置合わせ'"
                                        icon="pi pi-bullseye"
                                        class="p-button-outlined p-button-info p-button-sm"
                                        :loading="isAutoAligning"
                                        :disabled="isAutoCropping || isAutoScaling || isAutoAligning || isRemovingBackground || isAutoAligningV2"
                                        @click="handleAutoAlign"
                                        title="ベース画像の顔位置に合わせて表情の表示位置(X, Y)を自動調整します"
                                    />
                                    <Button
                                        v-if="selectedModalExpression.path && isImage(selectedModalExpression.path)"
                                        :label="isAutoAligningV2 ? '処理中...' : 'AI 位置合わせ'"
                                        :icon="isAutoAligningV2 ? 'pi pi-spin pi-spinner' : (lastAlignV2Confidence !== null && lastAlignV2Confidence < 0.5 ? 'pi pi-exclamation-triangle' : 'pi pi-microchip-ai')"
                                        :class="['p-button-sm', lastAlignV2Confidence !== null && lastAlignV2Confidence < 0.5 ? 'p-button-outlined p-button-warning' : 'p-button-outlined p-button-success']"
                                        :loading="isAutoAligningV2"
                                        :disabled="isAutoCropping || isAutoScaling || isAutoAligning || isRemovingBackground || isAutoAligningV2"
                                        @click="handleAutoAlignV2"
                                        :title="lastAlignV2Confidence !== null ? `OpenCV ベース位置合わせ (信頼度: ${(lastAlignV2Confidence * 100).toFixed(0)}%)` : 'OpenCV ベース高精度位置合わせ（scale/rotation/offset 一括）'"
                                    />
                                    <div v-else class="text-xs text-slate-400 font-semibold select-none py-1">
                                        ※画像を登録またはクロップすると各種パラメータの自動調整が行えます。
                                    </div>
                                </div>
                            </div>
                            <!-- 下の段 -->
                            <div class="flex align-items-center gap-3 pt-2 border-top border-gray-100">
                                <div class="text-xs text-slate-500 font-bold select-none" style="width: 60px; min-width: 60px;">手動調整</div>
                                <div class="text-slate-300 text-xs select-none">|</div>
                                <div class="flex gap-2 flex-1">
                                    <Button
                                        label="リセット"
                                        icon="pi pi-refresh"
                                        class="p-button-outlined p-button-secondary p-button-sm"
                                        @click="selectedModalExpression.offsetX = 0; selectedModalExpression.offsetY = 0; selectedModalExpression.scale = 1.0; selectedModalExpression.rotation = 0; handleLiveUpdate()"
                                        title="位置・サイズ・回転を初期値に戻します"
                                    />
                                    <Button 
                                        v-if="selectedModalExpression.path && isImage(selectedModalExpression.path)"
                                        label="切り抜き" 
                                        icon="pi pi-image" 
                                        class="p-button-outlined p-button-info p-button-sm" 
                                        @click="emit('crop-current', selectedModalExpression)" 
                                        title="手動で画像を切り抜き直します"
                                    />
                                    <Button 
                                        v-if="selectedModalExpression.path"
                                        label="解除" 
                                        icon="pi pi-trash" 
                                        class="p-button-outlined p-button-danger p-button-sm" 
                                        @click="clearExpression" 
                                        title="このスロットの表情画像を解除します"
                                    />
                                    <Button 
                                        label="画像から切り出し" 
                                        icon="pi pi-file-import" 
                                        class="p-button-outlined p-button-success p-button-sm" 
                                        @click="emit('crop-new', selectedModalExpression)" 
                                        title="新しい画像から切り出して登録します"
                                    />
                                </div>
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
.preview-slider-wrapper {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: center !important;
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
    pointer-events: auto;
    cursor: move;
    z-index: 10;
}
.preview-layer {
    position: absolute;
    pointer-events: auto;
    cursor: move;
    z-index: 10;
}

/* 左カラムの幅をレスポンシブにするための定義 */
.expression-sidebar-panel {
    width: 200px;
    min-width: 200px;
    flex-shrink: 0;
    transition: all 0.2s ease-in-out;
}

.expression-slot-info {
    transition: all 0.2s ease-in-out;
}

.preview-container {
    min-width: 420px;
    flex: 1;
}

@media (max-width: 1024px) {
    .expression-sidebar-panel {
        width: 150px;
        min-width: 150px;
    }
}

/* 769px〜850pxの幅のときだけ、PCレイアウトのままサイドバーをコンパクトにする */
@media (min-width: 769px) and (max-width: 850px) {
    .expression-sidebar-panel {
        width: 68px; /* サムネイル画像（38px）＋パディングが綺麗に収まる最小限のサイズ */
        min-width: 68px;
    }
    
    /* テキスト情報を非表示にしてアイコン一覧にする */
    .expression-slot-info {
        display: none !important;
    }
    
    .expression-vertical-item {
        justify-content: center !important;
        padding: 6px !important;
    }
    
    /* デフォルトバッジの位置を調整 */
    .default-badge {
        top: 2px;
        right: 2px;
    }
}

@media (max-width: 768px) {
    .expression-edit-modal-overlay {
        background: #ffffff !important;
        backdrop-filter: none !important;
        display: block !important;
        overflow-y: auto !important;
    }

    .expression-edit-modal-card {
        width: 100vw !important;
        height: auto !important;
        min-height: 100vh !important;
        max-width: 100vw !important;
        max-height: none !important;
        border-radius: 0 !important;
        border: none !important;
        box-shadow: none !important;
        padding: 8px 12px 24px 12px !important;
        display: flex !important;
        flex-direction: column !important;
    }

    /* モバイル時のヘッダー調整 */
    .sidebar-toggle-btn {
        display: inline-flex !important;
    }
    
    .header-icon {
        display: none !important;
    }

    /* ボディコンテナのスクロール設定を解除し、親モーダル全体のスクロールに委ねる */
    .modal-body-container {
        position: relative !important;
        overflow: visible !important;
        flex: none !important;
        height: auto !important;
    }

    .expression-main-panel {
        overflow: visible !important;
        flex: none !important;
        height: auto !important;
        padding-bottom: 24px;
    }

    /* モバイル時のサイドパネル設定 (常に画面の左側に固定表示) */
    .expression-sidebar-panel {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        height: 100vh !important;
        width: 240px !important;
        min-width: 240px !important;
        background: #ffffff !important;
        z-index: 2100 !important; /* モーダル(2000)より上 */
        box-shadow: 4px 0 15px rgba(0, 0, 0, 0.15) !important;
        transform: translateX(-100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        border-right: 1px solid #e2e8f0 !important;
        padding: 12px !important;
    }
    
    .expression-sidebar-panel.open {
        transform: translateX(0) !important;
    }

    .expression-vertical-list {
        height: calc(100vh - 24px) !important;
        max-height: calc(100vh - 24px) !important;
    }

    /* モバイル用サイドバー背景オーバーレイ (常に画面全体に固定) */
    .sidebar-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(15, 23, 42, 0.4) !important;
        backdrop-filter: blur(4px) !important;
        z-index: 2050 !important;
    }

    /* プレビューカードのサイズをスマホ向けに自動縮小 */
    .preview-container {
        min-width: 0 !important;
        width: 210px !important;
        height: 280px !important;
        position: relative !important;
        flex: none !important;
        margin: 0 !important;
    }

    .vertical-slider-container {
        flex: none !important;
        width: 40px !important;
    }

    .preview-slider-wrapper {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        justify-content: center !important;
        align-items: center !important;
        width: 100% !important;
        margin: 0 auto !important;
        flex: none !important;
    }
    
    .mascot-composite-preview {
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) scale(0.5) !important;
        transform-origin: center center !important;
    }

    /* 縦スライダーの高さ調整 */
    .vertical-slider-wrapper {
        height: 240px !important;
    }

    /* 下部コントロールのスライダー群を縦並びにして幅を確保 */
    .grid.flex {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 16px !important;
    }

    .grid.flex > div {
        width: 100% !important;
    }

    /* ボタン類をレスポンシブに折り返す */
    .flex.align-items-center.gap-3 {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 6px !important;
    }
    
    .flex.align-items-center.gap-3 > .text-slate-300 {
        display: none !important; /* 区切り線を非表示 */
    }

    .flex.gap-2.flex-1 {
        flex-wrap: wrap !important;
        width: 100% !important;
    }
    
    .flex.gap-2.flex-1 button {
        flex: 1 1 calc(50% - 4px) !important;
        min-width: 110px !important;
        justify-content: center !important;
    }
}
</style>
