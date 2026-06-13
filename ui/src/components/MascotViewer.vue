<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue';
import { MascotImageSetBuilder } from '../mascots/MascotImageSetBuilder';
import { useConfigStore } from '../store/config';
import { useMascotStore } from '../store/mascot';
import { storeToRefs } from 'pinia';

const isChatVisible = ref(false);
const emotionClass = ref('');

// ---- Stores ----
const configStore = useConfigStore();
const mascotStore = useMascotStore();

const {
    activeMascot,
    mascots,
    activeMascotId,
    mascotScale,
    windowMode,
    selectedVoiceEngine,
    voicevoxSpeaker,
    voicevoxEndpoint,
    irodoriEndpoint,
    irodoriModel,
    irodoriVoice
} = storeToRefs(configStore);

const {
    currentEmotion,
    isSpeaking
} = storeToRefs(mascotStore);

// プレビュー用の臨時オーバーライド状態
const previewState = ref<{
    outfitId?: string;
    poseId?: string;
    expressionId?: string;
    expressionOffsetX?: number;
    expressionOffsetY?: number;
    expressionScale?: number;
    expressionRotation?: number;
} | null>(null);

let unsubscribePreview: (() => void) | null = null;
let unsubscribeConfig: (() => void) | null = null;
let unsubscribeTimer: (() => void) | null = null;

const balloonText = ref('');
const balloonVisible = ref(false);
let balloonTimeoutId: NodeJS.Timeout | null = null;

// 音声再生用
import { AudioPlaylist } from '../utils/AudioPlaylist';
const playlist = new AudioPlaylist((speaking) => {
    mascotStore.setSpeaking(speaking);
});

const activeMascotImageSet = computed(() => {
    const mascot = activeMascot.value;
    if (!mascot) return null;
    
    const assets = [
        ...(mascot.assets?.outfits || []),
        ...(activeOutfit.value?.expressions || []),
        ...(mascot.assets?.poses || [])
    ];
    
    return MascotImageSetBuilder.CreateFromAssets(mascot.name, assets);
});

// 現在選択されている服装アセット
const activeOutfit = computed(() => {
    const mascot = activeMascot.value;
    if (!mascot || !mascot.assets?.outfits) return null;
    
    // previewState がある場合はその outfitId を優先
    const outfitId = previewState?.value?.outfitId;
    if (outfitId !== undefined) {
        const found = mascot.assets.outfits.find((o: any) => o.id === outfitId);
        if (found) return found;
    }
    
    // previewState がない、または見つからない場合は現在の設定値を参照
    return mascot.assets.outfits.find((o: any) => o.id === mascot.currentOutfitId) || mascot.assets.outfits[0] || null;
});

// 現在のポーズアセット
const activePose = computed(() => {
    const mascot = activeMascot.value;
    if (!mascot || !mascot.assets?.poses) return null;
    
    // previewState がある場合はその poseId を優先（明示的な空指定も考慮）
    const targetId = (previewState.value && previewState.value.poseId !== undefined) 
        ? previewState.value.poseId 
        : mascot.currentPoseId;
        
    if (!targetId) return null;
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
    
    const expressions = activeOutfit.value?.expressions || [];

    // 1. プレビュー中なら指定されたアセットを強制表示
    if (previewState.value?.expressionId) {
        const found = expressions.find((e: any) => e.id === previewState.value?.expressionId);
        if (found) return found;
    }

    // 2. 会話中の感情(currentEmotion)の正規化
    const normalized = currentEmotion.value.toLowerCase().trim();

    // 2.2 アイドル待機状態(neutral)で、マスコットに指定された標準表情(defaultExpressionId)がある場合はそれを最優先で使用
    if ((normalized === 'neutral' || normalized === '通常' || normalized === 'normal') && mascot.defaultExpressionId) {
        const foundDefault = expressions.find((expr: any) => expr.id === mascot.defaultExpressionId);
        if (foundDefault && foundDefault.path) return foundDefault;
    }

    // 2.3 MascotImageSetから感情に応じた表情を明示的に取得
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

    if (normalized) {
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

    // 3. キーワードマッピングによる解決
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
    
    if (mascot.defaultExpressionId) {
        const foundDefault = expressions.find((expr: any) => expr.id === mascot.defaultExpressionId);
        if (foundDefault && foundDefault.path) return foundDefault;
    }

    const normalKeywords = ['通常', 'normal', 'neutral', '普通', '🤖', '😊'];
    const normalExpr = expressions.find((expr: any) => 
        normalKeywords.some(kw => expr.name.includes(kw) || expr.id.toLowerCase().includes(kw))
    );
    if (normalExpr) return normalExpr;
    
    if (expressions.length > 0) {
        return expressions[0];
    }
    
    return null;
});

// 感情に連動した表情アセットの動的な解決
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
        const ox = previewState.value ? (previewState.value.expressionOffsetX ?? 0) : (found.offsetX ?? 0);
        const oy = previewState.value ? (previewState.value.expressionOffsetY ?? 0) : (found.offsetY ?? 0);
        const sc = previewState.value ? (previewState.value.expressionScale ?? 1) : (found.scale ?? 1);
        const rot = previewState.value ? (previewState.value.expressionRotation ?? 0) : (found.rotation ?? 0);

        // 表情エディタのベースサイズ（420px）とマスコットウィンドウ（512px）のスケール比率を適用して
        // 位置調整パラメータがデスクトップ上でも正確に再現されるように補正する。
        const scaleFactor = 512 / 420;
        const scaledOx = ox * scaleFactor;
        const scaledOy = oy * scaleFactor;

        return {
            transform: `translate(${scaledOx}px, ${scaledOy}px) scale(${sc}) rotate(${rot}deg)`
        };
    }
    
    return {};
});

