<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Card from 'primevue/card';
import Select from 'primevue/select';
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import InputText from 'primevue/inputtext';
import { useConfigStore } from '@/store/config';
import { useAuthStore } from '@/store/auth';
import { storeToRefs } from 'pinia';
import { resolveMascotImageUrl as resolveImageAssetUrl } from '@/utils/mascot-image-url';
import { DEFAULT_ACCENT_COLOR } from '@/config/theme';

const configStore = useConfigStore();
const authStore = useAuthStore();

const {
    activeMascot,
    windowMode,
    mascotScale,
    alwaysOnTop,
    mascotBackgroundColor,
    mascotBackgroundOpacity,
    mascotBackgroundImage,
    mascotBackgroundImageOpacity,
    mascotBackgroundImageFit,
    chatOpacity,
    chatAlwaysOnTop,
    chatSendKey,
    chatFontFamily,
    chatBorderShow,
    chatBorderColor,
    chatBorderWidth,
    chatBackgroundColor,
    chatBackgroundImage,
    chatBackgroundImageOpacity,
    chatBackgroundImageFit,
    integratedBackgroundColor,
    integratedBackgroundOpacity,
    integratedBackgroundImage,
    integratedBackgroundImageOpacity,
    integratedBackgroundImageFit,
    useServer,
    serverHost,
    serverPort
} = storeToRefs(configStore);

const { user, isAuthenticated } = storeToRefs(authStore);

const mascotAlwaysOnTopOptions = ref([
    { name: '常に最前面に表示する', value: true },
    { name: '最前面に表示しない', value: false }
]);

const chatAlwaysOnTopOptions = ref([
    { name: '常に最前面に表示する', value: true },
    { name: '最前面に表示しない', value: false },
    { name: 'マスコットと連動', value: 'sync' }
]);

const sendKeyOptions = ref([
    { name: 'Enter で送信 (Shift + Enter で改行)', value: 'enter' },
    { name: 'Shift + Enter で送信 (Enter で改行)', value: 'shiftEnter' }
]);

const fontFamilyOptions = ref([
    { name: 'システムデフォルト (sans-serif)', value: 'sans-serif' },
    { name: 'Yu Gothic UI / 游ゴシック', value: '"Yu Gothic UI", "Yu Gothic", sans-serif' },
    { name: 'Meiryo / メイリオ', value: '"Meiryo", sans-serif' },
    { name: 'Segoe UI', value: '"Segoe UI", sans-serif' },
    { name: 'MS PGothic / ＭＳ Ｐゴシック', value: '"MS PGothic", sans-serif' }
]);

const windowModeOptions = ref([
    { name: '分割', desc: 'マスコットとチャットを分離', value: 'split' },
    { name: '統合', desc: 'マスコットとチャットを統合', value: 'integrated' },
    { name: 'コンパクト', desc: 'チャット内にマスコット', value: 'compact' }
]);

const chatBackgroundImageFitOptions = ref([
    { name: 'カバー (全体に広げる - アスペクト比維持)', value: 'cover' },
    { name: '全体表示 (全体が収まるように表示)', value: 'contain' },
    { name: '引き延ばし (枠に合わせて伸縮)', value: 'fill' },
    { name: '並べて表示 (タイル状に繰り返す)', value: 'tile' }
]);

const saveStatus = ref('設定を保存');
const isSaving = ref(false);
let initialWindowMode = '';

// --- サーバー接続 疎通確認用の状態変数・関数 ---
const isTestingServerConnection = ref(false);
const serverConnectionState = ref<'idle' | 'success' | 'failed'>('idle');
const serverConnectionErrorMsg = ref('');

const testServerConnection = async () => {
    isTestingServerConnection.value = true;
    serverConnectionState.value = 'idle';
    serverConnectionErrorMsg.value = '';
    
    if (window.electronAPI && window.electronAPI.testServerConnection) {
        try {
            const result = await window.electronAPI.testServerConnection(serverHost.value, serverPort.value);
            if (result.success) {
                serverConnectionState.value = 'success';
            } else {
                serverConnectionState.value = 'failed';
                serverConnectionErrorMsg.value = result.error || '接続に失敗しました。';
            }
        } catch (e: any) {
            serverConnectionState.value = 'failed';
            serverConnectionErrorMsg.value = '通信エラーが発生しました。';
        }
    } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        serverConnectionState.value = 'success';
    }
    isTestingServerConnection.value = false;
};

const serverConnectionClass = computed(() => {
    if (serverConnectionState.value === 'success') return 'status-success';
    if (serverConnectionState.value === 'failed') return 'status-failed';
    return 'status-idle';
});

const serverConnectionIcon = computed(() => {
    if (serverConnectionState.value === 'success') return 'pi pi-check-circle text-green-400';
    if (serverConnectionState.value === 'failed') return 'pi pi-times-circle text-red-400';
    return 'pi pi-info-circle text-gray-400';
});

