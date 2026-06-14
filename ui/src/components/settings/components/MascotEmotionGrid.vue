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
            engine: string;
            style: string;
            speaker_id: number;
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
</template>

<style scoped>
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
.expression-grid-cell.is-previewing {
    border: 1.5px solid #a855f7 !important;
    background-color: #f5f3ff !important;
}
.expression-grid-cell.is-previewing:hover {
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.12) !important;
}

/* 通常表示の星ボタン・バッジ */
.expression-star-btn {
    position: absolute !important;
    top: 8px !important;
    right: 8px !important;
    z-index: 10 !important;
    line-height: 1 !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
}

/* 通常選択されていない星は非表示。親セルをホバーしたときに表示 */
.expression-grid-cell .expression-star-btn {
    display: none !important;
}
.expression-grid-cell:hover .expression-star-btn {
    display: block !important;
}

/* 選択中の星、またはホバー時の非選択の星のカラー */
.expression-star-btn i {
    font-size: 11px !important;
    color: #94a3b8 !important; /* 一般色のグレー */
}

/* 現在通常表示として設定されている星は常に表示され、黄色になる */
.expression-star-btn.is-default {
    display: block !important; /* ホバーしてなくても表示 */
}
.expression-star-btn.is-default i {
    color: #eab308 !important; /* 星のゴールド */
}
.expression-star-btn:not(.is-default):hover i {
    color: #eab308 !important;
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
</style>
