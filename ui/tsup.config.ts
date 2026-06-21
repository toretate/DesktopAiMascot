import { defineConfig } from 'tsup';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));
const dependencies = Object.keys(pkg.dependencies || {});

export default defineConfig({
    entry: ['electron/main.ts', 'electron/preload.ts'],
    format: ['cjs'],
    outDir: 'dist-electron',
    clean: true,
    minify: true,
    dts: false,
    external: ['electron', ...dependencies],
    outExtension({ format }) {
        return {
            js: '.cjs',
        };
    },
});
