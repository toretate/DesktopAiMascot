<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue';
import { MascotImageSetBuilder } from '../mascots/MascotImageSetBuilder';

const isChatVisible = ref(false);
const emotionClass = ref('');
const currentEmotion = ref('neutral');

// --- マスコット状態の管理 ---
const mascots = ref<any[]>([]);
const activeMascotId = ref('');
let unsubscribeConfig: (() => void) | null = null;
let unsubscribePreview: (() => void) | null = null;

// プレビュー用の臨時オーバーライド状態
const previewState = ref<{
    outfitId?: string;
    poseId?: string;
    expressionId?: string;
    expressionOffsetX?: number;
    expressionOffsetY?: number;
    expressionScale?: number;
} | null>(null);

const activeMascot = computed(() => {
    return mascots.value.find(m => m.id === activeMascotId.value) || null;
});

const activeMascotImageSet = computed(() => {
    const mascot = activeMascot.value;
    if (!mascot) return null;
    
    // outfits, expressions, poses をフラットにしてアセットリストを作成
    const assets = [
        ...(mascot.assets?.outfits || []),
        ...(mascot.assets?.expressions || []),
        ...(mascot.assets?.poses || [])
    ];
    
    return MascotImageSetBuilder.CreateFromAssets(mascot.name, assets);
});

// 現在選択されている服装アセット
const activeOutfit = computed(() => {
    const mascot = activeMascot.value;
    if (!mascot || !mascot.assets?.outfits) return null;
    
    // プレビュー中ならそれを優先
    const targetId = previewState.value?.outfitId || mascot.currentOutfitId;
    return mascot.assets.outfits.find((o: any) => o.id === targetId) || null;
});

// 現在のポーズアセット
const activePose = computed(() => {
    const mascot = activeMascot.value;
    if (!mascot || !mascot.assets?.poses) return null;
    
    // プレビュー中ならそれを優先
    const targetId = previewState.value?.poseId || mascot.currentPoseId;
    return mascot.assets.poses.find((p: any) => p.id === targetId) || null;
});

const emotionMap: Record<string, string> = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    surprised: '😲',
    neutral: '🤖'
};

