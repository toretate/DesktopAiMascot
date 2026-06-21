<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, watch } from 'vue';
import { MascotImageSetBuilder } from '../mascots/MascotImageSetBuilder';
import { useConfigStore } from '../store/config';
import { useMascotStore } from '../store/mascot';
import { storeToRefs } from 'pinia';
import { Application, Container, Sprite, Assets, Texture } from 'pixi.js';

const pixiCanvas = ref<HTMLCanvasElement | null>(null);
let pixiApp: Application | null = null;
let mascotContainer: Container | null = null;
let bodySprite: Sprite | null = null;
let expressionSprite: Sprite | null = null;

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
    if (path.startsWith('/mascots/')) {
        resolved = `http://${configStore.serverHost}:${configStore.serverPort}${path}`;
    }
    if (/^[a-zA-Z]:\\/.test(resolved)) {
        return resolved;
    }
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}v=${configStore.configVersion}`;
};


const isChatVisible = ref(false);
const emotionClass = ref('');
const isReady = ref(false); // 初期ロード完了フラグ
const isAssetsLoading = ref(false); // アセットロード中フラグ

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
    irodoriVoice,
    mascotBackgroundColor,
    mascotBackgroundOpacity,
    mascotBackgroundImage,
    mascotBackgroundImageOpacity,
    mascotBackgroundImageFit
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

// 衣装切り替えなどのバタつきを防止するための過渡期ロックフラグ
const isTransitioning = ref(false);
let transitionTimeoutId: NodeJS.Timeout | null = null;
let activeLoadCount = 0;

const triggerTransitionLock = () => {
    isAssetsLoading.value = true;
    isTransitioning.value = true;
    if (transitionTimeoutId) clearTimeout(transitionTimeoutId);
    transitionTimeoutId = setTimeout(() => {
        isTransitioning.value = false;
        if (activeLoadCount === 0) {
            isAssetsLoading.value = false;
            // 完全に完了した段階でスプライトを表示する
            if (bodySprite) bodySprite.visible = true;
            if (expressionSprite) expressionSprite.visible = true;
        }
    }, 450); // 最低450msはローディング画面を維持し、中途半端な描写のバタつきを防ぐ
};

const balloonText = ref('');
const balloonVisible = ref(false);
let balloonTimeoutId: NodeJS.Timeout | null = null;

// 音声再生用
import { AudioPlaylist } from '../utils/AudioPlaylist';
const playlist = new AudioPlaylist((speaking) => {
    mascotStore.setSpeaking(speaking);
});

const getMascotRgbaBackground = computed(() => {
    const hex = mascotBackgroundColor.value || '#ffffff';
    const opacity = mascotBackgroundOpacity.value !== undefined ? mascotBackgroundOpacity.value : 0.0;
    
    let r = 255, g = 255, b = 255;
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (match) {
        r = parseInt(match[1], 16);
        g = parseInt(match[2], 16);
        b = parseInt(match[3], 16);
    } else {
        const shortMatch = hex.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
        if (shortMatch) {
            r = parseInt(shortMatch[1] + shortMatch[1], 16);
            g = parseInt(shortMatch[2] + shortMatch[2], 16);
            b = parseInt(shortMatch[3] + shortMatch[3], 16);
        }
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
});

const mascotBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getMascotRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: -1
    };
    if (mascotBackgroundImage.value) {
        styles.backgroundImage = `url(${resolveImageUrl(mascotBackgroundImage.value)})`;
        styles.opacity = mascotBackgroundImageOpacity.value;
        
        if (mascotBackgroundImageFit.value === 'cover') {
            styles.backgroundSize = 'cover';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (mascotBackgroundImageFit.value === 'contain') {
            styles.backgroundSize = 'contain';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (mascotBackgroundImageFit.value === 'fill') {
            styles.backgroundSize = '100% 100%';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (mascotBackgroundImageFit.value === 'tile') {
            styles.backgroundSize = 'auto';
            styles.backgroundPosition = 'top left';
            styles.backgroundRepeat = 'repeat';
        }
    }
    return styles;
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

    // 表情の英語名と日本語名アセットのマッピング対応表
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

// 描画されるべき体の画像パスの解決
const currentBodyPath = computed(() => {
    if (activePose.value && isImage(activePose.value.path)) {
        return resolveImageUrl(activePose.value.path);
    }
    if (activeOutfit.value && isImage(activeOutfit.value.path)) {
        return resolveImageUrl(activeOutfit.value.path);
    }
    if (activeMascot.value) {
        if (defaultFrontAvatar.value && isImage(defaultFrontAvatar.value.path)) {
            return resolveImageUrl(defaultFrontAvatar.value.path);
        }
        if (isImage(activeMascot.value.avatar)) {
            return resolveImageUrl(activeMascot.value.avatar);
        }
    }
    return '';
});

// 描画されるべき表情の画像パスの解決
const currentExpressionPath = computed(() => {
    if (activeExpressionEmoji.value && isImage(activeExpressionEmoji.value)) {
        return resolveImageUrl(activeExpressionEmoji.value);
    }
    return '';
});

// 体（ポーズ・服装）テクスチャのロードと適用
// URLから非表示Imageを読み込んで、透過境界を計算してElectronに通知する
const updateCharacterBoundsFromUrl = (url: string) => {
    if (!url) return;
    const img = new Image();
    img.onload = () => {
        const bounds = getNonTransparentBounds(img);
        
        // 512x683 のコンテナ内での表示サイズを計算 (object-fit: contain)
        const containerW = 512;
        const containerH = 683;
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const containerAspect = containerW / containerH;
        
        let drawW = containerW;
        let drawH = containerH;
        let drawTop = 0;
        let drawLeft = 0;
        
        if (imgAspect > containerAspect) {
            drawH = containerW / imgAspect;
            drawTop = (containerH - drawH) / 2;
        } else {
            drawW = containerH * imgAspect;
            drawLeft = (containerW - drawW) / 2;
        }
        
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
    img.src = url;
};

const isBlinking = ref(false);
const isMouthOpen = ref(false);

let expressionNormalTexture: Texture | null = null;
let expressionCloseTexture: Texture | null = null;
let expressionTalkTexture: Texture | null = null;

// 体と表情のロード処理をアトミックかつ並列に行う関数
const loadMascotAssets = async (bodyPath: string, expressionPath: string) => {
    if (!pixiApp || !bodySprite || !expressionSprite) return;

    activeLoadCount++;
    isAssetsLoading.value = true;
    bodySprite.visible = false;
    expressionSprite.visible = false;

    // Vue にロード中状態（スピナー表示とキャラクター非表示）を確実に描画させる
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 80));

    try {

    const promises: Promise<any>[] = [];

    // 体画像のロードプロミス
    let bodyPromise: Promise<Texture | null> = Promise.resolve(null);
    if (bodyPath) {
        bodyPromise = Assets.load(bodyPath).catch(err => {
            console.error('[MascotViewer] Failed to load body texture:', bodyPath, err);
            return null;
        });
        promises.push(bodyPromise);
    }

    // 表情画像のロードプロミス
    let normalPromise: Promise<Texture | null> = Promise.resolve(null);
    let closePromise: Promise<Texture | null> = Promise.resolve(null);
    let talkPromise: Promise<Texture | null> = Promise.resolve(null);

    if (expressionPath) {
        normalPromise = Assets.load(expressionPath).catch(err => {
            console.error('[MascotViewer] Failed to load normal expression:', expressionPath, err);
            return null;
        });
        promises.push(normalPromise);

        const closePath = getSuffixPath(expressionPath, '_close');
        closePromise = Assets.load(closePath).catch(() => null); // _close は存在しない場合もあるのでエラー無視
        promises.push(closePromise);

        const talkPath = getSuffixPath(expressionPath, '_talk');
        talkPromise = Assets.load(talkPath).catch(() => null); // _talk も存在しない場合があるのでエラー無視
        promises.push(talkPromise);
    }

    // すべてのアセットを並列ロード
    await Promise.all(promises);

    // すべてのロードが完了した段階で、同時にスプライトへ適用する
    // 体画像の適用
    if (bodyPath) {
        const bodyTexture = await bodyPromise;
        if (bodySprite && bodyTexture) {
            bodySprite.texture = bodyTexture;
            
            // object-fit: contain の再現
            const containerW = 512;
            const containerH = 683;
            const aspect = bodyTexture.width / bodyTexture.height;
            const containerAspect = containerW / containerH;
            
            if (aspect > containerAspect) {
                bodySprite.width = containerW;
                bodySprite.height = containerW / aspect;
            } else {
                bodySprite.height = containerH;
                bodySprite.width = containerH * aspect;
            }
            bodySprite.x = containerW / 2;
            bodySprite.y = containerH / 2;
            bodySprite.anchor.set(0.5);

            // クリック透過領域の更新
            updateCharacterBoundsFromUrl(bodyPath);
        } else if (bodySprite) {
            bodySprite.texture = Texture.EMPTY;
        }
    } else if (bodySprite) {
        bodySprite.texture = Texture.EMPTY;
    }

    // 表情画像の適用
    if (expressionPath) {
        const normalTexture = await normalPromise;
        const closeTexture = await closePromise;
        const talkTexture = await talkPromise;

        if (expressionSprite && normalTexture) {
            expressionNormalTexture = normalTexture;
            expressionCloseTexture = closeTexture;
            expressionTalkTexture = talkTexture;

            refreshExpressionTexture();

            if (expressionCloseTexture) {
                startBlinkLoop();
            } else {
                stopBlinkLoop();
            }
        } else if (expressionSprite) {
            expressionNormalTexture = null;
            expressionCloseTexture = null;
            expressionTalkTexture = null;
            expressionSprite.texture = Texture.EMPTY;
            stopBlinkLoop();
        }
    } else if (expressionSprite) {
        expressionNormalTexture = null;
        expressionCloseTexture = null;
        expressionTalkTexture = null;
        expressionSprite.texture = Texture.EMPTY;
        stopBlinkLoop();
    }
    } finally {
        await nextTick();
        activeLoadCount--;
        // 他のアクティブロードがなく、かつトランジションロック期間も明けている場合のみ表示を復帰する
        if (activeLoadCount === 0 && !isTransitioning.value) {
            if (bodySprite) bodySprite.visible = true;
            if (expressionSprite) expressionSprite.visible = true;
            isAssetsLoading.value = false;
        }
    }
};

// マスコットのアセットを一括プリロードする関数
const preloadMascotAssets = async (mascot: any) => {
    if (!pixiApp || !mascot || !mascot.assets) return;

    const pathsToLoad: string[] = [];

    // outfits のパス
    if (Array.isArray(mascot.assets.outfits)) {
        for (const outfit of mascot.assets.outfits) {
            if (outfit.path && isImage(outfit.path)) {
                pathsToLoad.push(resolveImageUrl(outfit.path));
            }
            if (Array.isArray(outfit.expressions)) {
                for (const expr of outfit.expressions) {
                    if (expr.path && isImage(expr.path)) {
                        const path = resolveImageUrl(expr.path);
                        pathsToLoad.push(path);
                        pathsToLoad.push(getSuffixPath(path, '_close'));
                        pathsToLoad.push(getSuffixPath(path, '_talk'));
                    }
                }
            }
        }
    }

    // expressions のパス
    if (Array.isArray(mascot.assets.expressions)) {
        for (const expr of mascot.assets.expressions) {
            if (expr.path && isImage(expr.path)) {
                const path = resolveImageUrl(expr.path);
                pathsToLoad.push(path);
                pathsToLoad.push(getSuffixPath(path, '_close'));
                pathsToLoad.push(getSuffixPath(path, '_talk'));
            }
        }
    }

    // poses のパス
    if (Array.isArray(mascot.assets.poses)) {
        for (const pose of mascot.assets.poses) {
            if (pose.path && isImage(pose.path)) {
                pathsToLoad.push(resolveImageUrl(pose.path));
            }
        }
    }

    // 重複を排除
    const uniquePaths = Array.from(new Set(pathsToLoad.filter(p => !!p)));

    if (uniquePaths.length > 0) {
        console.log('[MascotViewer] Preloading assets for ' + mascot.name + ':', uniquePaths.length);
        Assets.backgroundLoad(uniquePaths).catch(err => {
            console.warn('[MascotViewer] Preloading failed:', err);
        });
    }
};

// クエリパラメータを壊さずに _close や _talk を拡張子の直前に入れるユーティリティ
const getSuffixPath = (path: string, suffix: string): string => {
    const parts = path.split('?');
    const basePath = parts[0];
    const query = parts[1] ? `?${parts[1]}` : '';
    const lastDot = basePath.lastIndexOf('.');
    if (lastDot !== -1) {
        return basePath.slice(0, lastDot) + suffix + basePath.slice(lastDot) + query;
    }
    return basePath + suffix + query;
};

// スプライトのテクスチャを状態に応じて更新
const refreshExpressionTexture = () => {
    if (!expressionSprite) return;

    let targetTexture = expressionNormalTexture || Texture.EMPTY;

    // 優先度：まばたき中 > 口パク中
    if (isBlinking.value && expressionCloseTexture) {
        targetTexture = expressionCloseTexture;
    } else if (isSpeaking.value && isMouthOpen.value && expressionTalkTexture) {
        targetTexture = expressionTalkTexture;
    }

    expressionSprite.texture = targetTexture;

    // 基準サイズ171pxに設定
    expressionSprite.width = 171;
    expressionSprite.height = 171;
    expressionSprite.anchor.set(0.5);

    // トランスフォームの適用
    applyExpressionTransform();
};

// まばたきループの制御
let blinkTimeoutId: NodeJS.Timeout | null = null;
const startBlinkLoop = () => {
    stopBlinkLoop();
    if (!expressionCloseTexture) return;

    const nextBlinkDelay = 3000 + Math.random() * 4000; // 3〜7秒のランダム
    blinkTimeoutId = setTimeout(async () => {
        if (expressionCloseTexture) {
            isBlinking.value = true;
            refreshExpressionTexture();
            
            // 150ms 目を閉じる
            await new Promise(resolve => setTimeout(resolve, 150));
            
            isBlinking.value = false;
            refreshExpressionTexture();
        }
        startBlinkLoop();
    }, nextBlinkDelay);
};

const stopBlinkLoop = () => {
    if (blinkTimeoutId) {
        clearTimeout(blinkTimeoutId);
        blinkTimeoutId = null;
    }
    isBlinking.value = false;
};

// 口パク（リップシンク）ループの制御
let talkIntervalId: NodeJS.Timeout | null = null;
const startTalkLoop = () => {
    stopTalkLoop();
    if (!expressionTalkTexture) return;

    talkIntervalId = setInterval(() => {
        isMouthOpen.value = !isMouthOpen.value;
        refreshExpressionTexture();
    }, 150); // 150ms 周期で口を開閉
};

const stopTalkLoop = () => {
    if (talkIntervalId) {
        clearInterval(talkIntervalId);
        talkIntervalId = null;
    }
    isMouthOpen.value = false;
    refreshExpressionTexture();
};

// 表情の位置合わせ（Transform）の適用
const applyExpressionTransform = () => {
    if (!expressionSprite) return;
    const found = activeExpression.value;
    if (!found) {
        expressionSprite.x = 512 / 2;
        expressionSprite.y = 683 / 2;
        expressionSprite.scale.set(1);
        expressionSprite.rotation = 0;
        return;
    }

    // previewStateがある場合でも、それが現在の衣装(outfit)および表情アセットのIDと一致する場合のみプレビューの調整値を適用する。
    // 衣装変更などでIDがずれている場合は、アセット本来の設定値（found.*）を優先する。
    const isMatchingPreview = previewState.value && 
                              previewState.value.outfitId === activeOutfit.value?.id &&
                              previewState.value.expressionId === found.id;

    const ox = isMatchingPreview ? (previewState.value.expressionOffsetX ?? 0) : (found.offsetX ?? 0);
    const oy = isMatchingPreview ? (previewState.value.expressionOffsetY ?? 0) : (found.offsetY ?? 0);
    const sc = isMatchingPreview ? (previewState.value.expressionScale ?? 1) : (found.scale ?? 1);
    const rot = isMatchingPreview ? (previewState.value.expressionRotation ?? 0) : (found.rotation ?? 0);

    const scaleFactor = 512 / 420;
    const scaledOx = ox * scaleFactor;
    const scaledOy = oy * scaleFactor;

    // 中央原点に対するオフセット調整
    expressionSprite.x = (512 / 2) + scaledOx;
    expressionSprite.y = (683 / 2) + scaledOy;
    
    // スケール適用 (テクスチャ本来のサイズに対する 171px の基本スケール比に sc を乗算)
    const textureWidth = expressionSprite.texture?.width;
    const baseScale = (textureWidth && textureWidth > 1) ? (171 / textureWidth) : 1;
    expressionSprite.scale.set(baseScale * sc);
    
    // 回転の適用 (角度からラジアン)
    expressionSprite.rotation = rot * (Math.PI / 180);
};

// パスの変更を監視
// パスの変更を監視してアトミックにロードを実行
watch([currentBodyPath, currentExpressionPath], async ([newBodyPath, newExpressionPath]) => {
    await loadMascotAssets(newBodyPath, newExpressionPath);
}, { flush: 'sync' });

// activeMascot の変更を監視してプリロードを実行
watch(activeMascot, (newMascot) => {
    preloadMascotAssets(newMascot);
});

// isSpeaking（音声再生状態）を監視して口パクの開始・停止
watch(isSpeaking, (speaking) => {
    if (speaking) {
        startTalkLoop();
    } else {
        stopTalkLoop();
    }
});

// アニメーション状態フラグの監視による表示更新
watch([isBlinking, isMouthOpen], () => {
    refreshExpressionTexture();
});

// 表情の位置・スケール等の設定変更を監視
watch([
    () => activeExpression.value,
    () => previewState.value?.expressionId,
    () => previewState.value?.expressionOffsetX,
    () => previewState.value?.expressionOffsetY,
    () => previewState.value?.expressionScale,
    () => previewState.value?.expressionRotation
], () => {
    applyExpressionTransform();
}, { deep: true });

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

        if (window.electronAPI && window.electronAPI.dragWindow) {
            window.electronAPI.dragWindow({ dx: 0, dy: 0, isStart: true });
        }

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

    if (window.electronAPI && window.electronAPI.dragWindow) {
        window.electronAPI.dragWindow({ dx: 0, dy: 0, isEnd: true });
    }

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
    // PixiJS Application の初期化
    if (pixiCanvas.value) {
        try {
            pixiApp = new Application();
            await pixiApp.init({
                canvas: pixiCanvas.value,
                width: 512,
                height: 683,
                backgroundAlpha: 0,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });
            console.log('[MascotViewer] PixiJS Application initialized successfully.');

            // マスコットの描画構造を構築
            mascotContainer = new Container();
            pixiApp.stage.addChild(mascotContainer);

            bodySprite = new Sprite();
            expressionSprite = new Sprite();
            mascotContainer.addChild(bodySprite);
            mascotContainer.addChild(expressionSprite);

            // マスコットのアセットをプリロード
            if (activeMascot.value) {
                preloadMascotAssets(activeMascot.value);
            }
        } catch (err) {
            console.error('[MascotViewer] Failed to initialize PixiJS Application:', err);
        }
    }

    // ストアの設定データを初期ロード
    if (!configStore.isLoaded) {
        await configStore.loadConfig();
    }

    // マウス透過制御用のイベント登録
    window.addEventListener('mousemove', handleWindowMouseMove);

    if (window.electronAPI) {
        // プレビュー状態の購読
        unsubscribePreview = window.electronAPI.onApplyPreviewState((state: any) => {
            triggerTransitionLock();
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
            triggerTransitionLock();
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
            const voiceEngine = activeMascot.value?.aiConfig?.voice?.engine || selectedVoiceEngine.value || 'voicevox';
            const speakerId = activeMascot.value?.aiConfig?.voice?.speaker_id !== undefined 
                ? activeMascot.value.aiConfig.voice.speaker_id 
                : (voicevoxSpeaker.value !== undefined ? voicevoxSpeaker.value : 2);
            const voicevoxEndpointUrl = voicevoxEndpoint.value || 'http://localhost:50021';
            const irodoriEndpointUrl = irodoriEndpoint.value || 'http://localhost:7861';
            const irodoriModelName = activeMascot.value?.aiConfig?.voice?.irodori_model || irodoriModel.value || 'irodori-tts-500m-v3';
            const irodoriVoiceName = activeMascot.value?.aiConfig?.voice?.irodori_voice || irodoriVoice.value || 'default';

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

    // PixiJS のスプライト作成完了後、初期画像パスの読み込みを明示的に実行する
    await loadMascotAssets(currentBodyPath.value, currentExpressionPath.value);

    // 初期ロード完了
    isReady.value = true;
});



onUnmounted(() => {
    if (pixiApp) {
        if (mascotContainer) {
            mascotContainer.destroy({ children: true });
            mascotContainer = null;
        }
        pixiApp.destroy({ removeView: true });
        pixiApp = null;
        console.log('[MascotViewer] PixiJS Application destroyed.');
    }

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
    <div class="mascot-wrapper app-dark" :class="{ 'is-compact': windowMode === 'compact', 'is-ready': isReady && !isAssetsLoading }">
        <!-- 背景レイヤー -->
        <div class="mascot-background" :style="mascotBackgroundStyle"></div>
        <!-- ローディングインジケーター -->
        <div v-if="isAssetsLoading || !isReady" class="mascot-loading-overlay">
            <i class="pi pi-spin pi-spinner text-4xl text-purple-500"></i>
        </div>
        <!-- マスコットのキャラクター描画部分 (トータルスケールで拡大縮小。元のコンパイル済みで動作確認済みの拡大縮小ロジック) -->
        <div 
            class="mascot-character" 
            :style="{ 
                transform: `scale(${totalMascotScale})`,
                transformOrigin: windowMode === 'compact' ? 'bottom center' : 'center center'
            }"
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
                <!-- PixiJS 描画キャンバス -->
                <canvas ref="pixiCanvas" class="pixi-canvas"></canvas>

                <!-- キャラクター本体表示 (画像以外はフォールバックテキストで表示、画像はPixiJSで描画) -->
                <template v-if="!isAssetsLoading">
                    <!-- ポーズ優先 -->
                    <template v-if="activePose">
                        <span v-if="!isImage(activePose.path)" class="preview-base-avatar">{{ activePose.path }}</span>
                    </template>
                    <!-- ポーズがなければ服装 -->
                    <template v-else-if="activeOutfit">
                        <span v-if="!isImage(activeOutfit.path)" class="preview-base-avatar">{{ activeOutfit.path }}</span>
                    </template>
                    <!-- 何もなければベースアバター -->
                    <template v-else-if="activeMascot">
                        <span v-if="(!defaultFrontAvatar || !isImage(defaultFrontAvatar.path)) && !isImage(activeMascot.avatar)" class="preview-base-avatar">
                            {{ defaultFrontAvatar?.path || activeMascot.avatar }}
                        </span>
                    </template>
                    <span v-else class="preview-base-avatar">🤖</span>
                    
                    <!-- 表情レイヤー (画像以外はフォールバックの絵文字表示、画像はPixiJSで描画) -->
                    <span v-if="!isImage(activeExpressionEmoji)" class="preview-layer expression" :style="activeExpressionStyle">{{ activeExpressionEmoji }}</span>
                </template>
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

.mascot-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
    pointer-events: none;
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
    transition: transform 0.1s ease-out, opacity 0.25s ease-in-out;
    opacity: 0;
}

.mascot-wrapper.is-ready .mascot-character {
    opacity: 1;
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

.mascot-wrapper.is-compact {
    width: 100% !important;
    height: 100% !important;
    justify-content: flex-end !important;
}

.is-compact .mascot-character {
    transform-origin: bottom center !important;
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

.pixi-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
    background-color: transparent !important;
}

.mascot-loading-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}

</style>
