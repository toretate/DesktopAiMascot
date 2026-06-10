<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Select from 'primevue/select';
import InputText from 'primevue/inputtext';
import { MascotImageSetBuilder } from '../../mascots/MascotImageSetBuilder';
import { useConfigStore } from '../../store/config';
import { alignBatch, isValidImageSource } from '../../skills/expression-alignment/expression-auto-align';
import { autoAlignBatch, CONFIDENCE_THRESHOLD } from '../../skills/expression-alignment/auto-align-v2';

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

// 新規切り出しモーダルのインポート
import ExpressionEditorModal from './ExpressionEditorModal.vue';
import EmotionAssignmentModal from './EmotionAssignmentModal.vue';
import ImageCropModal from './ImageCropModal.vue';
import AiExpressionGeneratorModal from './AiExpressionGeneratorModal.vue';
import BackgroundRemovalModal from './BackgroundRemovalModal.vue';
import PromptEditorModal from './PromptEditorModal.vue';
import SpriteImportModal from './SpriteImportModal.vue';


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
    (e: 'add-mascot'): void;
    (e: 'delete-mascot', id: string): void;
}>();

const activeMascotSubTab = ref<'profile' | 'outfit' | 'expression'>('expression');

// プロンプトファイル（OpenClaw）の保持用状態
const mascotPrompts = ref({ identity: '', soul: '', user: '', agents: '', memory: '' });
const isPromptModalActive = ref(false);

const loadMascotPrompts = async () => {
    if (window.electronAPI && editingMascot.value && editingMascot.value.id) {
        try {
            const data = await window.electronAPI.getMascotPrompts(editingMascot.value.id);
            mascotPrompts.value = data;
        } catch (e) {
            console.error('Failed to load mascot prompts in settings:', e);
        }
    }
};


// 28個の感情スロットの初期化保証
const ensure28Expressions = (expressions: any[]): any[] => {
    const defaultEmotions = [
        '通常', '喜び', '怒り', '悲しみ', '驚き',
        '面白がり', '苛立ち', '賛同', '気遣い', '混乱',
        '好奇心', '欲求', '失望', '不賛成', '嫌悪',
        '当惑', '興奮', '恐れ', '感謝', '深い悲しみ',
        '愛情', '緊張', '楽観', '誇り', '気づき',
        '安堵', '後悔', '賞賛'
    ];
    
    const existingMap = new Map<string, any>();
    if (Array.isArray(expressions)) {
        expressions.forEach(e => {
            if (e && e.name) {
                existingMap.set(e.name.trim(), e);
            }
        });
    }
    
    return defaultEmotions.map(emotion => {
        const existing = existingMap.get(emotion);
        return {
            id: existing?.id || 'expr_' + emotion,
            name: emotion,
            path: existing?.path || '',
            offsetX: existing?.offsetX ?? 0,
            offsetY: existing?.offsetY ?? 0,
            scale: existing?.scale ?? 1.0
        };
    });
};


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

const currentExpressions = computed(() => {
    if (!editingMascot.value) return [];
    return activeOutfit.value?.expressions || editingMascot.value.assets?.expressions || [];
});