// 表情アセットの動的解決（共通化）
const activeExpression = computed(() => {
    const mascot = activeMascot.value;
    if (!mascot) return null;
    
    const expressions = mascot.assets?.expressions || [];

    // 1. プレビュー中なら指定されたアセットを強制表示
    if (previewState.value?.expressionId) {
        const found = expressions.find((e: any) => e.id === previewState.value?.expressionId);
        if (found) return found;
    }

    // 2. 会話中の感情(currentEmotion)の正規化
    const normalized = currentEmotion.value.toLowerCase().trim();

    // 2.2 アイドル待機状態(neutral)で、マスコットに指定された標準表情(defaultExpressionId)がある場合はそれを最優先で使用
    if (normalized === 'neutral' && mascot.defaultExpressionId) {
        const foundDefault = expressions.find((expr: any) => expr.id === mascot.defaultExpressionId);
        if (foundDefault && foundDefault.path) return foundDefault;
    }

    // 2.3 MascotImageSetから感情に応じた表情を明示的に取得（画像名から方向や感情を分類する処理を共通化）
    if (activeMascotImageSet.value) {
        const emotionFace = activeMascotImageSet.value.getEmotionFaceImage(normalized);
        if (emotionFace && emotionFace.path) return emotionFace;

        const emotionFull = activeMascotImageSet.value.getEmotionFullbodyImage(normalized);
        if (emotionFull && emotionFull.path) return emotionFull;
    }

    // SillyTavernの英語名と日本語名アセットのマッピング対応表
    const emotionTranslationMap: Record<string, string[]> = {
        admiration: ['賞賛', 'admiration'],
        amusement: ['面白がり', 'amusement'],
        anger: ['怒り', 'anger'],
        annoyance: ['苛立ち', 'annoyance'],
        approval: ['賛同', 'approval'],
        caring: ['気遣い', 'caring'],
        confusion: ['混乱', 'confusion'],
        curiosity: ['好奇心', 'curiosity'],
        desire: ['欲求', 'desire'],
        disappointment: ['失望', 'disappointment'],
        disapproval: ['不賛成', 'disapproval'],
        disgust: ['嫌悪', 'disgust'],
        embarrassment: ['当惑', 'embarrassment'],
        excitement: ['興奮', 'excitement'],
        fear: ['恐れ', 'fear'],
        gratitude: ['感謝', 'gratitude'],
        grief: ['深い悲しみ', 'grief'],
        joy: ['喜び', 'joy'],
        love: ['愛情', 'love'],
        nervousness: ['緊張', 'nervousness'],
        optimism: ['楽観', 'optimism'],
        pride: ['誇り', 'pride'],
        realization: ['気づき', 'realization'],
        relief: ['安堵', 'relief'],
        remorse: ['後悔', 'remorse'],
        sadness: ['悲しみ', 'sadness'],
        surprise: ['驚き', 'surprise'],
        neutral: ['通常', 'neutral']
    };

    // 2.5 感情名とアセットのnameが直接一致する（完全一致または部分一致、英語名・日本語名両方でマッチ）ものを最優先で解決
    if (normalized) {
        // SillyTavernの英語名感情タグに対応する日本語名と英語名候補のリストを取得
        const candidateNames = emotionTranslationMap[normalized] || [normalized];

        const directMatch = expressions.find((expr: any) => {
            const exprName = expr.name.toLowerCase().trim();
            return candidateNames.some(cand => 
                exprName === cand || 
                exprName.includes(cand) ||
                cand.includes(exprName)
            );
        });
        if (directMatch) return directMatch;
    }

    // 3. キーワードマッピングによる解決 (SillyTavernの28感情すべてを基本5感情にマッピング、日本語アセット名も対応)
    const keywords_map: Record<string, string[]> = {
        happy: ['笑顔', '喜び', '喜', 'happy', 'smile', '楽', '😆', '😊', 'joy', 'amusement', 'excitement', 'love', 'admiration', 'approval', 'gratitude', 'optimism', 'pride', 'relief', '面白がり', '興奮', '愛情', '賞賛', '賛同', '感謝', '楽観', '誇り', '安堵'],
        sad: ['悲しみ', '悲', '哀', 'sad', 'cry', '泣', '😢', '😭', 'sadness', 'grief', 'remorse', 'disappointment', 'disapproval', '深い悲しみ', '後悔', '失望', '不賛成'],
        angry: ['怒り', '怒', 'angry', '怒り', '😠', '😡', 'annoyance', 'disgust', '苛立ち', '嫌悪'],
        surprised: ['驚き', '驚', 'surprised', 'shock', '😲', '😮', 'curiosity', 'realization', 'confusion', '好奇心', '気づき', '混乱'],
        neutral: ['通常', 'normal', 'neutral', '普通', '🤖', 'caring', 'desire', 'embarrassment', 'fear', 'nervousness', '気遣い', '欲求', '当惑', '恐れ', '緊張']
    };
    
    const keywords = keywords_map[normalized] || [];
    if (keywords.length > 0) {
        const found = expressions.find((expr: any) => 
            keywords.some(kw => expr.name.includes(kw) || expr.id.toLowerCase().includes(kw) || expr.path.includes(kw))
        );
        if (found) return found;
    }
    
    // 4. 感情に一致するものがない場合、マスコットのデフォルト表情（指定された標準表情、または通常）を探す
    if (mascot.defaultExpressionId) {
        const foundDefault = expressions.find((expr: any) => expr.id === mascot.defaultExpressionId);
        if (foundDefault && foundDefault.path) return foundDefault;
    }

    const normalKeywords = ['通常', 'normal', 'neutral', '普通', '🤖', '😊'];
    const normalExpr = expressions.find((expr: any) => 
        normalKeywords.some(kw => expr.name.includes(kw) || expr.id.toLowerCase().includes(kw))
    );
    if (normalExpr) return normalExpr;
    
    // 5. それでもなければ、最初のアセット
    if (expressions.length > 0) {
        return expressions[0];
    }
    
    return null;
});

// 感情に連動した表情アセットの動的な解決（画像パスまたは絵文字）
const activeExpressionEmoji = computed(() => {
    if (activeExpression.value) {
        return activeExpression.value.path;
    }
    const normalized = currentEmotion.value.toLowerCase();
    return emotionMap[normalized] || '🤖';
});

