<template>
    <dialog
        ref="dialogRef"
        class="app-modal-shell"
        :class="[
            `backdrop-${backdrop}`,
            { 'mobile-fullscreen': mobileFullscreen }
        ]"
        :style="modalStyle"
        aria-modal="true"
        :aria-labelledby="titleId || undefined"
        @cancel.prevent="handleCancel"
    >
        <div class="app-modal-shell__content">
            <slot />
        </div>
    </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';

/**
 * AppModalShell の Props 定義
 */
export interface AppModalShellProps {
    /** モーダルの表示状態 */
    visible?: boolean;
    /** aria-labelledby 用のタイトル要素ID */
    titleId?: string;
    /** 閉じる操作を無効化するかどうか */
    closeDisabled?: boolean;
    /** バックドロップのスタイル ('light' | 'dark') */
    backdrop?: 'light' | 'dark';
    /** 幅 (CSSプロパティ値) */
    width?: string;
    /** 最大幅 (CSSプロパティ値) */
    maxWidth?: string;
    /** 高さ (CSSプロパティ値) */
    height?: string;
    /** 最大高さ (CSSプロパティ値) */
    maxHeight?: string;
    /** 内側のパディング (CSSプロパティ値) */
    padding?: string;
    /** モバイル表示時の内側のパディング (CSSプロパティ値) */
    mobilePadding?: string;
    /** モバイル表示時にフルスクリーン化するかどうか */
    mobileFullscreen?: boolean;
    /** z-index 値 */
    zIndex?: number;
}

const props = withDefaults(defineProps<AppModalShellProps>(), {
    visible: false,
    titleId: undefined,
    closeDisabled: false,
    backdrop: 'dark',
    width: 'auto',
    maxWidth: '90vw',
    height: 'auto',
    maxHeight: '90dvh',
    padding: '1.5rem',
    mobilePadding: undefined,
    mobileFullscreen: false,
    zIndex: undefined
});

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'cancel'): void;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const previouslyFocusedElement = ref<HTMLElement | null>(null);

/**
 * ダイアログに適用するインラインスタイル
 */
const modalStyle = computed(() => {
    const style: Record<string, string | number> = {
        width: props.width,
        maxWidth: props.maxWidth,
        height: props.height,
        maxHeight: props.maxHeight,
        padding: props.padding
    };

    if (props.mobilePadding) {
        style['--mobile-padding'] = props.mobilePadding;
    }

    if (props.zIndex !== undefined) {
        style.zIndex = props.zIndex;
    }

    return style;
});

/**
 * モーダルを開く処理
 */
const openModal = () => {
    if (!dialogRef.value) return;
    if (!dialogRef.value.open && !dialogRef.value.hasAttribute('open')) {
        previouslyFocusedElement.value = document.activeElement as HTMLElement | null;
        if (typeof dialogRef.value.showModal === 'function') {
            dialogRef.value.showModal();
        } else {
            dialogRef.value.setAttribute('open', '');
        }
    }
};

/**
 * モーダルを閉じる処理
 */
const closeModal = () => {
    if (!dialogRef.value) return;
    if (dialogRef.value.open || dialogRef.value.hasAttribute('open')) {
        if (typeof dialogRef.value.close === 'function') {
            dialogRef.value.close();
        } else {
            dialogRef.value.removeAttribute('open');
        }
    }
    if (previouslyFocusedElement.value) {
        previouslyFocusedElement.value.focus?.();
        previouslyFocusedElement.value = null;
    }
};

/**
 * Escキー等による cancel イベントハンドラ
 */
const handleCancel = () => {
    if (props.closeDisabled) {
        return;
    }
    emit('cancel');
    emit('close');
};

/**
 * visible prop の変更を監視（nextTick により DOM マウント後かつ二重処理を防ぐ）
 */
watch(
    () => props.visible,
    (isVis) => {
        nextTick(() => {
            if (isVis) {
                openModal();
            } else {
                closeModal();
            }
        });
    },
    { immediate: true }
);

onUnmounted(() => {
    closeModal();
});
</script>

<style scoped>
/* ダイアログ外枠の共通surfaceと初期化スタイル */
.app-modal-shell {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 12px;
    background: #ffffff;
    color: #1e293b;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
    margin: auto;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
}

.app-modal-shell:not([open]) {
    display: none !important;
}

/* ::backdrop スタイル（ダーク） */
.app-modal-shell.backdrop-dark::backdrop {
    background-color: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
}

/* ::backdrop スタイル（ライト） */
.app-modal-shell.backdrop-light::backdrop {
    background-color: rgba(241, 245, 249, 0.8);
    backdrop-filter: blur(12px);
}

/* コンテンツ配置用ラップクラス */
.app-modal-shell__content {
    min-height: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
}

/* モバイルフルスクリーンレスポンシブスタイル */
@media (max-width: 768px) {
    .app-modal-shell.mobile-fullscreen {
        width: 100vw !important;
        height: 100dvh !important;
        max-width: 100vw !important;
        max-height: 100dvh !important;
        border: none;
        border-radius: 0;
        box-shadow: none;
        margin: 0;
        overflow-y: auto;
    }

    .app-modal-shell.mobile-fullscreen[style*="--mobile-padding"] {
        padding: var(--mobile-padding) !important;
    }
}
</style>