const editingMascotImageSet = computed(() => {
    const mascot = editingMascot.value;
    if (!mascot) return null;
    
    const assets = [
        ...(mascot.assets?.outfits || []),
        ...currentExpressions.value,
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
    const rot = expr.rotation ?? 0;
    
    // 大画面（420px）からリスト内プレビュー（140px）へのスケール比率 (140 / 420 = 1/3)
    const scaleFactor = 140 / 420;
    const scaledOx = ox * scaleFactor;
    const scaledOy = oy * scaleFactor;
    
    // 大画面の表情ベースサイズ 140px に対するリスト内サイズ (140 * 1/3 ≒ 46.66px)
    const baseWidthHeight = 140 * scaleFactor;
    
    return {
        position: 'absolute' as const,
        width: `${baseWidthHeight}px`,
        height: `${baseWidthHeight}px`,
        objectFit: 'contain' as const,
        pointerEvents: 'none' as const,
        transform: `translate(${scaledOx}px, ${scaledOy}px) scale(${sc}) rotate(${rot}deg)`,
        zIndex: 10
    };
});

const updateMascotPreview = (overrides: { expressionId?: string; outfitId?: string; poseId?: string } = {}) => {
    if (window.electronAPI && window.electronAPI.previewMascotState) {
        // 現在のプレビュー対象の表情アセットを取得
        const currentExpr = (overrides.expressionId !== undefined)
            ? currentExpressions.value.find(e => e.id === overrides.expressionId)
            : activePreviewExpression.value;
        
        window.electronAPI.previewMascotState({
            expressionId: currentExpr?.id || editingMascot.value.defaultExpressionId,
            expressionOffsetX: currentExpr?.offsetX ?? 0,
            expressionOffsetY: currentExpr?.offsetY ?? 0,
            expressionScale: currentExpr?.scale ?? 1.0,
            expressionRotation: currentExpr?.rotation ?? 0,
            outfitId: overrides.outfitId !== undefined ? overrides.outfitId : editingMascot.value.currentOutfitId,
            poseId: overrides.poseId !== undefined ? overrides.poseId : editingMascot.value.currentPoseId
        });
    }
};

const selectExpressionForPreview = (expr: MascotAsset) => {
    activePreviewExpression.value = expr;
    updateMascotPreview({ expressionId: expr.id });
};

const selectMascot = (mascot: MascotData) => {
    // 選択切り替え時に編集バッファの内容を親リストに同期
    if (editingMascot.value && editingMascot.value.id) {
        const idx = configStore.mascots.findIndex(m => m.id === editingMascot.value.id);
        if (idx !== -1) {
            configStore.mascots.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
        }
    }
    emit('update:activeMascotId', mascot.id);
    editingMascot.value = JSON.parse(JSON.stringify(mascot));
    const currentMascotOutfit = mascot.assets?.outfits?.find((o: any) => o.id === mascot.currentOutfitId) || mascot.assets?.outfits?.[0] || null;
    const currentMascotExpressions = currentMascotOutfit?.expressions || mascot.assets?.expressions || [];
    activeExpression.value = currentMascotExpressions.find((e: any) => e.name === '通常') || currentMascotExpressions[0] || null;
    activePreviewExpression.value = activeExpression.value;
    
    // マスコット切り替え時もプレビューを更新
    updateMascotPreview();
    loadMascotPrompts();

    // アクティブなマスコットの変更を即座に保存・反映する
    emit('save-settings');
};


// 初期ロード時の選択処理用
const initEditingMascot = () => {
    const mascotsList = configStore.mascots || props.mascots;
    if (mascotsList && mascotsList.length > 0) {
        const active = mascotsList.find(m => m && m.id === props.activeMascotId) || mascotsList[0];
        if (!active) {
            console.warn('[MascotSettings] No active mascot found in list');
            return;
        }
        console.log('[MascotSettings] initEditingMascot active:', active);
        try {
            editingMascot.value = JSON.parse(JSON.stringify(active));
        } catch (e) {
            console.error('[MascotSettings] Failed to parse active mascot:', e);
            return;
        }
        
        // 28感情スロットの存在を保証・補正
        if (editingMascot.value && editingMascot.value.assets) {
            editingMascot.value.assets.expressions = ensure28Expressions(editingMascot.value.assets.expressions || []);
            if (Array.isArray(editingMascot.value.assets.outfits)) {
                editingMascot.value.assets.outfits.forEach((o: any) => {
                    o.expressions = ensure28Expressions(o.expressions || []);
                });
            }
        }
        
        console.log('[MascotSettings] initEditingMascot editingMascot:', editingMascot.value);
        const currentMascotOutfit = editingMascot.value.assets?.outfits?.find((o: any) => o && o.id === editingMascot.value.currentOutfitId) || editingMascot.value.assets?.outfits?.[0] || null;
        const currentMascotExpressions = currentMascotOutfit?.expressions || editingMascot.value.assets?.expressions || [];
        console.log('[MascotSettings] initEditingMascot currentMascotExpressions:', currentMascotExpressions);
        activeExpression.value = currentMascotExpressions.find((e: any) => e && e.name === '通常') || currentMascotExpressions[0] || null;
        activePreviewExpression.value = activeExpression.value;
        loadMascotPrompts();
    }
};

initEditingMascot();

// activeMascotId や configStore.mascots が非同期でロードされたり変更されたりした場合に初期化
watch(
    [() => props.activeMascotId, () => configStore.mascots],
    () => {
        if (!editingMascot.value || !editingMascot.value.id || editingMascot.value.id !== props.activeMascotId) {
            initEditingMascot();
        }
    },
    { deep: true }
);

// マスコットID変更時にプロンプトファイルを再読込
watch(
    () => editingMascot.value?.id,
    () => {
        loadMascotPrompts();
    }
);


// 編集バッファと親のリストを同期し保存するハンドラー
const syncAndSave = async () => {
    const idx = configStore.mascots.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        configStore.mascots.splice(idx, 1, JSON.parse(JSON.stringify(editingMascot.value)));
        configStore.configVersion++;
        emit('live-update');
    }
};

