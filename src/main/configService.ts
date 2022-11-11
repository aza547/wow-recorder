import ElectronStore from "electron-store";
import { ipcMain } from "electron";
import path from "path";
import { EventEmitter } from "stream";
import { CombatLogParser } from "./combatLogParser";
import { configSchema, ConfigurationSchema } from "./configSchema";
import fs from 'fs';

export default class ConfigService extends EventEmitter {
    /**
     * Singleton instance of class
     */
    private static _instance: ConfigService;

    // @ts-ignore 'schema' is "wrong", but it really isn't.
    private _store = new ElectronStore<ConfigurationSchema>({configSchema, name: 'config-v2'});

    /**
     * Get the instance of the class as a singleton.
     * There should only ever be one instance created and this method facilitates that.
     */
    static getInstance(): ConfigService {
        if (!ConfigService._instance) {
            ConfigService._instance = new ConfigService();
        }

        return ConfigService._instance;
    }

    private constructor() {
        super();

        this.cleanupStore();

        console.log('[Config Service] Using configuration', this._store.store);

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
            switch (args[0]) {
                case 'get': {
                    const value = this.get(args[1]);
                    event.returnValue = value;
                    return;
                }

                case 'set': {
                    const [_, key, value] = args;
                    if (!this.configValueChanged(key, value)) {
                        return;
                    }

                    this.set(key, value);
                    this.emit('change', key, value);
                    this.logConfigChanged({[key]: value});
                    return;
                }

                case 'set_values': {
                    const configObject = args[1];
                    const configKeys = Object.keys(configObject);
                    const newConfigValues: { [key: string]: any } = {};

                    configKeys.forEach((key: string) => {
                        if (!this.configValueChanged(key, configObject[key])) {
                            return;
                        }

                        newConfigValues[key] = configObject[key];
                    });

                    Object.keys(newConfigValues).forEach((key: any) => {
                        const value = newConfigValues[key];

                        this.set(key, value);
                        this.emit('change', key, value);
                    })

                    this.logConfigChanged(newConfigValues);

                    return;
                }
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
            return;
        }

        this._store.set(key, value);
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
     * Ensure that only keys specified in the `configSchema` exists in the store
     * and delete any that are no longer relevant. This is necessary to keep the
     * config store up to date when config keys occasionally change/become obsolete.
     */
    private cleanupStore(): void {
        const configSchemaKeys = Object.keys(configSchema);
        const keysToDelete = Object.keys(this._store.store)
            .filter(k => !configSchemaKeys.includes(k));

        if (!keysToDelete.length) {
            return;
        }

        // @ts-ignore complains about 'string' not being assignable to
        // keyof ConfigurationSchema, which is true but also moot since we're
        // trying to remove keys that _don't_ exist in the schema.
        keysToDelete.forEach(k => this._store.delete(k));

        console.log("[Config Service] Deleted deprecated keys from configuration store", keysToDelete);
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

    /**
     * Determine whether a configuration value has changed.
     */
    private configValueChanged(key: string, value: any): boolean {
        // We're checking for null here because we don't allow storing
        // null values and as such if we get one, it's because it's empty/shouldn't
        // be saved.
        return (value !== null && (this._store.get(key) !== value));
    }

    private logConfigChanged(newConfig: { [key: string ]: any }): void {
        console.log('[Config Service] Configuration changed:', newConfig);
    }
};
