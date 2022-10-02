import ElectronStore from "electron-store";
import { ipcMain } from "electron";
import path from "path";
import { EventEmitter } from "stream";
import { CombatLogParser } from "./combatLogParser";
import { configSchema, ConfigurationSchema } from "./configSchema";
import fs from 'fs';

export default class ConfigService extends EventEmitter {
    // @ts-ignore 'schema' is "wrong", but it really isn't.
    private _store = new ElectronStore<ConfigurationSchema>({configSchema, name: 'config-v2'});

    constructor() {
        super();

        this._store.onDidAnyChange((newValue: any, oldValue: any) => {
            this.emit('configChanged', oldValue, newValue);
        });

        // Update the default for buffer-storage-path whenever 'storage-path' changes
        this._store.onDidChange('storagePath', (newValue: any) => this.updateDefaults('storagePath', newValue));

        // We don't wait to wait until the first storagePath update to set the default
        // bufferStoragePath correctly, as we immediately load config on start-up and
        // don't want to end up with a blank string, force it to update now.  
        const storagePath = this.get<string>('storagePath');

        if (storagePath) {
            this.updateDefaults('storagePath', storagePath);
        }

        /**
         * Getter and setter config listeners. 
         */
        ipcMain.on('config', (event, args) => {
            const [fn, key] = args;

            if (fn === 'get') {
                const value = this.get(key);
                console.log('[Config Service] Get from config store:', key, value);
                event.returnValue = value;
            } else
            if (fn === 'set') {
                const value = args[2];
                this.set(key, value);
                console.log('[Config Service] Set in config store:', key, value);
            }
        });
    }

    validate(): boolean {
        const storagePath = this.get<string>('storagePath');

        if (storagePath) {
            this.updateDefaults('storagePath', storagePath);
        }

        if (!this.get('storagePath') || !fs.existsSync(path.dirname(storagePath))) {
            console.warn('[Config Service] Validation failed: `storagePath` is empty');
            return false;
        }

        const bufferStoragePath = this.get<string>('bufferStoragePath');
        
        if (!bufferStoragePath || (bufferStoragePath.length === 0) || !fs.existsSync(path.dirname(bufferStoragePath))) {
            console.warn('[Config Service] Validation failed: `bufferStoragePath` is invalid');
            return false;
        }

        // Check if the specified paths is a valid WoW Combat Log directory
        const combatLogPaths = ['retailLogPath', 'classicLogPath'];
        let hasValidCombatLogPath = false;
        
        combatLogPaths.forEach(configKey => {
            const logPath = this.get<string>(configKey as keyof ConfigurationSchema)

            if (!logPath) {
                return;
            }

            const wowFlavour = CombatLogParser.getWowFlavour(logPath);

            if (wowFlavour === 'unknown') {
                console.warn(`[Config Service] Ignoring invalid combat log directory '${logPath}' for '${configKey}'.`);
                return;
            }

            hasValidCombatLogPath = true;
        });

        if (!hasValidCombatLogPath) {
            console.warn(`[Config Service] No valid WoW Combat Log directory has been configured.`)
        }

        return hasValidCombatLogPath;
    }

    has(key: keyof ConfigurationSchema): boolean {
        return this._store.has(key);
    }

    get<T>(key: keyof ConfigurationSchema): T {
        if (!configSchema[key]) {
            throw Error(`[Config Service] Attempted to get invalid configuration key '${key}'`)
        }

        const value = this._store.get(key);

        if (!this._store.has(key) || (value === '' || value === null || value === undefined)) {
            if (configSchema[key] && (configSchema[key].default !== undefined)) {
                return (configSchema[key].default as T);
           }
        }

        return (value as T)
    }

    set(key: keyof ConfigurationSchema, value: any): void {
        if (!configSchema[key]) {
            throw Error(`[Config Service] Attempted to set invalid configuration key '${key}'`)
        }

        if (value === null || value === undefined || value === '') {
            this._store.delete(key);
        } else {
            this._store.set(key, value);
        }
    }

    getPath(key: keyof ConfigurationSchema): string {
        const value = this.getString(key);
        
        if (!value) {
            return '';
        }

        return path.join(value, path.sep);
    }

    getNumber(key: keyof ConfigurationSchema): number {
        return this.has(key) ? parseInt(this.get(key)) : NaN;
    }

    getString(key: keyof ConfigurationSchema): string {
        return this.has(key) ? (this.get(key) as string) : '';
    }

    /**
     * Return a value for the `bufferStoragePath` setting, based on the given `storagePath`.
     *   - If `bufferStoragePath` is not empty, it will simply be returned.
     *   - If `bufferStoragePath` is empty, and `storagePath` is empty, so will `bufferStoragePath` be.
     *   - If `bufferStoragePath` is empty, and `storagePath` is not empty, we'll construct a default value.
     */
    private resolveBufferStoragePath (storagePath?: string, bufferStoragePath?: string): string {
        if (bufferStoragePath) {
            return bufferStoragePath;
        }

        return storagePath ? path.join(storagePath, '.temp') : '';
    }

    private updateDefaults(key: string, newValue: any): void {
        if (key === 'storagePath') {
            configSchema['bufferStoragePath'].default = this.resolveBufferStoragePath(
                newValue as string,
                this.get('bufferStoragePath')
            );
            return;
        }
    }
};
