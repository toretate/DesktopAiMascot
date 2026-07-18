<script setup lang="ts">
import { computed } from 'vue';
import { parseMarkdownMessage } from '../../utils/markdown-message';
import MarkdownInline from './MarkdownInline.vue';

const props = defineProps<{ text: string }>();
const blocks = computed(() => parseMarkdownMessage(props.text));
</script>

<template>
    <div class="markdown-message">
        <template v-for="(block, index) in blocks" :key="index">
            <component :is="`h${block.level}`" v-if="block.type === 'heading'" class="markdown-heading">
                <MarkdownInline :nodes="block.content" />
            </component>
            <p v-else-if="block.type === 'paragraph'">
                <MarkdownInline :nodes="block.content" />
            </p>
            <blockquote v-else-if="block.type === 'blockquote'">
                <MarkdownInline :nodes="block.content" />
            </blockquote>
            <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.type === 'list'">
                <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
                    <MarkdownInline :nodes="item" />
                </li>
            </component>
            <pre v-else-if="block.type === 'code'"><code :data-language="block.language || undefined">{{ block.text }}</code></pre>
            <div v-else-if="block.type === 'table'" class="markdown-table-scroll">
                <table>
                    <thead>
                        <tr><th v-for="(cell, cellIndex) in block.headers" :key="cellIndex"><MarkdownInline :nodes="cell" /></th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
                            <td v-for="(cell, cellIndex) in row" :key="cellIndex"><MarkdownInline :nodes="cell" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <hr v-else-if="block.type === 'separator'">
        </template>
    </div>
</template>

<style scoped>
.markdown-message {
    min-width: 0;
    line-height: 1.65;
    overflow-wrap: anywhere;
}

.markdown-message > :first-child {
    margin-top: 0;
}

.markdown-message > :last-child {
    margin-bottom: 0;
}

p {
    margin: 0 0 0.7em;
}

.markdown-heading {
    margin: 1em 0 0.45em;
    color: inherit;
    font-weight: 700;
    line-height: 1.35;
}

h1 { font-size: 1.3em; }
h2 { font-size: 1.2em; }
h3 { font-size: 1.12em; }
h4, h5, h6 { font-size: 1.04em; }

ul,
ol {
    margin: 0.35em 0 0.8em;
    padding-left: 1.45em;
}

li {
    margin: 0.24em 0;
    padding-left: 0.12em;
}

blockquote {
    margin: 0.5em 0 0.8em;
    padding: 0.35em 0.65em;
    border-left: 3px solid rgba(124, 58, 237, 0.45);
    background: rgba(255, 255, 255, 0.28);
    border-radius: 0 6px 6px 0;
}

:deep(code) {
    padding: 0.1em 0.32em;
    border-radius: 4px;
    background: rgba(15, 23, 42, 0.09);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.92em;
}

pre {
    max-width: 100%;
    margin: 0.5em 0 0.8em;
    padding: 0.7em;
    overflow-x: auto;
    border-radius: 7px;
    background: rgba(15, 23, 42, 0.88);
    color: #e2e8f0;
    white-space: pre;
}

pre code {
    padding: 0;
    background: transparent;
    color: inherit;
}

:deep(a) {
    color: var(--color-primary-active);
    text-decoration: underline;
    text-underline-offset: 2px;
}

.markdown-table-scroll {
    max-width: 100%;
    margin: 0.5em 0 0.8em;
    overflow-x: auto;
    border: 1px solid rgba(124, 58, 237, 0.18);
    border-radius: 7px;
}

table {
    width: 100%;
    min-width: 280px;
    border-collapse: collapse;
    font-size: 0.92em;
}

th,
td {
    padding: 0.42em 0.55em;
    border-right: 1px solid rgba(124, 58, 237, 0.12);
    border-bottom: 1px solid rgba(124, 58, 237, 0.12);
    text-align: left;
    vertical-align: top;
}

th {
    background: rgba(124, 58, 237, 0.1);
    font-weight: 700;
}

tr:last-child td { border-bottom: 0; }
th:last-child,
td:last-child { border-right: 0; }

hr {
    margin: 0.8em 0;
    border: 0;
    border-top: 1px solid rgba(124, 58, 237, 0.2);
}
</style>