// 既定の正面画像
const defaultFrontAvatar = computed(() => {
    return activeMascotImageSet.value?.getFrontImage() || null;
});

// トータルスケール値の計算 (余計な縮小スケールを廃止し、設定スライダーの scale 値を等倍基準としてそのまま適用。ただしコンパクトモード時は 0.5 固定とする)
const totalMascotScale = computed(() => {
    if (windowMode.value === 'compact') {
        return 0.5;
    }
    return mascotScale.value || 1.0;
});

const getNonTransparentBounds = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 1;
    canvas.height = img.naturalHeight || 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { top: 0, bottom: canvas.height, left: 0, right: canvas.width };
    
    ctx.drawImage(img, 0, 0);
    let imgData;
    try {
        imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
        return { top: 0, bottom: canvas.height, left: 0, right: canvas.width };
    }
    const data = imgData.data;
    
    let minX = canvas.width;
    let maxX = 0;
    let minY = canvas.height;
    let maxY = 0;
    
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    
    if (maxX < minX || maxY < minY) {
        return { top: 0, bottom: canvas.height, left: 0, right: canvas.width };
    }
    
    return { top: minY, bottom: maxY, left: minX, right: maxX };
};

const onImageLoad = (event: Event) => {
    const img = event.target as HTMLImageElement;
    if (!img) return;

    if (!img.naturalWidth || !img.naturalHeight) return;

    const imgRect = img.getBoundingClientRect();
    const imgW = imgRect.width;
    const imgH = imgRect.height;
    
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const rectAspect = imgW / imgH;
    
    let drawW = imgW;
    let drawH = imgH;
    let drawTop = imgRect.top;
    let drawLeft = imgRect.left;
    
    if (imgAspect > rectAspect) {
        drawH = imgW / imgAspect;
        drawTop = imgRect.top + (imgH - drawH) / 2;
    } else {
        drawW = imgH * imgAspect;
        drawLeft = imgRect.left + (imgW - drawW) / 2;
    }
    
    const bounds = getNonTransparentBounds(img);
    const relativeTop = bounds.top / img.naturalHeight;
    const relativeBottom = bounds.bottom / img.naturalHeight;
    const relativeLeft = bounds.left / img.naturalWidth;
    const relativeRight = bounds.right / img.naturalWidth;
    
    const charTop = drawTop + relativeTop * drawH;
    const charBottom = drawTop + relativeBottom * drawH;
    const charLeft = drawLeft + relativeLeft * drawW;
    const charRight = drawLeft + relativeRight * drawW;
    
    if (
        Number.isFinite(charTop) && 
        Number.isFinite(charBottom) && 
        Number.isFinite(charLeft) && 
        Number.isFinite(charRight)
    ) {
        if (window.electronAPI && window.electronAPI.updateCharacterBounds) {
            window.electronAPI.updateCharacterBounds({
                top: charTop,
                bottom: charBottom,
                left: charLeft,
                right: charRight
            });
        }
    }
};

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
    if (e.button === 0) {
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
        toggleChat();
    }
};

// --- Ctrl + マウスホイールによるその場サイズ変更 ---
const onWheel = (e: WheelEvent) => {
    if (windowMode.value === 'compact') return; // コンパクト表示時はサイズ変更無効
    if (e.ctrlKey) {
        e.preventDefault(); // 既定のズーム動作を抑制
        
        const scaleStep = 0.1;
        const currentScale = configStore.mascotScale || 1.0;
        let newScale = currentScale;
        
        if (e.deltaY < 0) {
            // 上スクロール -> 拡大
            newScale = Math.min(2.0, currentScale + scaleStep);
        } else {
            // 下スクロール -> 縮小
            newScale = Math.max(0.5, currentScale - scaleStep);
        }
        
        // 小数点第1位までに丸める (浮動小数点の誤差対策)
        newScale = Math.round(newScale * 10) / 10;
        
        if (newScale !== currentScale && window.electronAPI && window.electronAPI.setMascotScale) {
            window.electronAPI.setMascotScale(newScale);
        }
    }
};

