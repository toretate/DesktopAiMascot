import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigData, defaultData } from '../src/config/config-data';
export type { ConfigData };
export { defaultData };

// アプリケーション名を明示的に指定し、起動方法（VS Codeデバッガ vs CLI）によるuserDataディレクトリ（config.json保存先）のズレを防止
app.setName('desktop-ai-mascot');

export class AppConfig {
    private configPath: string;
    private data: ConfigData;

    constructor() {
        if (!app.isPackaged) {
            // 開発環境ではプロジェクトのルートディレクトリにある config.json を使用してサーバーと同期する
            this.configPath = path.resolve(__dirname, '../../config.json');
        } else {
            this.configPath = path.join(app.getPath('userData'), 'config.json');
        }
        console.log(`[Config] Persistent configuration path: ${this.configPath}`);
        this.data = this.load();
    }

    private load(): ConfigData {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileData = fs.readFileSync(this.configPath, 'utf8');
                return { ...defaultData, ...JSON.parse(fileData) };
            }
        } catch (error) {
            console.error('[Config] Failed to load config file:', error);
        }
        return defaultData;
    }


    public get(): ConfigData {
        return this.data;
    }

    public update(newData: Partial<ConfigData>) {
        const mergedData = { ...this.data };
        for (const key of Object.keys(newData) as Array<keyof ConfigData>) {
            if (newData[key] !== undefined) {
                (mergedData as any)[key] = newData[key];
            }
        }
        this.data = mergedData;
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 4), 'utf8');
        } catch (error) {
            console.error('[Config] Failed to save config file:', error);
        }
    }
}
