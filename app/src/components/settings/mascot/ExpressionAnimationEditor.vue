<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue';
import { useConfigStore } from '../../../store/config';
import Button from 'primevue/button';
import Slider from 'primevue/slider';

const configStore = useConfigStore();

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    originalPath?: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
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
}>();

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

// プレビュー表示するベースマスコット画像の解決（のっぺらぼう優先）
const baseMascotImageUrl = computed(() => {
    // ユーザーが生成済みののっぺらぼう画像があればそれを使う
    const nofacePath = `/mascots/users/usr_local_dev_bypass/${props.editingMascot.id}/noface.png`;
    return nofacePath;
});

const currentExpressions = computed(() => {
    return props.activeOutfit?.expressions || props.editingMascot.assets?.expressions || [];
});

// アニメーション用状態
const isPlaying = ref(false);
const animationSpeed = ref(1.0); // 再生速度
const activeBlinkFrame = ref<'open' | 'half' | 'closed'>('open');
const activeMouthFrame = ref<'closed' | 'a' | 'i' | 'u' | 'e' | 'o'>('closed');

// 生成されたパーツ画像パスのキャッシュ
const partsCache = ref<{
    eyes: { open: string; half: string; closed: string };
    mouth: { closed: string; a: string; i: string; u: string; e: string; o: string };
}>({
    eyes: { open: '', half: '', closed: '' },
    mouth: { closed: '', a: '', i: '', u: '', e: '', o: '' }
});

const isGeneratingParts = ref(false);
const isPackingAtlas = ref(false);
const packingResult = ref<string | null>(null);

// パーツ座標・スケール設定
const eyeTransform = ref({ offsetX: 0, offsetY: 0, scale: 1.0, rotation: 0 });
const mouthTransform = ref({ offsetX: 0, offsetY: 0, scale: 1.0, rotation: 0 });

// アニメーションループタイマー
let animTimer: number | null = null;
let animFrameCount = 0;

const startAnimation = () => {
    if (isPlaying.value) return;
    isPlaying.value = true;
    
    const loop = () => {
        if (!isPlaying.value) return;
        animFrameCount++;
        
        // 瞬きアニメーション (一定時間ごとにまばたき)
        const blinkCycle = Math.round(120 / animationSpeed.value); // 約2秒ごと
        const frameInCycle = animFrameCount % blinkCycle;
        if (frameInCycle === 0) {
            activeBlinkFrame.value = 'half';
        } else if (frameInCycle === 1) {
            activeBlinkFrame.value = 'closed';
        } else if (frameInCycle === 2) {
            activeBlinkFrame.value = 'half';
        } else if (frameInCycle >= 3) {
            activeBlinkFrame.value = 'open';
        }
        
        // 口パクアニメーション (ランダムまたは順次母音切り替え)
        const mouthCycle = Math.round(15 / animationSpeed.value);
        if (animFrameCount % mouthCycle === 0) {
            const mouths: Array<'closed' | 'a' | 'i' | 'u' | 'e' | 'o'> = ['closed', 'a', 'i', 'u', 'e', 'o'];
            activeMouthFrame.value = mouths[Math.floor(Math.random() * mouths.length)];
        }
        
        animTimer = window.setTimeout(loop, 1000 / 30); // 30 FPS基準
    };
    
    loop();
};

const stopAnimation = () => {
    isPlaying.value = false;
    if (animTimer) {
        clearTimeout(animTimer);
        animTimer = null;
    }
    activeBlinkFrame.value = 'open';
    activeMouthFrame.value = 'closed';
};