// --- AI 一括位置合わせ v2 ---
const isBatchAligningV2 = ref(false);
const batchAlignV2Progress = ref('');

/**
 * 現在のシートの全表情を packages/expression-alignment の solveTransform で一括位置合わせ。
 * 通常(neutral) 表情で SharedTransform A を確立し、残りの表情に A を再利用する（D4準拠）。
 */
const handleBatchAlignV2 = async () => {
    if (!editingMascot.value) return;

    // ベース画像の解決
    const currentOutfit = editingMascot.value.assets?.outfits?.find(
        (o: any) => o.id === editingMascot.value.currentOutfitId
    ) || editingMascot.value.assets?.outfits?.[0] || null;

    const baseImagePath = (() => {
        if (currentOutfit && isImage(currentOutfit.path)) return resolveImageUrl(currentOutfit.path);
        if (editingMascot.value.avatar && isImage(editingMascot.value.avatar)) return resolveImageUrl(editingMascot.value.avatar);
        return '';
    })();

    if (!isValidImageSource(baseImagePath)) {
        console.warn('[MascotSettings] ベース画像が見つからないため一括 AI 位置合わせをスキップします');
        return;
    }

    // 対象となる表情スロット（パスがある表情のみ）
    const expressions = currentOutfit?.expressions || editingMascot.value.assets?.expressions || [];
    const targets = expressions
        .filter((e: any) => e.path && isImage(e.path))
        .map((e: any) => ({
            id: e.id as string,
            url: resolveImageUrl(e.path) as string,
            isNeutral: e.name === '通常',
        }));

    if (targets.length === 0) {
        console.warn('[MascotSettings] 位置合わせ対象の表情が見つかりません');
        return;
    }

    isBatchAligningV2.value = true;
    batchAlignV2Progress.value = `処理中 0/${targets.length}`;

    try {
        const results = await autoAlignBatch(baseImagePath, targets);
        let applied = 0;
        let lowConfCount = 0;

        for (const expr of expressions) {
            const r = results.get(expr.id);
            if (!r) continue;
            expr.offsetX = r.params.offsetX;
            expr.offsetY = r.params.offsetY;
            expr.scale = r.params.scale;
            expr.rotation = r.params.rotation;
            applied++;
            if (r.confidence < CONFIDENCE_THRESHOLD) lowConfCount++;
        }

        await syncAndSave();

        if (lowConfCount > 0) {
            batchAlignV2Progress.value = `完了: ${applied}件適用（${lowConfCount}件低信頼度）`;
            console.warn(`[MascotSettings] AI 一括位置合わせ完了 (${applied}件, 低信頼度: ${lowConfCount}件)`);
        } else {
            batchAlignV2Progress.value = `完了: ${applied}件適用`;
            console.log(`[MascotSettings] AI 一括位置合わせ完了 (${applied}件)`);
        }
    } catch (e) {
        console.error('[MascotSettings] AI 一括位置合わせに失敗しました:', e);
        batchAlignV2Progress.value = 'エラーが発生しました';
    } finally {
        isBatchAligningV2.value = false;
        setTimeout(() => { batchAlignV2Progress.value = ''; }, 4000);
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
        
        // 立ち絵ごとに独立した表情を持つため、28感情のスロットを初期化して追加する
        const newOutfit: MascotAsset & { expressions?: MascotAsset[] } = {
            id: 'outfit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: '衣装_' + (editingMascot.value.assets.outfits.length + 1),
            path: result.path,
            offsetX: 0,
            offsetY: 0,
            scale: 1.0,
            expressions: ensure28Expressions([])
        };
        
        editingMascot.value.assets.outfits.push(newOutfit);
        
        if (editingMascot.value.assets.outfits.length === 1 || !editingMascot.value.currentOutfitId) {
            editingMascot.value.currentOutfitId = newOutfit.id;
            updateMascotPreview({ outfitId: newOutfit.id });
        }
        
        // 立ち絵追加は重要な操作なので、内容同期後に即座に永続化する
        await syncAndSave();
        emit('save-settings');
    }
};

