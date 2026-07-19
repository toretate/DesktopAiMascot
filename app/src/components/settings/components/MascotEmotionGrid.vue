<script setup lang="ts">
import { computed } from 'vue';

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
        chat: {
            engine: string;
            model: string;
            temperature: number;
        };
        voice: {
            engine?: string;
            speaker_id?: number;
            style?: string;
            irodori_voice?: string;
            irodori_model?: string;
        };
    };
    assets: {
        outfits: MascotAsset[];
        expressions: MascotAsset[];
        poses: MascotAsset[];
    };
}

const props = withDefaults(
    defineProps<{
        currentExpressions: MascotAsset[];
        editingMascot: MascotData;
        activePreviewExpression: MascotAsset | null;
        resolveImageUrl: (path: string | undefined | null) => string;
        cols?: number;
    }>(),
    {
        cols: 4
    }
);

const emit = defineEmits<{
    (e: 'select-expression', expr: MascotAsset): void;
    (e: 'set-default', exprId: string): void;
    (e: 'clear-expression', expr: MascotAsset): void;
}>();

// 画像かどうかの判定用ローカル関数
const isImage = (path: string | undefined | null): boolean => {
    if (!path) return false;
    return (
        path.startsWith('data:image/') ||
        path.startsWith('/mascots/') ||
        path.startsWith('http://') ||
        path.startsWith('https://') ||
        /\.(png|jpg|jpeg|webp|gif)$/i.test(path)
    );
};

const gridStyle = computed(() => {
    return {
        display: 'grid',
        gridTemplateColumns: `repeat(${props.cols}, 1fr)`,
        gap: '8px',
        width: '100%',
        padding: '6px',
        boxSizing: 'border-box' as const
    };
});
</script>

<template>
    <div class="expression-grid-container pt-1" :style="gridStyle">
        <div
            v-for="expr in currentExpressions"
            :key="expr.id"
            class="expression-grid-cell"
            :class="{
                'has-image': expr.path,
                'default-expression': editingMascot.defaultExpressionId === expr.id,
                'is-previewing': activePreviewExpression && activePreviewExpression.id === expr.id
            }"
            @click="emit('select-expression', expr)"
            title="クリックして左側のマスコット表示にプレビュー"
        >
            <!-- 右上の標準（通常表示）スターバッジ / ホバー時のスター設定ボタン -->
            <div
                class="expression-star-btn"
                :class="{ 'is-default': editingMascot.defaultExpressionId === expr.id }"
                @click.stop="emit('set-default', expr.id)"
                title="通常表示（標準）の表情に設定"
            >
                <i :class="editingMascot.defaultExpressionId === expr.id ? 'pi pi-star-fill' : 'pi pi-star'"></i>
            </div>

            <!-- 左上の登録解除ボタン (画像がある場合のみ) -->
            <div v-if="expr.path" class="expression-clear-btn" @click.stop="emit('clear-expression', expr)" title="登録解除">
                <i class="pi pi-trash"></i>
            </div>

            <div class="flex align-items-center justify-content-center border-round bg-white overflow-hidden expression-thumbnail-container">
                <img
                    v-if="expr.path && isImage(expr.path)"
                    :src="resolveImageUrl(expr.path)"
                    class="w-full h-full object-contain expression-thumbnail-img"
                />
                <span v-else-if="expr.path" class="text-xs expression-path-fallback">{{ expr.path }}</span>
                <i v-else class="pi pi-plus text-gray-300 hover-text-gray-400 expression-plus-icon" title="表情を追加"></i>
            </div>

            <span class="text-xxs font-bold text-gray-600 text-center w-full text-ellipsis overflow-hidden mt-2 select-none flex align-items-center justify-content-center expression-name-label">
                {{ expr.name }}
            </span>
        </div>
    </div>
</template>

<style scoped>
/* 28スロット表情グリッドセル (フレックスボックスとセンタリングを強力に強制) */
.expression-grid-cell {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    height: 108px;
    width: 100%;
    background-color: #f8fafc;
    padding: 8px;
    box-sizing: border-box;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.expression-grid-cell:hover {
    background-color: #ffffff;
    border: 1.5px dashed var(--color-primary);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--color-primary-alpha-08);
}
.expression-grid-cell.has-image {
    border-style: solid;
    border-color: #e2e8f0;
    background-color: #ffffff;
}
.expression-grid-cell.default-expression {
    border: 1.5px dashed #eab308;
    background-color: #fefce8;
}
.expression-grid-cell.default-expression:hover {
    box-shadow: 0 4px 12px rgba(234, 179, 8, 0.12);
}
.expression-grid-cell.is-previewing {
    border: 1.5px solid var(--color-primary);
    background-color: var(--color-primary-subtle);
}
.expression-grid-cell.is-previewing:hover {
    box-shadow: 0 4px 12px var(--color-primary-alpha-12);
}

/* 通常表示の星ボタン・バッジ */
.expression-star-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s ease;
}

/* 通常選択されていない星は非表示。親セルをホバーしたときに表示 */
.expression-grid-cell .expression-star-btn {
    display: none;
}
.expression-grid-cell:hover .expression-star-btn {
    display: block;
}

/* 選択中の星、またはホバー時の非選択の星のカラー */
.expression-star-btn i {
    font-size: 11px;
    color: #94a3b8; /* 一般色のグレー */
}

/* 現在通常表示として設定されている星は常に表示され、黄色になる */
.expression-star-btn.is-default {
    display: block; /* ホバーしてなくても表示 */
}
.expression-star-btn.is-default i {
    color: #eab308; /* 星のゴールド */
}
.expression-star-btn:not(.is-default):hover i {
    color: #eab308;
}

/* 表情登録解除ボタン (左上に配置) */
.expression-clear-btn {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    line-height: 1;
    display: none; /* 通常は非表示 */
    padding: 2px;
    border-radius: 4px;
    transition: all 0.2s ease;
    color: #94a3b8;
}

.expression-grid-cell:hover .expression-clear-btn {
    display: block;
}

.expression-clear-btn:hover {
    background-color: #fee2e2;
    color: #ef4444;
}

.expression-thumbnail-container {
    width: 52px;
    height: 52px;
    border: 1px solid rgba(0, 0, 0, 0.03);
    flex-shrink: 0;
    position: relative;
}

.expression-thumbnail-img {
    width: 52px;
    height: 52px;
    max-width: 52px;
    max-height: 52px;
    object-fit: contain;
    position: static;
}

.expression-path-fallback {
    position: absolute;
}

.expression-plus-icon {
    font-size: 12px;
}

.expression-name-label {
    height: 20px;
    line-height: 1;
    text-align: center;
    justify-content: center;
    align-items: center;
}
</style>