// 4.1: スプライト自動抽出
const generatePartsFromSprites = async () => {
    isGeneratingParts.value = true;
    packingResult.value = null;
    try {
        // 現在登録されている表情から、代表的なものを抽出元として取得
        const normalExpr = currentExpressions.value.find(e => e.name === '通常' && e.path);
        const joyExpr = currentExpressions.value.find(e => e.name === '笑顔' && e.path) || normalExpr;
        const sadExpr = currentExpressions.value.find(e => e.name === '悲しみ' && e.path) || normalExpr;
        
        if (!normalExpr || !normalExpr.path) {
            alert('基準となる「通常」表情の画像が登録されていません。先に「3.表情位置」で画像設定を完了してください。');
            isGeneratingParts.value = false;
            return;
        }

        // デモ用として、登録された表情アセットパスから目と口のパーツスプライトプレビューを疑似抽出
        // 実際には Python の detect-face-mask/crop-expression で切り抜かれた画像データを設定します。
        // ここでは、のっぺらぼうとの差分抽出したプレビュー画像として、元の画像パスから直接座標切り抜きして表示するようにセットします。
        partsCache.value.eyes.open = normalExpr.path;
        partsCache.value.eyes.half = joyExpr?.path || normalExpr.path;
        partsCache.value.eyes.closed = sadExpr?.path || normalExpr.path;
        
        partsCache.value.mouth.closed = normalExpr.path;
        partsCache.value.mouth.a = joyExpr?.path || normalExpr.path;
        partsCache.value.mouth.i = normalExpr.path;
        partsCache.value.mouth.u = normalExpr.path;
        partsCache.value.mouth.e = normalExpr.path;
        partsCache.value.mouth.o = normalExpr.path;

        // 読み込み時の初期位置（通常表情に合わせる）
        eyeTransform.value.offsetX = normalExpr.offsetX || 0;
        eyeTransform.value.offsetY = normalExpr.offsetY || 0;
        eyeTransform.value.scale = normalExpr.scale || 1.0;
        eyeTransform.value.rotation = normalExpr.rotation || 0;
        
        mouthTransform.value.offsetX = normalExpr.offsetX || 0;
        mouthTransform.value.offsetY = normalExpr.offsetY || 0;
        mouthTransform.value.scale = normalExpr.scale || 1.0;
        mouthTransform.value.rotation = normalExpr.rotation || 0;

        console.log('[AnimationEditor] Facial parts extraction simulated successfully.');
        startAnimation();
    } catch (e) {
        console.error('Failed to generate parts:', e);
        alert('表情パーツの自動抽出に失敗しました。');
    } finally {
        isGeneratingParts.value = false;
    }
};

// 4.4: アトラス作成実行
const handlePackAtlas = async () => {
    if (!partsCache.value.eyes.open) {
        alert('表情パーツが抽出されていません。先に「表情パーツ抽出」を実行してください。');
        return;
    }
    
    isPackingAtlas.value = true;
    packingResult.value = null;
    
    try {
        // パッキング対象のパーツリストを構築
        const partsList = [
            { name: 'eyes_open', path: partsCache.value.eyes.open, offsetX: eyeTransform.value.offsetX, offsetY: eyeTransform.value.offsetY },
            { name: 'eyes_half', path: partsCache.value.eyes.half, offsetX: eyeTransform.value.offsetX, offsetY: eyeTransform.value.offsetY },
            { name: 'eyes_closed', path: partsCache.value.eyes.closed, offsetX: eyeTransform.value.offsetX, offsetY: eyeTransform.value.offsetY },
            { name: 'mouth_closed', path: partsCache.value.mouth.closed, offsetX: mouthTransform.value.offsetX, offsetY: mouthTransform.value.offsetY },
            { name: 'mouth_a', path: partsCache.value.mouth.a, offsetX: mouthTransform.value.offsetX, offsetY: mouthTransform.value.offsetY },
            { name: 'mouth_i', path: partsCache.value.mouth.i, offsetX: mouthTransform.value.offsetX, offsetY: mouthTransform.value.offsetY },
            { name: 'mouth_u', path: partsCache.value.mouth.u, offsetX: mouthTransform.value.offsetX, offsetY: mouthTransform.value.offsetY },
            { name: 'mouth_e', path: partsCache.value.mouth.e, offsetX: mouthTransform.value.offsetX, offsetY: mouthTransform.value.offsetY },
            { name: 'mouth_o', path: partsCache.value.mouth.o, offsetX: mouthTransform.value.offsetX, offsetY: mouthTransform.value.offsetY }
        ];

        const response = await fetch('/api/mascots/pack-atlas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mascotId: props.editingMascot.id,
                partsList: partsList
            })
        });

        const data = await response.json();
        if (data.success) {
            packingResult.value = `アトラス生成に成功しました！\n解像度: ${data.width}x${data.height}\n保存先: ${data.atlasPath}`;
            emit('live-update');
            console.log('[PackAtlas] Success:', data);
        } else {
            throw new Error(data.error || 'API returned failure');
        }
    } catch (e: any) {
        console.error('[PackAtlas] Error packing atlas:', e);
        alert('アトラス生成に失敗しました: ' + (e.message || '不明なエラー'));
    } finally {
        isPackingAtlas.value = false;
    }
};