const setMainOutfit = (outfit: MascotAsset) => {
    editingMascot.value.currentOutfitId = outfit.id;
    
    // 衣装が変わったので、プレビュー対象の表情も新しい衣装の同名のものに更新する
    // これにより、プレビューIDが新しい衣装側で解決できない問題を防止する
    if (activePreviewExpression.value) {
        const newExpr = outfit.expressions?.find(e => e.name === activePreviewExpression.value?.name);
        if (newExpr) {
            activePreviewExpression.value = newExpr;
        }
    }

    // プレビューを即座に反映（衣装切り替え時はポーズを強制的にクリアして衣装を見せる）
    updateMascotPreview({ 
        outfitId: outfit.id,
        poseId: '' 
    });

    // メイン立ち絵の切り替えも即座に永続化する
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
            
            // 削除時も対応するプレビュー更新を行う
            if (nextOutfit) {
                const newExpr = nextOutfit.expressions?.find(e => e.name === activePreviewExpression.value?.name);
                if (newExpr) activePreviewExpression.value = newExpr;
            }
            updateMascotPreview({ outfitId: nextOutfitId });
        }
        // 立ち絵削除も即座に永続化する
        syncAndSave();
        emit('save-settings');
    }
};

// モーダル管理用の状態
const isEditingExpressionsModal = ref(false);
const isAssigningEmotionsModal = ref(false);
const isCropModalActive = ref(false);
const isAiGeneratingModalActive = ref(false);
const isBackgroundRemovalModalActive = ref(false);
const isSpriteImportModalActive = ref(false);
// outfit参照ではなくIDを保持することで、Vueリアクティビティを介した安全な更新を保証する
const backgroundRemovalTargetOutfitId = ref<string | null>(null);

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
        // editingMascotの配列からIDで直接検索して更新する
        const targetOutfit = editingMascot.value.assets.outfits.find(o => o.id === backgroundRemovalTargetOutfitId.value);
        if (targetOutfit) {
            targetOutfit.path = newBase64;
            // 変更を親リストへ同期して保存
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
    const currentMascotExpressions = activeOutfit.value?.expressions || editingMascot.value.assets.expressions || [];
    activeExpression.value = currentMascotExpressions.find((e: any) => e.name === '通常') || currentMascotExpressions[0] || null;
    
    // 一括保存
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
        cropImageSrc.value = slot.originalPath || slot.path;
        isCropModalActive.value = true;
    }
};

const handleCropNew = async (slot?: MascotAsset) => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        if (slot) {
            selectedCropExpression.value = slot;
        }
        cropImageSrc.value = result.path;
        isCropModalActive.value = true;
    }
};

