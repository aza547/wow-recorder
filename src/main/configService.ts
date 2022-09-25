import ElectronStore from "electron-store";
import { ipcMain } from "electron";
import path from "path";
import { EventEmitter } from "stream";

type ConfigurationSchema = {
    'storage-path': string,
    'buffer-storage-path'?: string,
    'log-path': string,
    'log-path-classic'?: string,
    'max-storage': number,
    'monitor-index': number,
    'selected-category': number,
    'audio-input-device'?: string,
    'audio-output-device'?: string,
    'min-encounter-duration': number,
    'start-up'?: boolean,
};

/**
 * 
 */
const schema = {
    'storage-path': {
        description: 'Filesystem path where finalized videos are stored',
        type: 'string',
    },
    'buffer-storage-path': {
        description: 'Filesystem path where temporary videos files are stored',
        type: 'string',
        default: '',
    },
    'log-path': {
        description: 'Filesystem path where WoW Retail combat logs are stored',
        type: 'string',
    },
    'log-path-classic': {
        description: 'Filesystem path where WoW Classic combat logs are stored',
        type: 'string',
        default: '',
    },
    'max-storage': {
        description: 'Maximum allowed storage, in GB, that the application will consume for non-protected video files',
        type: 'integer',
        default: 20,
        minimum: 1,
    },
    'monitor-index': {
        description: 'The one-based index of the display to record',
        type: 'integer',
        default: 1,
        minimum: 1,
        maximum: 4,        
    },
    'selected-category': {
        description: 'Last selected video category in the UI',
        type: 'integer',
        default: 0,
    },
    'audio-input-device': {
        description: 'Audio input device to be included in the recording',
        type: 'string',
        default: 'all',
    },
    'audio-output-device': {
        description: 'Audio output device to be included in the recording',
        type: 'string',
        default: 'all',
    },
    'min-encounter-duration': {
        description: 'Minimum boss encounter duration, in seconds, in order for it to not be discarded [Raids only]',
        type: 'integer',
        default: 15,
        maximum: 10000,
    },
    'start-up': {
        description: 'Whether the application starts on Windows start-up',
        type: 'boolean',
        default: false,
    },
};

export default class ConfigService extends EventEmitter {
    private _store = new ElectronStore<ConfigurationSchema>({schema, configName: 'newConfig'});
    private _defaults: ConfigurationSchema = {
        'storage-path': '',
        'buffer-storage-path': '',
        'log-path': '',
        'log-path-classic': '',
        'max-storage': 0,
        'monitor-index': 1,
        'selected-category': 0,
        'audio-input-device': 'all',
        'audio-output-device': 'all',
        'min-encounter-duration': 15,
        'start-up': false,
    };

    constructor() {
        super();

        this._store.onDidAnyChange((newValue: any, oldValue: any) => {
            this.emit('configChanged', oldValue, newValue);
        });

        // Update the default for buffer-storage-path whenever 'storage-path' changes
        this._store.onDidChange('storage-path', (newValue: any) => {
            this._defaults['buffer-storage-path'] = this.resolveBufferStoragePath(
                newValue as string,
                this.get('buffer-storage-path')
            );
        });

        /**
         * Getter and setter config listeners. 
         */
        ipcMain.on('config', (event, args) => {
            const [fn, key] = args;

            if (fn === 'get') {
                const value = this._store.get(key);
                console.log("[ConfigService] Got from config store: ", key, value);
                event.returnValue = value;
            } else
            if (fn === 'set') {
                const value = args[2];
                console.log("[ConfigService] Setting in config store: ", key, value);
                this._store.set(key, value);
            }
        });
    }

    validate(): boolean {
        return false;
    }

    has(key: keyof ConfigurationSchema): boolean {
        return this._store.has(key);
    }

    get(key: keyof ConfigurationSchema): any {
        if (!this.has(key) && this._defaults.hasOwnProperty(key)) {
            return this._defaults[key];
        }

        return this._store.get(key);
    }

    set(key: keyof ConfigurationSchema, value: any): void {
        this._store.set(key, value);
    }

    getPath(key: keyof ConfigurationSchema): string {
        return path.join(this.get(key), path.sep);
    }

    getNumber(key: keyof ConfigurationSchema): number {
        return this.has(key) ? parseInt(this.get(key)) : NaN;
    }

    getString(key: keyof ConfigurationSchema): string {
        return this.has(key) ? (this.get(key) as string) : '';
    }

    /**
     * Return a value for the `bufferStoragePath` setting, based on the given `storagePath`.
     *
     * If `bufferStoragePath` is not empty, it will simply be returned.
     * If `bufferStoragePath` is empty, and `storagePath` is empty, so will `bufferStoragePath` be.
     * If `bufferStoragePath` is empty, and `storagePath` is not empty, we'll construct
     * a default value.
     */
    private resolveBufferStoragePath (storagePath?: string, bufferStoragePath?: string): string {
        if (bufferStoragePath) {
            return bufferStoragePath;
        }

        // Do not use `path` here, as it uses Node JS `process` which isn't available in the render process.
        return storagePath ? path.join(storagePath, '.temp') : '';
    };
};