const serverConnectionText = computed(() => {
    if (serverConnectionState.value === 'success') return '接続成功！サーバーは稼働しています。';
    if (serverConnectionState.value === 'failed') return `接続失敗: ${serverConnectionErrorMsg.value}`;
    return 'ホストとポートを入力して疎通テストを行ってください。';
});

// --- チャット背景画像用のハンドラー ---
const selectBackgroundImage = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        chatBackgroundImage.value = result.path;
    }
};

const clearBackgroundImage = () => {
    chatBackgroundImage.value = '';
};

// --- マスコットサイズ調整用ハンドラー ---
const updateMascotScale = () => {
    if (window.electronAPI && window.electronAPI.setMascotScale) {
        window.electronAPI.setMascotScale(mascotScale.value);
    }
};

const changeScalePreset = (scale: number) => {
    mascotScale.value = scale;
    updateMascotScale();
};

const saveSettings = async () => {
    isSaving.value = true;
    saveStatus.value = '保存中...';

    const modeChanged = windowMode.value !== initialWindowMode;

    try {
        await configStore.saveConfig();
        setTimeout(() => {
            saveStatus.value = '保存完了！';
            isSaving.value = false;

            if (modeChanged) {
                if (confirm('ウィンドウモードが変更されました。設定を反映するためにアプリケーションを再起動しますか？')) {
                    relaunchApp();
                } else {
                    initialWindowMode = windowMode.value;
                }
            }

            setTimeout(() => {
                saveStatus.value = '設定を保存';
            }, 2000);
        }, 600);
    } catch (e) {
        saveStatus.value = '保存エラー';
        isSaving.value = false;
    }
};

const relaunchApp = () => {
    if (window.electronAPI && window.electronAPI.relaunchApp) {
        window.electronAPI.relaunchApp();
    }
};

// --- マスコット画像解決用のヘルパー ---
const isMascotImage = (path: string | undefined | null): boolean => {
    if (!path) return false;
    return path.startsWith('data:image/') || 
           path.startsWith('/mascots/') || 
           path.startsWith('http://') || 
           path.startsWith('https://') ||
           /\.(png|jpg|jpeg|webp|gif)$/i.test(path);
};

const resolveMascotImageUrl = (path: string | undefined | null): string => {
    return resolveImageAssetUrl(path, {
        serverHost: serverHost.value,
        serverPort: serverPort.value,
        absoluteMascotUrl: true
    });
};

const activeMascotImageUrl = computed(() => {
    const mascot = activeMascot.value;
    if (!mascot) return '';
    
    // 現在選択されている衣装
    const outfits = mascot.assets?.outfits || [];
    const currentOutfit = outfits.find((o: any) => o.id === mascot.currentOutfitId) || outfits[0];
    
    if (currentOutfit && currentOutfit.path) {
        return resolveMascotImageUrl(currentOutfit.path);
    }
    return '';
});

// --- マスコット背景画像用のハンドラー ---
const selectMascotBackgroundImage = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        mascotBackgroundImage.value = result.path;
    }
};

const clearMascotBackgroundImage = () => {
    mascotBackgroundImage.value = '';
};

// --- 統合ウィンドウ背景画像用のハンドラー ---
const selectIntegratedBackgroundImage = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectLocalImage();
    if (result && result.success) {
        integratedBackgroundImage.value = result.path;
    }
};

const clearIntegratedBackgroundImage = () => {
    integratedBackgroundImage.value = '';
};

const getIntegratedPreviewRgbaBackground = computed(() => {
    const hex = integratedBackgroundColor.value || '#1e1e2e';
    const opacity = integratedBackgroundOpacity.value !== undefined ? integratedBackgroundOpacity.value : 1.0;
    
    let r = 30, g = 30, b = 46;
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

const integratedPreviewBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getIntegratedPreviewRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0
    };
    if (integratedBackgroundImage.value) {
        styles.backgroundImage = `url(${integratedBackgroundImage.value})`;
        styles.opacity = integratedBackgroundImageOpacity.value;
        
        if (integratedBackgroundImageFit.value === 'cover') {
            styles.backgroundSize = 'cover';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'contain') {
            styles.backgroundSize = 'contain';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'fill') {
            styles.backgroundSize = '100% 100%';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'tile') {
            styles.backgroundSize = 'auto';
            styles.backgroundPosition = 'top left';
            styles.backgroundRepeat = 'repeat';
        }
    }
    return styles;
});