const handleCropDone = async (croppedBase64: string) => {
    // もし切り出し対象の表情スロットが選択されていれば、そのスロットに割り当てる
    const currentMascotExpressions = activeOutfit.value?.expressions || editingMascot.value.assets.expressions || [];
    const targetSlot = selectedCropExpression.value || currentMascotExpressions.find((e: any) => e.name === '通常') || currentMascotExpressions[0];
    if (targetSlot) {
        let finalPath = croppedBase64;
        let finalOriginalPath = cropImageSrc.value;
        if (window.electronAPI?.saveMascotImage && editingMascot.value?.id) {
            try {
                const sanitizedLabel = targetSlot.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_');
                const outfitName = activeOutfit.value?.name.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_') || 'default';

                // 1. 元画像の保存 (元画像が Base64 の場合のみサーバーに保存し、恒久的なパスに置換)
                if (cropImageSrc.value.startsWith('data:image/')) {
                    try {
                        const originalFilename = `expressions/${outfitName}/original/orig_expr_${sanitizedLabel}.png`;
                        const saveOriginalResult = await window.electronAPI.saveMascotImage(
                            editingMascot.value.id,
                            originalFilename,
                            cropImageSrc.value
                        );
                        if (saveOriginalResult.success && saveOriginalResult.path) {
                            finalOriginalPath = saveOriginalResult.path;
                        }
                    } catch (originalErr) {
                        console.warn('[MascotSettings] 元画像の保存に失敗しました:', originalErr);
                    }
                }

                // 2. 切り抜いた画像の保存 (Base64 データURLの場合のみ)
                if (croppedBase64.startsWith('data:image/')) {
                    const filename = `expressions/${outfitName}/expr_${sanitizedLabel}.png`;
                    const saveResult = await window.electronAPI.saveMascotImage(
                        editingMascot.value.id,
                        filename,
                        croppedBase64
                    );
                    if (saveResult.success && saveResult.path) {
                        finalPath = saveResult.path;
                    }
                }
            } catch (err) {
                console.warn('[MascotSettings] 切り抜き画像の保存に失敗しました:', err);
            }
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

// AI表情インポート処理
const importFromSpriteSheet = async (importData?: string | { imagePath: string; importId: string }) => {
    if (!window.electronAPI) return;
    
    let imagePath = '';
    let importId = '';
    let isBase64 = false;
    let originalSource = '';
    
    if (importData) {
        if (typeof importData === 'string') {
            imagePath = importData;
            originalSource = importData;
            isBase64 = imagePath.startsWith('data:image/');
            const match = imagePath.match(/\/expressions\/working\/([^\/]+)\//);
            importId = match ? match[1] : 'sheet_' + Date.now();
        } else {
            imagePath = importData.imagePath;
            originalSource = importData.imagePath;
            importId = importData.importId;
            isBase64 = imagePath.startsWith('data:image/');
        }
    } else {
        const result = await window.electronAPI.selectLocalImage();
        if (!result || !result.success) return;
        imagePath = result.path;
        originalSource = result.path;
        isBase64 = imagePath.startsWith('data:image/');
        importId = 'sheet_' + Date.now();
    }
    
    isScanningSprite.value = true;
    
    try {
        const configData = await window.electronAPI.getAppConfig();
        const apiKey = configData.googleAiStudioApiKey || props.geminiApiKey;
        if (!apiKey) {
            alert('Google AI Studio APIキーを設定してください。');
            isScanningSprite.value = false;
            return;
        }
        
        // 元画像が Base64（新規インポート等）の場合、スプライトシート全体画像を先に expressions/working/$ID/ に保存する
        if (isBase64 && editingMascot.value?.id) {
            try {
                const sheetFilename = `expressions/working/${importId}/spritesheet_${importId}.png`;
                const saveResult = await window.electronAPI.saveMascotImage(
                    editingMascot.value.id,
                    sheetFilename,
                    imagePath
                );
                if (saveResult.success && saveResult.path) {
                    imagePath = saveResult.path;
                }
            } catch (saveErr) {
                console.warn('[MascotSettings] スプライトシート全体の保存に失敗しました:', saveErr);
            }
        }
        
        const scanResults = await window.electronAPI.analyzeSpriteSheet(imagePath, apiKey);
        if (scanResults.error) {
            throw new Error(scanResults.error);
        }
        
        const img = new Image();
        img.crossOrigin = 'anonymous'; // 安全策としてのCORS許可指定
        img.src = originalSource.startsWith('data:image/') ? originalSource : resolveImageUrl(originalSource); // キャンバスへのロードには汚染されない元のソースを使用
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
            const box = res.box_2d || res.box || res.coordinates;
            if (!box || !Array.isArray(box) || box.length < 4) continue;
            const [ymin, xmin, ymax, xmax] = box;
            const label = res.label || res.emotion;
            if (!label) continue;
            
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
                
                // 切り分けられた画像もサーバー側（expressions/working/$ID/）に保存する
                let finalCroppedPath = croppedBase64;
                if (window.electronAPI?.saveMascotImage && editingMascot.value?.id) {
                    try {
                        const sanitizedLabel = translatedLabel.replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '_');
                        const filename = `expressions/working/${importId}/expr_${sanitizedLabel}.png`;
                        const saveResult = await window.electronAPI.saveMascotImage(
                            editingMascot.value.id,
                            filename,
                            croppedBase64
                        );
                        if (saveResult.success && saveResult.path) {
                            finalCroppedPath = saveResult.path;
                        }
                    } catch (saveErr) {
                        console.warn(`[MascotSettings] 表情 ${translatedLabel} の保存に失敗しました:`, saveErr);
                    }
                }
                
                // 自動分別
                const currentMascotExpressions = activeOutfit.value?.expressions || editingMascot.value.assets?.expressions || [];
                const targetSlot = currentMascotExpressions.find(
                    (e: any) => e.name.toLowerCase() === translatedLabel.toLowerCase()
                );
                if (targetSlot) {
                    targetSlot.path = finalCroppedPath;
                    targetSlot.originalPath = imagePath; // 元に戻せるように元の全体のシート画像パスを設定
                }
                
                scannedSprites.value.push({
                    id: 'sprite_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: translatedLabel,
                    path: finalCroppedPath
                });
            }
        }
        
        alert(`${scanResults.length}個の表情を検出・スロットへ自動割り当てしました。`);
        isAssigningEmotionsModal.value = true;
    } catch (e: any) {
        alert('解析に失敗しました: ' + e.message);
    } finally {
        isScanningSprite.value = false;
    }
};

const closeAssigningEmotionsModal = async () => {
    isAssigningEmotionsModal.value = false;
    const currentMascotExpressions = activeOutfit.value?.expressions || editingMascot.value.assets.expressions || [];
    activeExpression.value = currentMascotExpressions.find((e: any) => e.name === '通常') || currentMascotExpressions[0] || null;
    
    // 一括保存
    const idx = configStore.mascots.findIndex(m => m.id === editingMascot.value.id);
    if (idx !== -1) {
        configStore.mascots[idx] = JSON.parse(JSON.stringify(editingMascot.value));
        emit('save-settings');
    }
};

const getMascotCoverImage = (mascot: MascotData): string => {
    if (!mascot) return '';
    // 1. ポーズ優先
    if (mascot.assets?.poses && mascot.currentPoseId) {
        const pose = mascot.assets.poses.find(p => p.id === mascot.currentPoseId);
        if (pose && isImage(pose.path)) return resolveImageUrl(pose.path);
    }
    // 2. 現在の衣装
    if (mascot.assets?.outfits && mascot.currentOutfitId) {
        const outfit = mascot.assets.outfits.find(o => o.id === mascot.currentOutfitId);
        if (outfit && isImage(outfit.path)) return resolveImageUrl(outfit.path);
    }
    // 3. 最初の衣装
    if (mascot.assets?.outfits && mascot.assets.outfits.length > 0) {
        const outfit = mascot.assets.outfits[0];
        if (outfit && isImage(outfit.path)) return resolveImageUrl(outfit.path);
    }
    // 4. アバター画像
    if (mascot.avatar && isImage(mascot.avatar)) {
        return resolveImageUrl(mascot.avatar);
    }
    return '';
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
                <!-- マスコット削除ボタン -->
                <Button 
                    icon="pi pi-trash" 
                    class="p-button-danger p-button-text p-button-sm mascot-delete-btn" 
                    @click.stop="emit('delete-mascot', mascot.id)"
                    title="マスコットを削除"
                />
                <div class="avatar-container flex align-items-center justify-content-center bg-slate-50 border-round overflow-hidden" style="width: 150px; height: 200px; font-size: 64px; flex-shrink: 0; border: 1px solid rgba(0, 0, 0, 0.04); position: relative;">
                    <!-- 大画面プレビュー（420x560）とアスペクト比を完全に一致させるための 140x186.66px ラッパー -->
                    <div class="mascot-composite-preview relative flex align-items-center justify-content-center" style="width: 140px; height: 186.66px; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        <!-- 1. ベースキャラクターアバターの優先度表示 -->
                        <template v-if="activeMascotId === mascot.id">
                            <!-- ポーズ画像優先 -->
                            <img v-if="activePose && isImage(activePose.path)" key="active-pose" :src="resolveImageUrl(activePose.path)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <!-- 衣装画像優先 -->
                            <img v-else-if="activeOutfit && isImage(activeOutfit.path)" key="active-outfit" :src="resolveImageUrl(activeOutfit.path)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <!-- フロント画像優先 -->
                            <img v-else-if="defaultFrontAvatar && isImage(defaultFrontAvatar.path)" key="active-front" :src="resolveImageUrl(defaultFrontAvatar.path)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <!-- ベースアバター優先 -->
                            <img v-else-if="mascot.avatar && isImage(mascot.avatar)" key="active-avatar" :src="resolveImageUrl(mascot.avatar)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <span v-else key="active-emoji" class="avatar" style="position: absolute; z-index: 1;">{{ mascot.avatar || '🤖' }}</span>
                        </template>
                        <template v-else>
                            <!-- 非アクティブなマスコットは最適なカバー画像を表示 -->
                            <img v-if="getMascotCoverImage(mascot)" key="inactive-cover" :src="getMascotCoverImage(mascot)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;" />
                            <span v-else key="inactive-emoji" class="avatar" style="position: absolute; z-index: 1;">{{ mascot.avatar || '🤖' }}</span>
                        </template>

                        <!-- 2. 表情画像の重ね合わせプレビュー (アクティブマスコットかつ表情プレビュー中) -->
                        <template v-if="activeMascotId === mascot.id && activePreviewExpression && activePreviewExpression.path">
                            <img 
                                v-if="isImage(activePreviewExpression.path)" 
                                :src="resolveImageUrl(activePreviewExpression.path)" 
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
                </div>
                <div class="info">
                    <span class="name">{{ mascot.name }}</span>
                </div>
            </div>
            <!-- マスコット追加ボタン -->
            <Button 
                label="マスコット追加" 
                icon="pi pi-plus" 
                class="p-button-outlined p-button-secondary w-full py-3"
                @click="emit('add-mascot')"
            />
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
                        label="AI表情生成" 
                        icon="pi pi-sparkles" 
                        class="p-button-sm p-button-outlined p-button-primary"
                        @click="isAiGeneratingModalActive = true"
                    />
                    <Button
                        label="AIスプライトインポート"
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

                <!-- 4列 x n行 の表情アセットグリッド -->
                <div class="form-field p-3 bg-white border-round border-1 border-gray-200 mt-2 flex flex-column gap-2">
                    <label class="font-bold text-xs text-gray-700 flex align-items-center gap-1 select-none">
                        <i class="pi pi-images text-purple-500"></i>
                        <span>表情グリッド ({{ registeredExpressions.length }} / 28 登録済み)</span>
                    </label>
                    
                    <div class="expression-grid-container pt-1" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-height: 420px; overflow-y: auto; width: 100%;">
                        <div 
                            v-for="expr in currentExpressions" 
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

                            <!-- 左上の登録解除ボタン (画像がある場合のみ) -->
                            <div v-if="expr.path" class="expression-clear-btn" @click.stop="handleClearExpression(expr)" title="登録解除">
                                <i class="pi pi-trash"></i>
                            </div>

                            <div class="flex align-items-center justify-content-center border-round bg-white overflow-hidden" style="width: 52px; height: 52px; border: 1px solid rgba(0,0,0,0.03); flex-shrink: 0; position: relative;">
                                <img 
                                    v-if="expr.path && isImage(expr.path)" 
                                    :src="resolveImageUrl(expr.path)" 
                                    class="w-full h-full object-contain" 
                                    style="width: 52px !important; height: 52px !important; max-width: 52px !important; max-height: 52px !important; object-fit: contain !important; position: static !important;"
                                />
                                <span v-else-if="expr.path" class="text-xs" style="position: absolute;">{{ expr.path }}</span>
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
                        :options="currentExpressions" 
                        optionLabel="name" 
                        optionValue="id" 
                        placeholder="標準として表示する表情を選択..." 
                        class="w-full p-inputtext-sm" 
                        @change="() => { updateMascotPreview(); syncAndSave(); emit('save-settings'); }"
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
                                <img v-if="isImage(outfit.path)" :src="resolveImageUrl(outfit.path)" class="w-full h-full object-contain" />
                                <span v-else class="text-xs">{{ outfit.path }}</span>
                            </div>
                            
                            <div class="flex gap-2 mt-2 w-full justify-content-center">
                                <Button icon="pi pi-trash" class="p-button-danger p-button-text p-button-sm" @click="deleteOutfit(outfit)" title="削除" />
                                <Button icon="pi pi-eraser" class="p-button-secondary p-button-text p-button-sm" @click="openBackgroundRemovalModal(outfit)" title="背景削除" />
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
            <div v-else class="flex flex-column gap-3">
                <div class="form-field flex flex-column gap-1">
                    <label class="text-xs font-semibold text-gray-700">マスコット名</label>
                    <InputText 
                        v-model="editingMascot.name" 
                        placeholder="例: デフォルトロボット" 
                        class="w-full p-inputtext-sm" 
                        @change="() => { syncAndSave(); emit('save-settings'); }"
                    />
                </div>
                <div class="form-field flex flex-column gap-1">
                    <label class="text-xs font-semibold text-gray-700">アバター (絵文字または画像URL)</label>
                    <InputText 
                        v-model="editingMascot.avatar" 
                        placeholder="例: 🤖" 
                        class="w-full p-inputtext-sm" 
                        @change="() => { syncAndSave(); emit('save-settings'); }"
                    />
                </div>


                <!-- 詳細プロンプト表示エリア (readonly) -->
                <div class="border-top border-gray-200 pt-3 mt-1 flex flex-column gap-2">
                    <div class="flex justify-content-between align-items-center">
                        <label class="text-xs font-bold text-gray-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-file text-purple-500"></i>
                            <span>詳細プロンプト設定 (外部ファイル)</span>
                        </label>
                        <Button 
                            label="詳細プロンプトを編集する" 
                            icon="pi pi-user-edit" 
                            class="p-button-sm p-button-outlined p-button-primary py-1 px-2 text-xs"
                            @click="isPromptModalActive = true"
                        />
                    </div>

                    <div class="flex flex-column gap-2 mt-1">
                        <!-- Identity -->
                        <div class="flex flex-column gap-1">
                            <span class="text-xxs font-bold text-gray-500 select-none">Identity.md (役割設定)</span>
                            <textarea 
                                :value="mascotPrompts.identity" 
                                readonly 
                                rows="2"
                                class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                                style="resize: none;"
                            ></textarea>
                        </div>
                        <!-- Soul -->
                        <div class="flex flex-column gap-1">
                            <span class="text-xxs font-bold text-gray-500 select-none">Soul.md (性格・口調)</span>
                            <textarea 
                                :value="mascotPrompts.soul" 
                                readonly 
                                rows="2"
                                class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                                style="resize: none;"
                            ></textarea>
                        </div>
                        <!-- User -->
                        <div class="flex flex-column gap-1">
                            <span class="text-xxs font-bold text-gray-500 select-none">User.md (関係性)</span>
                            <textarea 
                                :value="mascotPrompts.user" 
                                readonly 
                                rows="2"
                                class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                                style="resize: none;"
                            ></textarea>
                        </div>
                        <!-- Agents -->
                        <div class="flex flex-column gap-1">
                            <span class="text-xxs font-bold text-gray-500 select-none">Agents.md (行動規範)</span>
                            <textarea 
                                :value="mascotPrompts.agents" 
                                readonly 
                                rows="2"
                                class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                                style="resize: none;"
                            ></textarea>
                        </div>
                        <!-- Memory -->
                        <div class="flex flex-column gap-1">
                            <span class="text-xxs font-bold text-gray-500 select-none">Memory.md (長期記憶)</span>
                            <textarea 
                                :value="mascotPrompts.memory" 
                                readonly 
                                rows="2"
                                class="w-full p-2 bg-gray-100 border-1 border-gray-200 border-round text-gray-500 text-xs font-mono"
                                style="resize: none;"
                            ></textarea>
                        </div>
                    </div>
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

/* 表情登録解除ボタン (左上に配置) */
.expression-clear-btn {
    position: absolute !important;
    top: 8px !important;
    left: 8px !important;
    z-index: 10 !important;
    line-height: 1 !important;
    display: none !important; /* 通常は非表示 */
    padding: 2px !important;
    border-radius: 4px !important;
    transition: all 0.2s ease !important;
    color: #94a3b8 !important;
}

.expression-grid-cell:hover .expression-clear-btn {
    display: block !important;
}

.expression-clear-btn:hover {
    background-color: #fee2e2 !important;
    color: #ef4444 !important;
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
