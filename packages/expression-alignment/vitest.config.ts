import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // コア・Node アダプタは DOM 非依存なので node 環境で実行する
        environment: 'node',
        include: ['**/__tests__/**/*.test.ts'],
    },
});
