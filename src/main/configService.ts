import ElectronStore from "electron-store";
import { ipcMain } from "electron";
import path from "path";
import { EventEmitter } from "stream";
import { CombatLogParser } from "./combatLogParser";

type ConfigurationSchema = {
    storagePath: string,
    bufferStoragePath?: string,
    retailLogPath?: string,
    classicLogPath?: string,
    maxStorage: number,
    monitorIndex: number,
    selectedCategory: number,
    audioInputDevice?: string,
    audioOutputDevice?: string,
    minEncounterDuration: number,
    startUp?: boolean,
    recordRetail: boolean,
    recordClassic: boolean,
    recordRaids: boolean,
    recordDungeons: boolean,
    recordTwoVTwo: boolean,
    recordThreeVThree: boolean,
    recordSkirmish: boolean,
    recordSoloShuffle: boolean,
    recordBattlegrounds: boolean,
};

/**
 * Config schema. 
 */
const schema = {
    storagePath: {
        description: 'Filesystem path where finalized videos are stored',
        type: 'string',
        default: '',
    },
    bufferStoragePath: {
        description: 'Filesystem path where temporary videos files are stored',
        type: 'string',
        default: '',
    },
    retailLogPath: {
        description: 'Filesystem path where WoW Retail combat logs are stored',
        type: 'string',
        default: '',
    },
    classicLogPath: {
        description: 'Filesystem path where WoW Classic combat logs are stored',
        type: 'string',
        default: '',
    },
    maxStorage: {
        description: 'Maximum allowed storage, in GB, that the application will consume for non-protected video files',
        type: 'integer',
        default: 20,
        minimum: 1,
    },
    monitorIndex: {
        description: 'The one-based index of the display to record',
        type: 'integer',
        default: 1,
        minimum: 1,
        maximum: 4,        
    },
    selectedCategory: {
        description: 'Last selected video category in the UI',
        type: 'integer',
        default: 0,
    },
    audioInputDevice: {
        description: 'Audio input device to be included in the recording',
        type: 'string',
        default: 'all',
    },
    audioOutputDevice: {
        description: 'Audio output device to be included in the recording',
        type: 'string',
        default: 'all',
    },
    minEncounterDuration: {
        description: 'Minimum boss encounter duration, in seconds, in order for it to not be discarded [Raids only]',
        type: 'integer',
        default: 15,
        maximum: 10000,
    },
    startUp: {
        description: 'Whether the application starts on Windows start-up',
        type: 'boolean',
        default: false,
    },
    recordRetail: {
        description: 'Whether the application should record retail',
        type: 'boolean',
        default: true,
    },
    recordClassic: {
        description: 'Whether the application should record classic',
        type: 'boolean',
        default: true,
    },
    recordRaids: {
        description: 'Whether the application should record raids',
        type: 'boolean',
        default: true,
    },
    recordDungeons: {
        description: 'Whether the application should record Mythic+',
        type: 'boolean',
        default: true,
    },
    recordTwoVTwo: {
        description: 'Whether the application should record 2v2',
        type: 'boolean',
        default: true,
    },
    recordThreeVThree: {
        description: 'Whether the application should record 3v3',
        type: 'boolean',
        default: true,
    },
    recordSkirmish: {
        description: 'Whether the application should record skirmishes',
        type: 'boolean',
        default: true,
    },
    recordSoloShuffle: {
        description: 'Whether the application should record solo shuffle',
        type: 'boolean',
        default: true,
    },
    recordBattlegrounds: {
        description: 'Whether the application should record battlegrounds',
        type: 'boolean',
        default: true,
    },
};

export default class ConfigService extends EventEmitter {
    private _store = new ElectronStore<ConfigurationSchema>({schema, name: 'config-v2'});

    constructor() {
        super();

        this._store.onDidAnyChange((newValue: any, oldValue: any) => {
            this.emit('configChanged', oldValue, newValue);
        });

        // Update the default for buffer-storage-path whenever 'storage-path' changes
        this._store.onDidChange('storagePath', (newValue: any) => this.updateDefaults('storagePath', newValue));

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
        const storagePath = this.get('storagePath');

        if (storagePath) {
            this.updateDefaults('storagePath', storagePath);
        }

        if (!this.get('storagePath')) {
            console.warn('[Config Service] Validation failed: `storagePath` is empty');
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
        if (!schema[key]) {
            throw Error(`[Config Service] Attempted to get invalid configuration key '${key}'`)
        }

        const value = this._store.get(key);

        if (!this._store.has(key) || (value === '' || value === null || value === undefined)) {
            if (schema[key] && schema[key].default) {
                return (schema[key].default as T);
           }
        }

        return (value as T)
    }

    set(key: keyof ConfigurationSchema, value: any): void {
        if (!schema[key]) {
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
            schema['bufferStoragePath'].default = this.resolveBufferStoragePath(
                newValue as string,
                this.get('bufferStoragePath')
            );
            return;
        }
    }
};