watch(() => props.visible, (newVal) => {
    if (newVal) {
        // モーダル表示時に自動的にパーツ一覧のスキャンを走らせる
        generatePartsFromSprites();
    } else {
        stopAnimation();
    }
});

onUnmounted(() => {
    stopAnimation();
});
</script>

<template>
    <div v-if="visible" class="custom-modal-overlay animation-edit-modal-overlay">
        <div class="custom-modal-card animation-edit-modal-card">
            <!-- ヘッダー -->
            <div class="modal-header flex justify-content-between align-items-center pb-2 border-bottom border-gray-200">
                <h2 class="text-base font-bold flex align-items-center gap-2 m-0 text-slate-800">
                    <i class="pi pi-video text-purple-500 text-sm"></i>
                    <span>表情アニメーション編集 & アトラス作成</span>
                </h2>
                <Button icon="pi pi-times" class="p-button-rounded p-button-text p-button-secondary" style="width: 28px; height: 28px; padding: 0;" @click="emit('close')" />
            </div>

            <!-- ボディ -->
            <div class="modal-body-container flex gap-4 mt-3 overflow-hidden flex-1 relative" style="min-height: 0;">
                <!-- 左カラム: 大型アニメーションプレビュー -->
                <div class="flex-1 bg-slate-900 border-round flex align-items-center justify-content-center relative overflow-hidden" style="height: 520px;">
                    <!-- のっぺらぼうベース画像 -->
                    <div class="relative flex align-items-center justify-content-center" style="width: 380px; height: 500px;">
                        <img 
                            v-if="baseMascotImageUrl" 
                            :src="resolveImageUrl(baseMascotImageUrl)" 
                            alt="のっぺらぼう顔ベース" 
                            class="preview-full-img w-full h-full object-contain opacity-70" 
                        />
                        
                        <!-- 動的差分重ね合わせ (目と口のアニメーションフレーム表示) -->
                        <div v-if="partsCache.eyes.open" class="absolute pointer-events-none" style="top: 0; left: 0; width: 100%; height: 100%;">
                            <!-- 目レイヤー (瞬きフレーム) -->
                            <img 
                                v-if="activeBlinkFrame === 'open' && partsCache.eyes.open"
                                :src="resolveImageUrl(partsCache.eyes.open)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${eyeTransform.offsetX}px, ${eyeTransform.offsetY}px) scale(${eyeTransform.scale}) rotate(${eyeTransform.rotation}deg)`
                                }"
                            />
                            <img 
                                v-if="activeBlinkFrame === 'half' && partsCache.eyes.half"
                                :src="resolveImageUrl(partsCache.eyes.half)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${eyeTransform.offsetX}px, ${eyeTransform.offsetY}px) scale(${eyeTransform.scale}) rotate(${eyeTransform.rotation}deg)`
                                }"
                            />
                            <img 
                                v-if="activeBlinkFrame === 'closed' && partsCache.eyes.closed"
                                :src="resolveImageUrl(partsCache.eyes.closed)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${eyeTransform.offsetX}px, ${eyeTransform.offsetY}px) scale(${eyeTransform.scale}) rotate(${eyeTransform.rotation}deg)`
                                }"
                            />

                            <!-- 口レイヤー (口パクフレーム) -->
                            <img 
                                v-if="activeMouthFrame === 'closed' && partsCache.mouth.closed"
                                :src="resolveImageUrl(partsCache.mouth.closed)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${mouthTransform.offsetX}px, ${mouthTransform.offsetY}px) scale(${mouthTransform.scale}) rotate(${mouthTransform.rotation}deg)`
                                }"
                            />
                            <img 
                                v-if="activeMouthFrame === 'a' && partsCache.mouth.a"
                                :src="resolveImageUrl(partsCache.mouth.a)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${mouthTransform.offsetX}px, ${mouthTransform.offsetY}px) scale(${mouthTransform.scale}) rotate(${mouthTransform.rotation}deg)`
                                }"
                            />
                            <img 
                                v-if="activeMouthFrame === 'i' && partsCache.mouth.i"
                                :src="resolveImageUrl(partsCache.mouth.i)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${mouthTransform.offsetX}px, ${mouthTransform.offsetY}px) scale(${mouthTransform.scale}) rotate(${mouthTransform.rotation}deg)`
                                }"
                            />
                            <img 
                                v-if="activeMouthFrame === 'u' && partsCache.mouth.u"
                                :src="resolveImageUrl(partsCache.mouth.u)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${mouthTransform.offsetX}px, ${mouthTransform.offsetY}px) scale(${mouthTransform.scale}) rotate(${mouthTransform.rotation}deg)`
                                }"
                            />
                            <img 
                                v-if="activeMouthFrame === 'e' && partsCache.mouth.e"
                                :src="resolveImageUrl(partsCache.mouth.e)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${mouthTransform.offsetX}px, ${mouthTransform.offsetY}px) scale(${mouthTransform.scale}) rotate(${mouthTransform.rotation}deg)`
                                }"
                            />
                            <img 
                                v-if="activeMouthFrame === 'o' && partsCache.mouth.o"
                                :src="resolveImageUrl(partsCache.mouth.o)" 
                                class="absolute"
                                :style="{
                                    top: '210px',
                                    left: '140px',
                                    width: '140px',
                                    height: '140px',
                                    objectFit: 'contain',
                                    transform: `translate(${mouthTransform.offsetX}px, ${mouthTransform.offsetY}px) scale(${mouthTransform.scale}) rotate(${mouthTransform.rotation}deg)`
                                }"
                            />
                        </div>
                    </div>

                    <!-- アニメーション表示のステータスバッジ -->
                    <div class="absolute top-2 left-2 bg-slate-800/80 text-white border-1 border-slate-700 px-2 py-1 rounded text-xxs font-mono flex align-items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-green-500" :class="{'animate-pulse': isPlaying}"></span>
                        <span>{{ isPlaying ? 'PLAYING (Loop)' : 'STOPPED' }}</span>
                    </div>
                </div>

                <!-- 右カラム: コントロールパネル -->
                <div class="w-80 flex flex-column gap-3 overflow-y-auto" style="height: 520px;">
                    <!-- 1. 表情パーツの自動スキャン & 抽出 -->
                    <div class="bg-slate-50 border-1 border-gray-200 border-round p-3 flex flex-column gap-2">
                        <span class="text-xs font-bold text-slate-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-scissors text-orange-500"></i>
                            <span>4.1 表情パーツ自動スキャン</span>
                        </span>
                        <p class="text-xxs text-slate-500 leading-normal m-0">
                            登録済みの表情から瞬き用（開・半閉・閉）、口パク用（あ・い・う・え・お・閉）の差分パーツを自動的に検出してスプライトを作成します。
                        </p>
                        <Button 
                            label="表情パーツ自動抽出を実行" 
                            icon="pi pi-sync" 
                            class="p-button-outlined p-button-warning p-button-sm w-full mt-1" 
                            :loading="isGeneratingParts"
                            @click="generatePartsFromSprites" 
                        />
                    </div>

                    <!-- 2. アニメーションプレビュー調整 -->
                    <div class="bg-slate-50 border-1 border-gray-200 border-round p-3 flex flex-column gap-2">
                        <span class="text-xs font-bold text-slate-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-play text-green-500"></i>
                            <span>4.2 アニメーションタイムライン再生</span>
                        </span>
                        
                        <div class="flex gap-2 mt-1">
                            <Button 
                                :label="isPlaying ? '停止' : '再生'" 
                                :icon="isPlaying ? 'pi pi-pause' : 'pi pi-play'" 
                                :class="isPlaying ? 'p-button-secondary' : 'p-button-success'"
                                class="p-button-sm flex-1"
                                @click="isPlaying ? stopAnimation() : startAnimation()"
                            />
                        </div>

                        <!-- 速度スライダー -->
                        <div class="space-y-1 mt-2">
                            <div class="flex justify-between text-xxs text-slate-500 font-semibold">
                                <span>アニメーション再生速度</span>
                                <span>{{ animationSpeed.toFixed(1) }}x</span>
                            </div>
                            <Slider v-model="animationSpeed" :min="0.5" :max="2.5" :step="0.1" @change="stopAnimation(); startAnimation();" />
                        </div>
                    </div>

                    <!-- 3. レイヤー座標微調整 -->
                    <div class="bg-slate-50 border-1 border-gray-200 border-round p-3 flex flex-column gap-2">
                        <span class="text-xs font-bold text-slate-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-sliders-h text-blue-500"></i>
                            <span>4.3 レイヤー位置微調整 (目 / 口)</span>
                        </span>

                        <div class="grid w-full gap-2 m-0 p-0">
                            <!-- 目位置 -->
                            <div class="col-12 p-0 flex flex-column gap-1">
                                <span class="text-xxs font-bold text-slate-600">目・眉の位置オフセット</span>
                                <div class="flex align-items-center gap-2">
                                    <span class="text-xxs text-slate-500">Y</span>
                                    <Slider v-model="eyeTransform.offsetY" :min="-100" :max="100" class="flex-1" />
                                    <span class="text-xxs text-slate-500 font-mono w-8 text-right">{{ eyeTransform.offsetY }}px</span>
                                </div>
                            </div>
                            <!-- 口位置 -->
                            <div class="col-12 p-0 flex flex-column gap-1 mt-2">
                                <span class="text-xxs font-bold text-slate-600">口の位置オフセット</span>
                                <div class="flex align-items-center gap-2">
                                    <span class="text-xxs text-slate-500">Y</span>
                                    <Slider v-model="mouthTransform.offsetY" :min="-100" :max="100" class="flex-1" />
                                    <span class="text-xxs text-slate-500 font-mono w-8 text-right">{{ mouthTransform.offsetY }}px</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 4. アトラス生成・保存 -->
                    <div class="bg-slate-50 border-1 border-gray-200 border-round p-3 flex flex-column gap-2">
                        <span class="text-xs font-bold text-slate-700 flex align-items-center gap-1 select-none">
                            <i class="pi pi-box text-purple-500"></i>
                            <span>4.4 テクスチャアトラスのビルド</span>
                        </span>
                        <p class="text-xxs text-slate-500 leading-normal m-0">
                            すべての瞬き・口パクパーツとのっぺらぼう画像を1枚の透過画像 (`atlas.png`) に結合し、座標情報定義 (`atlas.json`) を生成します。
                        </p>
                        <Button 
                            label="アトラスビルドを実行" 
                            icon="pi pi-cog" 
                            class="p-button-primary p-button-sm w-full mt-1" 
                            :loading="isPackingAtlas"
                            @click="handlePackAtlas" 
                        />
                        <div 
                            v-if="packingResult" 
                            class="text-xxs text-green-700 bg-green-50 border-1 border-green-200 p-2 border-round mt-2 whitespace-pre-line font-mono"
                        >
                            {{ packingResult }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}
.custom-modal-card {
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 820px;
    max-width: 90vw;
    height: 600px;
    display: flex;
    flex-direction: column;
    padding: 20px;
}
.border-bottom {
    border-bottom: 1px solid #e2e8f0;
}
.bg-slate-900 {
    background-color: #0f172a;
}
.bg-slate-50 {
    background-color: #f8fafc;
}
.border-round {
    border-radius: 8px;
}
.text-xxs {
    font-size: 0.7rem;
}
.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: .3;
    }
}
</style>