// 表情の表示スタイル（位置・サイズ）の計算
const activeExpressionStyle = computed(() => {
    const found = activeExpression.value;
    if (found) {
        // プレビュー中ならプレビューの値を、そうでなければアセット自身の保存値を使用
        const ox = previewState.value ? (previewState.value.expressionOffsetX ?? 0) : (found.offsetX ?? 0);
        const oy = previewState.value ? (previewState.value.expressionOffsetY ?? 0) : (found.offsetY ?? 0);
        const sc = previewState.value ? (previewState.value.expressionScale ?? 1) : (found.scale ?? 1);
        
        return {
            transform: `translate(${ox}px, ${oy - 8}px) scale(${sc})`
        };
    }
    
    return {};
});

// 既定の正面画像（最終フォールバック用）
const defaultFrontAvatar = computed(() => {
    return activeMascotImageSet.value?.getFrontImage() || null;
});

const toggleChat = () => {
    if (window.electronAPI) {
        window.electronAPI.toggleChat();
    }
};

const openSettings = () => {
    if (window.electronAPI) {
        window.electronAPI.openSettings();
    }
};

// --- ドラッグおよびクリックの制御 ---
const isDragging = ref(false);
let startMouseX = 0;
let startMouseY = 0;
let hasMoved = false;

const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) { // 左クリックのみ対象
        isDragging.value = true;
        startMouseX = e.screenX;
        startMouseY = e.screenY;
        hasMoved = false;

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }
};

const onMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;

    // マウス左ボタンが押されていない状態ならドラッグ終了とする（予期しないmouseup漏れ対策）
    if (e.buttons !== 1) {
        onMouseUp();
        return;
    }

    const dx = e.screenX - startMouseX;
    const dy = e.screenY - startMouseY;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        hasMoved = true;
        if (window.electronAPI && window.electronAPI.dragWindow) {
            window.electronAPI.dragWindow({ dx, dy });
        }
        startMouseX = e.screenX;
        startMouseY = e.screenY;
    }
};

const onMouseUp = () => {
    if (!isDragging.value) return;
    isDragging.value = false;

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    if (!hasMoved) {
        // ドラッグ移動しなかった場合はクリックとみなし、チャットトグル
        toggleChat();
    }
};

const loadMascotConfig = (configData: any) => {
    if (!configData) return;
    console.log('[MascotViewer] loadMascotConfig loaded settings:', configData);
    mascots.value = configData.mascots || [];
    activeMascotId.value = configData.activeMascotId || '';
    console.log('[MascotViewer] activeMascotId updated to:', activeMascotId.value);
    console.log('[MascotViewer] Active mascot resolved:', mascots.value.find(m => m.id === activeMascotId.value));
};

onMounted(async () => {
    if (window.electronAPI) {
        // 初期設定のロード
        const configData = await window.electronAPI.getAppConfig();
        loadMascotConfig(configData);

        // 設定更新の購読
        unsubscribeConfig = window.electronAPI.onConfigUpdated((newConfig: any) => {
            loadMascotConfig(newConfig);
        });

        // プレビュー状態の購読
        unsubscribePreview = window.electronAPI.onApplyPreviewState((state: any) => {
            previewState.value = state;
        });

        // チャットウィンドウ開閉の検知
        window.electronAPI.onChatToggled((visible: boolean) => {
            isChatVisible.value = visible;
        });

        // 感情変化イベントの検知
        window.electronAPI.onEmotionChanged((emotion: string) => {
            currentEmotion.value = emotion.toLowerCase();

            // 表情変化時にポップアップアニメーションを実行
            emotionClass.value = 'emotion-pop';
            setTimeout(() => {
                emotionClass.value = '';
            }, 600);
        });
    }
});

onUnmounted(() => {
    if (unsubscribeConfig) {
        unsubscribeConfig();
    }
    if (unsubscribePreview) {
        unsubscribePreview();
    }
});
</script>