const getMascotPreviewRgbaBackground = computed(() => {
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

const mascotPreviewBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getMascotPreviewRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0
    };
    if (mascotBackgroundImage.value) {
        styles.backgroundImage = `url(${mascotBackgroundImage.value})`;
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

const getPreviewRgbaBackground = computed(() => {
    const hex = chatBackgroundColor.value || '#ffffff';
    const opacity = chatOpacity.value !== undefined ? chatOpacity.value : 1.0;
    
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

const getPreviewBorderStyle = computed(() => {
    if (!chatBorderShow.value) {
        return 'none';
    }
    const width = chatBorderWidth.value !== undefined ? chatBorderWidth.value : 1;
    const color = chatBorderColor.value || DEFAULT_ACCENT_COLOR;
    return `${width}px solid ${color}`;
});

const chatPreviewBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getPreviewRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0
    };
    if (chatBackgroundImage.value) {
        styles.backgroundImage = `url(${chatBackgroundImage.value})`;
        styles.opacity = chatBackgroundImageOpacity.value;
        
        if (chatBackgroundImageFit.value === 'cover') {
            styles.backgroundSize = 'cover';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'contain') {
            styles.backgroundSize = 'contain';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'fill') {
            styles.backgroundSize = '100% 100%';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'tile') {
            styles.backgroundSize = 'auto';
            styles.backgroundPosition = 'top left';
            styles.backgroundRepeat = 'repeat';
        }
    }
    return styles;
});

onMounted(async () => {
    initialWindowMode = windowMode.value;
    authStore.checkAuthStatus();
});
</script>

<template>
    <Card class="premium-card">
        <template #title>ウィンドウ設定</template>
        <template #content>
            <div class="flex flex-column gap-4">
                <!-- ウィンドウモード設定 -->
                <div class="form-field-header font-bold text-base border-bottom pb-2 mb-2 text-brand-600 flex align-items-center gap-2">
                    <i class="pi pi-th-large text-brand-500"></i>
                    <span>ウィンドウモード設定</span>
                </div>

                <div class="form-field">
                    <label class="font-medium">ウィンドウモード</label>
                    <Select 
                        v-model="windowMode" 
                        :options="windowModeOptions" 
                        optionLabel="name" 
                        optionValue="value" 
                        class="w-full mt-2" 
                    >
                        <template #option="slotProps">
                            <div class="flex align-items-center">
                                <span>{{ slotProps.option.name }} ｜ {{ slotProps.option.desc }}</span>
                            </div>
                        </template>
                    </Select>
                </div>

                <!-- 統合ウィンドウ設定（統合モード時のみ表示） -->
                <div v-if="windowMode === 'integrated'" class="flex flex-column gap-3 mt-2">
                    <div class="form-field-header font-bold text-base border-bottom pb-2 mb-2 text-brand-600 flex align-items-center gap-2">
                        <i class="pi pi-clone text-brand-500"></i>
                        <span>統合ウィンドウ設定</span>
                    </div>

                    <div class="flex flex-column md:flex-row gap-4">
                        <!-- 左ペイン: 設定コントロール -->
                        <div class="flex-1 flex flex-column gap-3">
                            <!-- 背景色 -->
                            <div class="form-field">
                                <label class="font-medium">統合ウィンドウ全体の背景色</label>
                                <div class="flex align-items-center gap-2 mt-2">
                                    <input type="color" v-model="integratedBackgroundColor" class="p-0 border-round cursor-pointer border-1 border-300 color-picker-input" />
                                    <InputText v-model="integratedBackgroundColor" placeholder="#1e1e2e" class="flex-1" />
                                </div>
                            </div>

                            <!-- 背景不透明度 -->
                            <div class="form-field flex flex-column justify-content-center">
                                <label class="font-medium flex justify-content-between">
                                    <span>背景の不透明度 (透明度): {{ Math.round(integratedBackgroundOpacity * 100) }}%</span>
                                </label>
                                <div class="mt-3">
                                    <Slider v-model="integratedBackgroundOpacity" :min="0.1" :max="1.0" :step="0.05" />
                                </div>
                            </div>

                            <!-- 背景画像設定 -->
                            <div class="form-field">
                                <label class="font-medium">背景画像</label>
                                <div class="flex align-items-center gap-2 mt-2">
                                    <Button 
                                        label="画像を選択" 
                                        icon="pi pi-image" 
                                        class="p-button-outlined p-button-sm"
                                        @click="selectIntegratedBackgroundImage" 
                                    />
                                    <Button 
                                        v-if="integratedBackgroundImage"
                                        label="画像をクリア" 
                                        icon="pi pi-trash" 
                                        class="p-button-outlined p-button-danger p-button-sm"
                                        @click="clearIntegratedBackgroundImage" 
                                    />
                                    <span v-if="integratedBackgroundImage" class="text-xs text-gray-500 overflow-hidden text-overflow-ellipsis white-space-nowrap file-name-label">
                                        設定済み
                                    </span>
                                    <span v-else class="text-xs text-gray-400">未設定</span>
                                </div>
                                <div v-if="integratedBackgroundImage" class="mt-2 border-1 border-300 border-round p-1 flex justify-content-center align-items-center bg-gray-100 image-preview-thumbnail">
                                    <img :src="integratedBackgroundImage" class="max-w-full max-h-full img-contain" />
                                </div>
                            </div>

                            <!-- 背景画像詳細設定 -->
                            <div v-if="integratedBackgroundImage" class="flex gap-3">
                                <div class="flex-1 form-field flex flex-column justify-content-center">
                                    <label class="font-medium">画像不透明度: {{ Math.round(integratedBackgroundImageOpacity * 100) }}%</label>
                                    <div class="mt-3">
                                        <Slider v-model="integratedBackgroundImageOpacity" :min="0.0" :max="1.0" :step="0.05" />
                                    </div>
                                </div>
                                <div class="flex-1 form-field">
                                    <label class="font-medium">配置方法</label>
                                    <Select 
                                        v-model="integratedBackgroundImageFit" 
                                        :options="chatBackgroundImageFitOptions" 
                                        optionLabel="name" 
                                        optionValue="value" 
                                        class="w-full mt-2" 
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- 右ペイン: 統合ウィンドウプレビュー -->
                        <div class="flex flex-column justify-content-start align-items-stretch mt-4 md:mt-0 pl-0 md:pl-4 w-full preview-column">
                            <label class="font-medium mb-2 align-self-start text-sm text-brand-600 flex align-items-center gap-2">
                                <i class="pi pi-eye"></i>プレビュー（統合ウィンドウ）
                            </label>
                            <div class="integrated-preview-box border-round shadow-2 p-2 overflow-hidden w-full relative border-1 border-300 bg-gray-50 flex gap-2">
                                <!-- 統合ウィンドウの全体背景レイヤー -->
                                <div class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none" :style="integratedPreviewBackgroundStyle"></div>

                                <!-- 左側：マスコット表示エリア -->
                                <div class="flex-1 flex justify-content-center align-items-center relative integrated-mascot-pane">
                                    <img 
                                        v-if="isMascotImage(activeMascotImageUrl)" 
                                        :src="activeMascotImageUrl" 
                                        class="integrated-mascot-img"
                                    />
                                    <div v-else class="flex align-items-center justify-content-center border-circle bg-white shadow-2 text-center integrated-avatar-fallback">
                                        {{ activeMascot?.avatar || '🤖' }}
                                    </div>
                                </div>

                                <!-- 右側：チャット表示エリア（極小モック） -->
                                <div class="flex-1 flex flex-column justify-content-between p-1 relative integrated-chat-pane">
                                    <div class="text-xs text-gray-500 font-bold border-bottom pb-1 mb-1 integrated-chat-header">Chat</div>
                                    <div class="flex-1 flex flex-column gap-1 overflow-hidden integrated-chat-messages">
                                        <div class="bg-brand-100 text-brand-900 border-round p-1 integrated-chat-bubble">Hello!</div>
                                        <div class="bg-white text-gray-800 border-round p-1 align-self-end integrated-chat-bubble">こんにちは</div>
                                    </div>
                                    <div class="border-top pt-1 mt-1 flex gap-1">
                                        <div class="bg-white border-1 border-300 border-round w-full integrated-input-mock"></div>
                                        <div class="bg-brand-500 text-white border-round integrated-btn-mock"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- マスコットウィンドウ設定 -->
                <div class="form-field-header font-bold text-base border-bottom pb-2 mb-2 text-brand-600 flex align-items-center gap-2">
                    <i class="pi pi-user text-brand-500"></i>
                    <span>マスコットウィンドウ設定</span>
                </div>

                <div class="flex flex-column md:flex-row gap-4 mt-2">
                    <!-- 左ペイン: 各種設定コントロール -->
                    <div class="flex-1 flex flex-column gap-3">
                        <div class="form-field">
                            <label class="font-medium flex justify-content-between">
                                <span>表示サイズ (スケール): {{ windowMode === 'compact' ? 50 : Math.round((mascotScale || 1.0) * 100) }}%</span>
                                <span v-if="windowMode === 'compact'" class="text-xs text-yellow-500 font-normal">※コンパクト表示時は50%に固定されます</span>
                            </label>
                            <Slider :modelValue="windowMode === 'compact' ? 0.5 : mascotScale" :disabled="windowMode === 'compact'" :min="0.5" :max="2.0" :step="0.1" class="mt-2" @change="(val: any) => { if (windowMode !== 'compact' && typeof val === 'number') { mascotScale = val; updateMascotScale(); } }" />
                        </div>

                        <div class="form-field">
                            <label class="font-medium">クイックサイズ変更</label>
                            <div class="flex gap-2 mt-2">
                                <Button :label="windowMode === 'compact' ? '50%' : '50%'" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': (windowMode === 'compact' ? 0.5 : mascotScale) === (windowMode === 'compact' ? 0.5 : 0.5)}" :disabled="windowMode === 'compact'" @click="changeScalePreset(0.5)" />
                                <Button label="75%" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': (windowMode === 'compact' ? null : mascotScale) === 0.75}" :disabled="windowMode === 'compact'" @click="changeScalePreset(0.75)" />
                                <Button label="100% (標準)" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': (windowMode === 'compact' ? null : mascotScale) === 1.0}" :disabled="windowMode === 'compact'" @click="changeScalePreset(1.0)" />
                                <Button label="150%" class="p-button-outlined p-button-sm flex-1" :class="{'p-button-primary': (windowMode === 'compact' ? null : mascotScale) === 1.5}" :disabled="windowMode === 'compact'" @click="changeScalePreset(1.5)" />
                            </div>
                        </div>

                        <div class="form-field">
                            <label class="font-medium">最前面表示</label>
                            <Select 
                                v-model="alwaysOnTop" 
                                :options="mascotAlwaysOnTopOptions" 
                                optionLabel="name" 
                                optionValue="value" 
                                class="w-full mt-2" 
                            />
                        </div>

                        <!-- マスコット背景色 -->
                        <div class="form-field">
                            <label class="font-medium flex justify-content-between">
                                <span>マスコットエリア背景色</span>
                            </label>
                            <div class="flex align-items-center gap-2 mt-2">
                                <input type="color" v-model="mascotBackgroundColor" class="p-0 border-round cursor-pointer border-1 border-300 color-picker-input" />
                                <InputText v-model="mascotBackgroundColor" placeholder="#ffffff" class="flex-1" />
                            </div>
                        </div>

                        <!-- マスコット背景不透明度 -->
                        <div class="form-field flex flex-column justify-content-center">
                            <label class="font-medium flex justify-content-between">
                                <span>背景の不透明度 (透明度): {{ Math.round(mascotBackgroundOpacity * 100) }}%</span>
                            </label>
                            <div class="mt-3">
                                <Slider v-model="mascotBackgroundOpacity" :min="0.0" :max="1.0" :step="0.05" />
                            </div>
                        </div>

                        <!-- マスコット背景画像設定 -->
                        <div class="form-field">
                            <label class="font-medium">背景画像</label>
                            <div class="flex align-items-center gap-2 mt-2">
                                <Button 
                                    label="画像を選択" 
                                    icon="pi pi-image" 
                                    class="p-button-outlined p-button-sm"
                                    @click="selectMascotBackgroundImage" 
                                />
                                <Button 
                                    v-if="mascotBackgroundImage"
                                    label="画像をクリア" 
                                    icon="pi pi-trash" 
                                    class="p-button-outlined p-button-danger p-button-sm"
                                    @click="clearMascotBackgroundImage" 
                                />
                                <span v-if="mascotBackgroundImage" class="text-xs text-gray-500 overflow-hidden text-overflow-ellipsis white-space-nowrap file-name-label">
                                    設定済み
                                </span>
                                <span v-else class="text-xs text-gray-400">未設定</span>
                            </div>
                            <!-- 背景画像のプレビュー -->
                            <div v-if="mascotBackgroundImage" class="mt-2 border-1 border-300 border-round p-1 flex justify-content-center align-items-center bg-gray-100 image-preview-thumbnail">
                                <img :src="mascotBackgroundImage" class="max-w-full max-h-full img-contain" />
                            </div>
                        </div>

                        <!-- 背景画像の詳細設定（画像がある場合のみ表示） -->
                        <div v-if="mascotBackgroundImage" class="flex gap-3">
                            <div class="flex-1 form-field flex flex-column justify-content-center">
                                <label class="font-medium">画像不透明度: {{ Math.round(mascotBackgroundImageOpacity * 100) }}%</label>
                                <div class="mt-3">
                                    <Slider v-model="mascotBackgroundImageOpacity" :min="0.0" :max="1.0" :step="0.05" />
                                </div>
                            </div>
                            <div class="flex-1 form-field">
                                <label class="font-medium">配置方法</label>
                                <Select 
                                    v-model="mascotBackgroundImageFit" 
                                    :options="chatBackgroundImageFitOptions" 
                                    optionLabel="name" 
                                    optionValue="value" 
                                    class="w-full mt-2" 
                                />
                            </div>
                        </div>
                    </div>

                    <!-- 右ペイン: マスコットプレビュー -->
                    <div class="flex flex-column justify-content-start align-items-stretch mt-4 md:mt-0 pl-0 md:pl-4 w-full preview-column">
                        <label class="font-medium mb-2 align-self-start text-sm text-brand-600 flex align-items-center gap-2">
                            <i class="pi pi-eye"></i>プレビュー（サイズ・背景連動）
                        </label>
                        <div class="mascot-preview-box border-round shadow-2 p-0 overflow-hidden w-full relative border-1 border-300 bg-gray-50 flex flex-column justify-content-center align-items-center">
                            <!-- 背景：デスクトップを模したグラデーション背景 -->
                            <div class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none mascot-preview-bg-gradient"></div>
                            
                            <!-- グリッド模様 (透過) -->
                            <div class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none mascot-preview-bg-grid"></div>
                            
                            <!-- マスコットウィンドウの背景レイヤー -->
                            <div class="absolute top-0 left-0 right-0 bottom-0 pointer-events-none" :style="mascotPreviewBackgroundStyle"></div>

                            <!-- 最前面表示インジケーターバッジ -->
                            <div class="absolute top-2 right-2 border-round px-2 py-1 text-xs font-semibold shadow-1 always-on-top-badge" :class="alwaysOnTop ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'">
                                {{ alwaysOnTop ? '最前面' : '標準表示' }}
                            </div>

                            <!-- マスコット表示 -->
                            <div class="flex justify-content-center align-items-center mascot-display-wrapper">
                                <div :style="{ transform: 'scale(' + (windowMode === 'compact' ? 0.5 : (mascotScale || 1.0)) + ')', transformOrigin: 'center center', transition: 'transform 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)' }" class="flex justify-content-center align-items-center">
                                    <img 
                                        v-if="isMascotImage(activeMascotImageUrl)" 
                                        :src="activeMascotImageUrl" 
                                        class="max-w-full max-h-full mascot-preview-img"
                                    />
                                    <div 
                                        v-else 
                                        class="flex align-items-center justify-content-center border-circle bg-white shadow-2 text-center mascot-avatar-fallback"
                                    >
                                        {{ activeMascot?.avatar || '🤖' }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- チャットウィンドウ設定 -->
                <div class="form-field-header font-bold text-base border-bottom pb-2 mt-4 mb-2 text-brand-600 flex align-items-center gap-2">
                    <i class="pi pi-comments text-brand-500"></i>
                    <span>チャットウィンドウ設定</span>
                </div>

                <div class="flex flex-column md:flex-row gap-4 mt-2">
                    <!-- 左ペイン: 各種設定コントロール -->
                    <div class="flex-1 flex flex-column gap-3">
                        <!-- メッセージエリア背景色 -->
                        <div class="form-field">
                            <label class="font-medium flex justify-content-between">
                                <span>メッセージエリア背景色</span>
                            </label>
                            <div class="flex align-items-center gap-2 mt-2">
                                <input type="color" v-model="chatBackgroundColor" class="p-0 border-round cursor-pointer border-1 border-300 color-picker-input" />
                                <InputText v-model="chatBackgroundColor" placeholder="#ffffff" class="flex-1" />
                            </div>
                        </div>

                        <!-- 不透明度 (透明度) -->
                        <div class="form-field flex flex-column justify-content-center">
                            <label class="font-medium flex justify-content-between">
                                <span>不透明度 (透明度): {{ Math.round(chatOpacity * 100) }}%</span>
                            </label>
                            <div class="mt-3">
                                <Slider v-model="chatOpacity" :min="0.1" :max="1.0" :step="0.05" />
                            </div>
                        </div>

                        <!-- チャット背景画像設定 -->
                        <div class="form-field">
                            <label class="font-medium">背景画像</label>
                            <div class="flex align-items-center gap-2 mt-2">
                                <Button 
                                    label="画像を選択" 
                                    icon="pi pi-image" 
                                    class="p-button-outlined p-button-sm"
                                    @click="selectBackgroundImage" 
                                />
                                <Button 
                                    v-if="chatBackgroundImage"
                                    label="画像をクリア" 
                                    icon="pi pi-trash" 
                                    class="p-button-outlined p-button-danger p-button-sm"
                                    @click="clearBackgroundImage" 
                                />
                                <span v-if="chatBackgroundImage" class="text-xs text-gray-500 overflow-hidden text-overflow-ellipsis white-space-nowrap file-name-label">
                                    設定済み
                                </span>
                                <span v-else class="text-xs text-gray-400">未設定</span>
                            </div>
                            <!-- 背景画像のプレビュー -->
                            <div v-if="chatBackgroundImage" class="mt-2 border-1 border-300 border-round p-1 flex justify-content-center align-items-center bg-gray-100 image-preview-thumbnail">
                                <img :src="chatBackgroundImage" class="max-w-full max-h-full img-contain" />
                            </div>
                        </div>

                        <!-- 背景画像の詳細設定（画像がある場合のみ表示） -->
                        <div v-if="chatBackgroundImage" class="flex gap-3">
                            <div class="flex-1 form-field flex flex-column justify-content-center">
                                <label class="font-medium">画像不透明度: {{ Math.round(chatBackgroundImageOpacity * 100) }}%</label>
                                <div class="mt-3">
                                    <Slider v-model="chatBackgroundImageOpacity" :min="0.0" :max="1.0" :step="0.05" />
                                </div>
                            </div>
                            <div class="flex-1 form-field">
                                <label class="font-medium">配置方法</label>
                                <Select 
                                    v-model="chatBackgroundImageFit" 
                                    :options="chatBackgroundImageFitOptions" 
                                    optionLabel="name" 
                                    optionValue="value" 
                                    class="w-full mt-2" 
                                />
                            </div>
                        </div>

                        <!-- 境界線（枠）設定（グループボックス表示） -->
                        <fieldset class="border-round p-3 border-fieldset">
                            <legend class="px-2 text-sm font-semibold text-brand-600">枠</legend>
                            <div class="flex align-items-center gap-3">
                                <div class="flex align-items-center gap-2">
                                    <input type="checkbox" id="chatBorderShow" v-model="chatBorderShow" class="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500" />
                                    <label for="chatBorderShow" class="cursor-pointer text-sm font-medium">表示</label>
                                </div>
                                
                                <div v-if="chatBorderShow" class="flex align-items-center gap-2">
                                    <input type="color" v-model="chatBorderColor" class="p-0 border-round cursor-pointer border-1 border-300 color-picker-input" />
                                    <InputText v-model="chatBorderColor" :placeholder="DEFAULT_ACCENT_COLOR" class="border-color-input" />
                                </div>
                                
                                <div v-if="chatBorderShow" class="flex align-items-center gap-2">
                                    <input v-model.number="chatBorderWidth" type="number" min="1" max="10" class="p-inputtext p-component border-width-input" />
                                    <span class="text-sm font-medium">px</span>
                                </div>
                            </div>
                        </fieldset>

                        <!-- 最前面表示 -->
                        <div class="form-field">
                            <label class="font-medium">最前面表示</label>
                            <Select 
                                v-model="chatAlwaysOnTop" 
                                :options="chatAlwaysOnTopOptions" 
                                optionLabel="name" 
                                optionValue="value" 
                                class="w-full mt-2" 
                            />
                        </div>

                        <!-- 送信キー割り当て -->
                        <div class="form-field">
                            <label class="font-medium">送信キー割り当て</label>
                            <Select 
                                v-model="chatSendKey" 
                                :options="sendKeyOptions" 
                                optionLabel="name" 
                                optionValue="value" 
                                class="w-full mt-2" 
                            />
                        </div>

                        <!-- フォント選択 -->
                        <div class="form-field">
                            <label class="font-medium">チャットウィンドウのフォント</label>
                            <Select 
                                v-model="chatFontFamily" 
                                :options="fontFamilyOptions" 
                                optionLabel="name" 
                                optionValue="value" 
                                editable
                                placeholder="フォント名を選択または直接入力..."
                                class="w-full mt-2" 
                            />
                        </div>
                    </div>

                    <!-- 右ペイン: プレビュー -->
                    <div class="flex flex-column justify-content-start align-items-stretch mt-4 md:mt-0 pl-0 md:pl-4 w-full preview-column">
                        <label class="font-medium mb-2 align-self-start text-sm text-brand-600 flex align-items-center gap-2">
                            <i class="pi pi-eye"></i>プレビュー（リアルタイム）
                        </label>
                        <div class="chat-preview-box border-round shadow-2 p-0 overflow-hidden w-full relative border-1 border-300" :style="{ fontFamily: chatFontFamily, border: getPreviewBorderStyle, height: '380px', display: 'flex', flexDirection: 'column', background: 'transparent' }">
                            <!-- 背景レイヤー -->
                            <div class="chat-preview-background" :style="chatPreviewBackgroundStyle"></div>
                            
                            <!-- ヘッダー -->
                            <div class="chat-preview-header flex align-items-center justify-content-between px-3">
                                <span class="text-xs font-semibold text-color-secondary">Mascot Chat</span>
                                <div class="flex gap-2">
                                    <i class="pi pi-volume-up text-xs text-gray-500"></i>
                                    <i class="pi pi-cog text-xs text-gray-500"></i>
                                </div>
                            </div>

                            <!-- メッセージエリア -->
                            <div class="chat-preview-messages flex-1 p-3 flex flex-column gap-3 overflow-y-auto">
                                <div class="flex justify-content-start w-full">
                                    <div class="p-2 border-round text-xs max-w-80 shadow-1 chat-bubble-incoming">
                                        こんにちは！設定を変更すると、このプレビューにリアルタイムに反映されます。[happy]
                                    </div>
                                </div>
                                <div class="flex justify-content-end w-full">
                                    <div class="p-2 border-round text-xs max-w-80 shadow-1 text-white chat-bubble-outgoing">
                                        背景やフォントが変わるんだね！
                                    </div>
                                </div>
                            </div>

                            <!-- フッター -->
                            <div class="chat-preview-footer p-2 flex align-items-center gap-2">
                                <div class="flex-1 border-1 border-300 border-round bg-white px-2 py-1 text-xs text-gray-400 flex align-items-center justify-content-between">
                                    <span>メッセージを入力...</span>
                                    <i class="pi pi-send text-xs text-brand-500"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>



                <!-- サーバー連携設定 -->
                <div class="form-field-header font-bold text-base border-bottom pb-2 mt-4 mb-2 text-brand-600 flex align-items-center gap-2">
                    <i class="pi pi-server text-brand-500"></i>
                    <span>サーバー連携設定 (マルチデバイス)</span>
                </div>

                <div class="form-field mt-3 flex flex-column gap-3">
                    <div class="flex gap-3">
                        <div class="flex-1">
                            <label class="font-medium">サーバーホスト (IPアドレス / ドメイン)</label>
                            <InputText v-model="serverHost" placeholder="例: localhost または 192.168.1.10" class="w-full mt-1" />
                        </div>
                        <div class="server-port-col">
                            <label class="font-medium">ポート番号</label>
                            <input v-model.number="serverPort" type="number" placeholder="例: 3000" class="p-inputtext p-component w-full mt-1" />
                        </div>
                    </div>

                    <div class="flex justify-content-end mt-1">
                        <Button 
                            label="接続テストを実行" 
                            icon="pi pi-sync" 
                            class="p-button-outlined p-button-sm"
                            :loading="isTestingServerConnection"
                            @click="testServerConnection" 
                        />
                    </div>

                    <div class="connection-status mt-1" :class="serverConnectionClass">
                        <i :class="serverConnectionIcon"></i>
                        <span class="ml-2">{{ serverConnectionText }}</span>
                    </div>

                     <!-- ログイン状態・認証UI -->
                     <div class="auth-section mt-3 p-3 border-round bg-gray-50 border-1 border-300">
                         <div class="flex align-items-center justify-content-between">
                             <div class="flex align-items-center gap-2">
                                 <i class="pi pi-user text-brand-500"></i>
                                 <span class="font-bold">ログイン状態:</span>
                                 <span v-if="isAuthenticated" class="text-green-600 font-semibold">{{ user?.email }}</span>
                                 <span v-else class="text-red-500 font-semibold">未ログイン</span>
                             </div>
                             <div>
                                 <Button 
                                     v-if="!isAuthenticated"
                                     label="Googleでログイン" 
                                     icon="pi pi-google" 
                                     class="p-button-sm p-button-success"
                                     @click="authStore.login" 
                                 />
                                 <Button 
                                     v-else
                                     label="ログアウト" 
                                     icon="pi pi-sign-out" 
                                     class="p-button-sm p-button-danger p-button-outlined"
                                     @click="authStore.logout" 
                                 />
                             </div>
                         </div>
                     </div>
                 </div>

                <div class="flex justify-content-end mt-4">
                    <Button 
                        :label="saveStatus" 
                        :icon="saveStatus === '保存完了！' ? 'pi pi-check-circle' : 'pi pi-check'" 
                        class="p-button-primary" 
                        :disabled="isSaving"
                        @click="saveSettings" 
                    />
                </div>
            </div>
        </template>
    </Card>
</template>

<style scoped>
.color-picker-input {
    width: 40px;
    height: 32px;
}

.file-name-label {
    max-width: 150px;
}

.image-preview-thumbnail {
    width: 100px;
    height: 60px;
    overflow: hidden;
}

.img-contain {
    object-fit: contain;
}

.preview-column {
    max-width: 320px;
}

.integrated-preview-box,
.mascot-preview-box {
    height: 240px;
}

.integrated-mascot-pane {
    z-index: 1;
    border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.integrated-mascot-img {
    height: 90px;
    object-fit: contain;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}

.integrated-avatar-fallback {
    width: 50px;
    height: 50px;
    font-size: 24px;
}

.integrated-chat-pane {
    z-index: 1;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    backdrop-filter: blur(2px);
}

.integrated-chat-header {
    font-size: 10px;
}

.integrated-chat-messages {
    max-height: 120px;
}

.integrated-chat-bubble {
    font-size: 8px;
    width: fit-content;
    max-width: 90%;
}

.integrated-input-mock {
    height: 12px;
}

.integrated-btn-mock {
    width: 12px;
    height: 12px;
}

.mascot-preview-bg-gradient {
    background: linear-gradient(135deg, var(--color-primary-soft) 0%, #e0e7ff 100%);
    opacity: 0.8;
    z-index: 0;
}

.mascot-preview-bg-grid {
    background-image: radial-gradient(var(--color-primary-alpha-10) 1.5px, transparent 1.5px);
    background-size: 16px 16px;
    z-index: 1;
}

.always-on-top-badge {
    z-index: 2;
}

.mascot-display-wrapper {
    width: 100%;
    height: 100%;
    z-index: 2;
    overflow: hidden;
}

.mascot-preview-img {
    height: 120px;
    object-fit: contain;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
}

.mascot-avatar-fallback {
    width: 80px;
    height: 80px;
    font-size: 40px;
}

.border-fieldset {
    border: 1px solid rgba(0, 0, 0, 0.12);
}

.border-color-input {
    width: 80px;
    height: 32px;
}

.border-width-input {
    width: 60px;
    height: 32px;
}

.chat-preview-header {
    height: 40px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(5px);
    z-index: 1;
    position: relative;
}

.chat-preview-messages {
    pointer-events: none;
    z-index: 1;
    position: relative;
}

.chat-bubble-incoming {
    background: rgba(255, 255, 255, 0.95);
    color: #334155;
    border-radius: 12px 12px 12px 0px;
    line-height: 1.4;
}

.chat-bubble-outgoing {
    background: var(--color-primary);
    border-radius: 12px 12px 0px 12px;
    line-height: 1.4;
}

.chat-preview-footer {
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 0.3);
    z-index: 1;
    position: relative;
}

.server-port-col {
    width: 150px;
}
</style>