// ---- Watchers ----
// 感情変化のリアクティブ監視による演出アニメーション
watch(() => mascotStore.currentEmotion, () => {
    emotionClass.value = 'emotion-pop';
    setTimeout(() => {
        emotionClass.value = '';
    }, 600);
});

// --- マウス透過の動的制御 ---
const handleWindowMouseMove = (e: MouseEvent) => {
    // 統合・コンパクトモードなど、分割モード以外ではマウスイベントの透過制御は行わない
    if (windowMode.value && windowMode.value !== 'split') return;

    // ドラッグ中は透過処理をスキップしてドラッグ操作の追従を維持する
    if (isDragging.value) return;

    if (!window.electronAPI || !window.electronAPI.setIgnoreMouseEvents) return;
    
    const target = e.target as HTMLElement;
    if (!target) return;
    
    // キャラクターのコンテナまたはその内部の要素であるか判定
    const isOnInteractiveElement = 
        target.closest('.mascot-character') !== null;
    
    window.electronAPI.setIgnoreMouseEvents(!isOnInteractiveElement);
};

onMounted(async () => {
    // ストアの設定データを初期ロード
    if (!configStore.isLoaded) {
        await configStore.loadConfig();
    }

    // マウス透過制御用のイベント登録
    window.addEventListener('mousemove', handleWindowMouseMove);

    if (window.electronAPI) {
        // プレビュー状態の購読
        unsubscribePreview = window.electronAPI.onApplyPreviewState((state: any) => {
            previewState.value = state;
        });

        // チャットウィンドウ開閉の検知
        window.electronAPI.onChatToggled((visible: boolean) => {
            isChatVisible.value = visible;
        });

        // 後方互換性および外部連携のための感情変化イベントの検知
        window.electronAPI.onEmotionChanged((emotion: string) => {
            mascotStore.setEmotion(emotion);
        });

        // 設定更新の購読
        unsubscribeConfig = window.electronAPI.onConfigUpdated((newConfig: any) => {
            console.log('[MascotViewer] Config updated via IPC:', newConfig);
            configStore.updateConfig(newConfig);
            // 正式な設定が届いたらプレビュー状態をクリアする
            previewState.value = null;
        });

        // タイマー満了イベントの購読
        unsubscribeTimer = window.electronAPI.onTimerTrigger(async (memo: string) => {
            console.log('[MascotViewer] Timer triggered via IPC:', memo);

            // 表情を「surprised」に変更
            mascotStore.setEmotion('surprised');

            // 吹き出しを表示
            balloonText.value = memo;
            balloonVisible.value = true;

            // 8秒後に吹き出しを消す
            if (balloonTimeoutId) clearTimeout(balloonTimeoutId);
            balloonTimeoutId = setTimeout(() => {
                balloonVisible.value = false;
            }, 8000);

            // VOICEVOX/IrodoriTTSによる音声合成と再生
            const voiceEngine = selectedVoiceEngine.value || activeMascot.value?.aiConfig?.voice?.engine || 'voicevox';
            const speakerId = activeMascot.value?.aiConfig?.voice?.speaker_id !== undefined 
                ? activeMascot.value.aiConfig.voice.speaker_id 
                : (voicevoxSpeaker.value !== undefined ? voicevoxSpeaker.value : 2);
            const voicevoxEndpointUrl = voicevoxEndpoint.value || 'http://localhost:50021';
            const irodoriEndpointUrl = irodoriEndpoint.value || 'http://localhost:7861';
            const irodoriModelName = irodoriModel.value || 'irodori-tts-500m-v3';
            const irodoriVoiceName = irodoriVoice.value || 'default';

            if (window.electronAPI) {
                try {
                    let base64Audio: string | null = null;
                    if (voiceEngine === 'irodori') {
                        base64Audio = await window.electronAPI.synthesizeIrodori(memo, irodoriEndpointUrl, irodoriModelName, irodoriVoiceName, 'surprised');
                    } else {
                        base64Audio = await window.electronAPI.synthesizeVoicevox(memo, speakerId, voicevoxEndpointUrl);
                    }
                    if (base64Audio) {
                        playlist.stop();
                        playlist.push(base64Audio);
                    }
                } catch (err) {
                    console.error('[MascotViewer] Failed to synthesize timer alert voice:', err);
                }
            }
        });
    }
});

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

