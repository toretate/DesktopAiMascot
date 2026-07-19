import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse, compileStyle } from '@vue/compiler-sfc';

// 探索するディレクトリ
const searchDir = path.resolve(__dirname, '..');

// 再帰的に.vueファイルを取得する関数
function getVueFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== '__tests__' && file !== 'node_modules') {
                getVueFiles(filePath, fileList);
            }
        } else if (filePath.endsWith('.vue')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

describe('設定画面のCSSスコープ化テスト', () => {
    it('settings配下の全Vueファイルのstyleタグがscoped属性を持っていること', () => {
        const vueFiles = getVueFiles(searchDir);
        expect(vueFiles.length).toBeGreaterThan(0);

        for (const file of vueFiles) {
            const content = fs.readFileSync(file, 'utf-8');

            // SFCをパースしてstyleブロックを抽出
            const { descriptor, errors } = parse(content, {
                filename: file,
                sourceMap: false,
                ignoreEmpty: false
            });

            // パースエラーチェック
            if (errors.length > 0) {
                console.error(`SFC parse errors in ${file}:`, errors);
            }
            expect(errors.length, `ファイル ${file} のパースエラー`).toBe(0);

            // 全てのstyleタグがscoped属性を持つことを保証
            for (const style of descriptor.styles) {
                expect(style.scoped, `ファイル ${file} に scoped 属性のない style タグが存在します`).toBe(true);
            }
        }
    });

    it('settings配下の全Vueファイルのstyleブロックがscoped CSSとして正常にコンパイルできること', () => {
        const vueFiles = getVueFiles(searchDir);
        expect(vueFiles.length).toBeGreaterThan(0);

        for (const file of vueFiles) {
            const content = fs.readFileSync(file, 'utf-8');

            const { descriptor, errors } = parse(content, {
                filename: file,
                sourceMap: false,
                ignoreEmpty: false
            });

            expect(errors.length, `ファイル ${file} のパースエラー`).toBe(0);

            for (let i = 0; i < descriptor.styles.length; i++) {
                const style = descriptor.styles[i];
                const result = compileStyle({
                    source: style.content,
                    filename: file,
                    id: 'data-v-test',
                    scoped: true,
                    isProd: false
                });

                if (result.errors.length > 0) {
                    console.error(`style compile errors in ${file} (style index ${i}):`, result.errors);
                }
                expect(result.errors.length, `ファイル ${file} (style index ${i}) の scoped CSS コンパイルエラー`).toBe(0);
            }
        }
    });
});