<template>
    <div class="mascot-wrapper app-dark">
        <!-- マスコットのキャラクター描画部分 -->
        <div class="mascot-character" @mousedown="onMouseDown" @contextmenu.prevent="openSettings" @dragstart.prevent>
            <div class="mascot-visual" :class="emotionClass">
                <!-- キャラクター本体表示 (ポーズ > 服装 > ベースアバター の順で優先) -->
                <!-- ポーズ優先 -->
                <template v-if="activePose">
                    <img v-if="activePose.path.startsWith('data:image/')" :src="activePose.path" class="preview-full-img" />
                    <span v-else class="preview-base-avatar">{{ activePose.path }}</span>
                </template>
                <!-- ポーズがなければ服装 -->
                <template v-else-if="activeOutfit">
                    <img v-if="activeOutfit.path.startsWith('data:image/')" :src="activeOutfit.path" class="preview-full-img" />
                    <span v-else class="preview-base-avatar">{{ activeOutfit.path }}</span>
                </template>
                <!-- 何もなければベースアバター (front画像を優先) -->
                <template v-else-if="activeMascot">
                    <img v-if="defaultFrontAvatar && defaultFrontAvatar.path.startsWith('data:image/')" :src="defaultFrontAvatar.path" class="preview-full-img" />
                    <img v-else-if="activeMascot.avatar.startsWith('data:image/')" :src="activeMascot.avatar" class="preview-full-img" />
                    <span v-else class="preview-base-avatar">{{ activeMascot.avatar }}</span>
                </template>
                <span v-else class="preview-base-avatar">🤖</span>
                
                <!-- 表情レイヤー (これのみ重ね合わせ可能とする) -->
                <img 
                    v-if="activeExpressionEmoji.startsWith('data:image/')" 
                    :src="activeExpressionEmoji" 
                    class="preview-layer-img expression"
                    :style="activeExpressionStyle"
                />
                <span v-else class="preview-layer expression" :style="activeExpressionStyle">{{ activeExpressionEmoji }}</span>
            </div>
            <div class="hover-tip no-drag">右クリックで設定</div>
        </div>
        
        <!-- コントロールボタン -->
        <div class="control-panel no-drag">
            <button class="control-btn" :class="{ active: isChatVisible }" @click="toggleChat" title="チャットを開く">
                <i class="pi pi-comments"></i>
            </button>
            <button class="control-btn" @click="openSettings" title="設定画面を開く">
                <i class="pi pi-cog"></i>
            </button>
        </div>
    </div>
</template>

<style scoped>
.mascot-wrapper {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
}

.mascot-character {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: grab;
    user-select: none;
}

.mascot-character:active {
    cursor: grabbing;
}

.mascot-visual {
    width: 180px;
    height: 180px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 110px;
    animation: float 4s ease-in-out infinite;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
}

.preview-base-avatar {
    position: absolute;
    z-index: 1;
}

.preview-layer {
    position: absolute;
}

.preview-layer.outfit {
    transform: translateY(30px) scale(0.85);
    z-index: 2;
}

.preview-layer.expression {
    transform: translateY(-10px) scale(0.38);
    z-index: 4;
}

.preview-layer.pose {
    transform: translateX(-40px) translateY(10px) scale(0.6);
    z-index: 3;
}

.hover-tip {
    font-size: 11px;
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.8);
    padding: 2px 8px;
    border-radius: 10px;
    margin-top: 8px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.mascot-character:hover .hover-tip {
    opacity: 1;
}

.control-panel {
    position: absolute;
    bottom: 20px;
    display: flex;
    gap: 12px;
    background: rgba(18, 18, 18, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 12px;
    border-radius: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.control-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.control-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
}

.control-btn.active {
    color: #a855f7; /* パープルのアクセント */
    background: rgba(168, 85, 247, 0.15);
}

.mascot-visual.emotion-pop {
    animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes float {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-8px);
    }
}

@keyframes popIn {
    0% {
        transform: scale(0.6);
        opacity: 0.5;
    }
    50% {
        transform: scale(1.2);
    }
    100% {
        transform: scale(1.0);
        opacity: 1;
    }
}

/* 画像アセットレイヤー用のスタイル */
.preview-full-img {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: contain;
    z-index: 1;
}
.preview-layer-img {
    position: absolute;
    object-fit: contain;
    pointer-events: none;
}
.preview-layer-img.expression {
    width: 60px;
    height: 60px;
    transform: translateY(-8px);
    z-index: 4;
}

</style>
