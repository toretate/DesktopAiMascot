import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigData, defaultData } from '../src/config/config-data';
export type { ConfigData };
export { defaultData };

// アプリケーション名を明示的に指定し、起動方法（VS Codeデバッガ vs CLI）によるuserDataディレクトリ（config.json保存先）のズレを防止
app.setName('tonarice');

export class AppConfig {
    private configPath: string;
    private backupPath: string;
    private data: ConfigData;
    private isReadOnlyMode: boolean = false;

    constructor() {
        if (!app.isPackaged) {
            // 開発環境では storage 直下の config.json を使用してサーバーと同期する
            this.configPath = path.resolve(__dirname, '../../storage/config.json');
        } else {
            this.configPath = path.join(app.getPath('userData'), 'config.json');
        }
        this.backupPath = this.configPath + '.bak';
        console.log(`[Config] Persistent configuration path: ${this.configPath}`);
        this.data = this.load();
    }

    private load(): ConfigData {
        try {
            if (fs.existsSync(this.configPath)) {
                const fileData = fs.readFileSync(this.configPath, 'utf8');
                const parsed = JSON.parse(fileData);
                // 正常にパースできたらバックアップを作成しておく
                this.createBackup(fileData);
                return { ...defaultData, ...parsed };
            }
        } catch (error) {
            console.error('[Config] Failed to load config file. Attempting backup restore:', error);
            const backupData = this.loadBackup();
            if (backupData) {
                console.log('[Config] Successfully restored config from backup.');
                // メインの config.json を復元保存する
                this.writeConfig(backupData);
                return backupData;
            }
            
            // バックアップも破損している、または存在しない場合
            console.error('[Config] Backup is also missing or corrupted. Starting with default settings in ReadOnly mode to protect corrupted config.');
            this.isReadOnlyMode = true;
        }
        return defaultData;
    }

    private createBackup(dataStr: string) {
        try {
            const tmpBackup = this.backupPath + '.tmp';
            fs.writeFileSync(tmpBackup, dataStr, 'utf8');
            fs.renameSync(tmpBackup, this.backupPath);
        } catch (err) {
            console.error('[Config] Failed to create backup file:', err);
        }
    }

    private loadBackup(): ConfigData | null {
        try {
            if (fs.existsSync(this.backupPath)) {
                const fileData = fs.readFileSync(this.backupPath, 'utf8');
                return { ...defaultData, ...JSON.parse(fileData) };
            }
        } catch (error) {
            console.error('[Config] Failed to load backup config file:', error);
        }
        return null;
    }

    private writeConfig(config: ConfigData): boolean {
        try {
            const tmpPath = this.configPath + '.tmp';
            fs.writeFileSync(tmpPath, JSON.stringify(config, null, 4), 'utf8');
            fs.renameSync(tmpPath, this.configPath);
            return true;
        } catch (error) {
            console.error('[Config] Failed to write config file:', error);
            return false;
        }
    }

    public get(): ConfigData {
        return this.data;
    }

    public update(newData: Partial<ConfigData>) {
        if (this.isReadOnlyMode) {
            console.warn('[Config] Update ignored because config is in ReadOnly mode due to file corruption.');
            return;
        }

        const mergedData = { ...this.data };
        for (const key of Object.keys(newData) as Array<keyof ConfigData>) {
            if (newData[key] !== undefined) {
                (mergedData as any)[key] = newData[key];
            }
        }
        
        // ローカルの設定ファイルには mascots の重いデータを含めないように除去
        delete (mergedData as any).mascots;

        this.data = mergedData;
        this.writeConfig(this.data);
    }
}