onUnmounted(() => {
    window.removeEventListener('mousemove', handleWindowMouseMove);

    if (unsubscribePreview) {
        unsubscribePreview();
    }
    if (unsubscribeConfig) {
        unsubscribeConfig();
    }
    if (unsubscribeTimer) {
        unsubscribeTimer();
    }
    if (balloonTimeoutId) {
        clearTimeout(balloonTimeoutId);
    }
});
</script>

<template>
    <div class="mascot-wrapper app-dark" :class="{ 'is-compact': windowMode === 'compact' }">
        <!-- マスコットのキャラクター描画部分 (トータルスケールで拡大縮小。元のコンパイル済みで動作確認済みの拡大縮小ロジック) -->
        <div 
            class="mascot-character" 
            :style="{ transform: `scale(${totalMascotScale})` }"
            @mousedown="onMouseDown" 
            @contextmenu.prevent="openSettings" 
            @dragstart.prevent 
            @wheel="onWheel"
        >
            <!-- 吹き出し -->
            <transition name="fade">
                <div v-if="balloonVisible" class="speech-balloon no-drag">
                    <p>{{ balloonText }}</p>
                </div>
            </transition>

            <div class="mascot-visual" :class="emotionClass">
                <!-- キャラクター本体表示 (ポーズ > 服装 > ベースアバター の順で優先) -->
                <!-- ポーズ優先 -->
                <template v-if="activePose">
                    <img v-if="isImage(activePose.path)" :src="resolveImageUrl(activePose.path)" class="preview-full-img" @load="onImageLoad" />
                    <span v-else class="preview-base-avatar">{{ activePose.path }}</span>
                </template>
                <!-- ポーズがなければ服装 -->
                <template v-else-if="activeOutfit">
                    <img v-if="isImage(activeOutfit.path)" :src="resolveImageUrl(activeOutfit.path)" class="preview-full-img" @load="onImageLoad" />
                    <span v-else class="preview-base-avatar">{{ activeOutfit.path }}</span>
                </template>
                <!-- 何もなければベースアバター (front画像を優先) -->
                <template v-else-if="activeMascot">
                    <img v-if="defaultFrontAvatar && isImage(defaultFrontAvatar.path)" :src="resolveImageUrl(defaultFrontAvatar.path)" class="preview-full-img" @load="onImageLoad" />
                    <img v-else-if="isImage(activeMascot.avatar)" :src="resolveImageUrl(activeMascot.avatar)" class="preview-full-img" @load="onImageLoad" />
                    <span v-else class="preview-base-avatar">{{ activeMascot.avatar }}</span>
                </template>
                <span v-else class="preview-base-avatar">🤖</span>
                
                <!-- 表情レイヤー (これのみ重ね合わせ可能とする) -->
                <img 
                    v-if="isImage(activeExpressionEmoji)" 
                    :src="resolveImageUrl(activeExpressionEmoji)" 
                    class="preview-layer-img expression"
                    :style="activeExpressionStyle"
                />
                <span v-else class="preview-layer expression" :style="activeExpressionStyle">{{ activeExpressionEmoji }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.speech-balloon {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-10px);
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid #a855f7;
    border-radius: 16px;
    padding: 10px 16px;
    width: max-content;
    max-width: 250px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    z-index: 100;
    color: #1e293b;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    word-break: break-all;
}

.speech-balloon::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 10px 8px 0;
    border-style: solid;
    border-color: rgba(255, 255, 255, 0.95) transparent transparent;
    display: block;
    width: 0;
}

.speech-balloon::before {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 12px 10px 0;
    border-style: solid;
    border-color: #a855f7 transparent transparent;
    display: block;
    width: 0;
    z-index: -1;
    margin-top: 1px;
}

.speech-balloon p {
    margin: 0;
    line-height: 1.4;
}

.fade-enter-active, .fade-leave-active {
    transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from, .fade-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(0px);
}

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
    transform-origin: center center;
    transition: transform 0.1s ease-out;
}

.mascot-character:active {
    cursor: grabbing;
}

.mascot-visual {
    width: 512px;
    height: 683px;
    position: relative; /* フレックスコンテナ内のフロー配置に戻す */
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 250px;
    animation: float 4s ease-in-out infinite;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
}

.is-compact .mascot-visual {
    margin-bottom: -60px; /* 下部の透明余白分を相殺して底面に密着させる */
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
    transform: translateY(0px) scale(0.406);
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
    transform-origin: center top;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

.mascot-character:hover .hover-tip {
    opacity: 1;
}

.control-panel {
    display: flex;
    gap: 12px;
    background: rgba(18, 18, 18, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 12px;
    border-radius: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    transform-origin: center top; /* 逆スケール変形の基準点を上部に設定し、マージン計算を安定化 */
    z-index: 10;
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
    width: 171px;
    height: 171px;
    z-index: 4;
}

</style>
