import ElectronStore from 'electron-store';
import { ipcMain } from 'electron';
import path from 'path';
import { EventEmitter } from 'stream';
import { configSchema, ConfigurationSchema } from './configSchema';

/**
 * Interface for the ConfigService class.
 */
export interface IConfigService extends EventEmitter {
  /**
   * Check if a specific configuration key exists.
   * @param key - The configuration key to check.
   */
  has(key: keyof ConfigurationSchema): boolean;

  /**
   * Get the value of a specific configuration key.
   * @param key - The configuration key to retrieve.
   */
  get<T>(key: keyof ConfigurationSchema): T;

  /**
   * Set the value of a specific configuration key.
   * @param key - The configuration key to set.
   * @param value - The value to set for the key.
   */
  set(key: keyof ConfigurationSchema, value: any): void;

  /**
   * Get the value of a configuration key as a number.
   * @param key - The configuration key to retrieve.
   */
  getNumber(key: keyof ConfigurationSchema): number;

  /**
   * Get the value of a configuration key as a string.
   * @param key - The configuration key to retrieve.
   */
  getString(key: keyof ConfigurationSchema): string;

  /**
   * Get the value of a configuration key formatted as a file path.
   * @param key - The configuration key to retrieve.
   */
  getPath(key: keyof ConfigurationSchema): string;
}

export default class ConfigService
  extends EventEmitter
  implements IConfigService
{
  /**
   * Singleton instance of class.
   */
  private static _instance: ConfigService;

  private _store = new ElectronStore<ConfigurationSchema>({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore 'schema' is "wrong", but it really isn't.
    configSchema,
    name: 'config-v3',
  });

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

    const loggable = this._store.store;

    if (loggable.cloudAccountPassword) {
      loggable.cloudAccountPassword = '**********';
    }

    console.info('[Config Service] Using configuration', loggable);

    this._store.onDidAnyChange((newValue: any, oldValue: any) => {
      this.emit('configChanged', oldValue, newValue);
    });

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
          const [key, value] = [args[1], args[2]];

          if (!this.configValueChanged(key, value)) {
            return;
          }

          this.set(key, value);
          this.emit('change', key, value);
          ConfigService.logConfigChanged({ [key]: value });
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
          });

          ConfigService.logConfigChanged(newConfigValues);

          return;
        }

        default: {
          console.error(
            '[ConfigService] Unrecognised config call, should be one of get, set or set_values'
          );
        }
      }
    });
  }

  has(key: keyof ConfigurationSchema): boolean {
    return this._store.has(key);
  }

  get<T>(key: keyof ConfigurationSchema): T {
    if (!configSchema[key]) {
      throw Error(
        `[Config Service] Attempted to get invalid configuration key '${key}'`
      );
    }

    const value = this._store.get(key);

    if (
      !this._store.has(key) ||
      value === '' ||
      value === null ||
      value === undefined
    ) {
      if (configSchema[key] && configSchema[key].default !== undefined) {
        return configSchema[key].default as T;
      }
    }

    return value as T;
  }

  set(key: keyof ConfigurationSchema, value: any): void {
    if (!configSchema[key]) {
      throw Error(
        `[Config Service] Attempted to set invalid configuration key '${key}'`
      );
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
    return this.has(key) ? parseInt(this.get(key), 10) : NaN;
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
    const keysToDelete = Object.keys(this._store.store).filter(
      (k) => !configSchemaKeys.includes(k)
    );

    if (!keysToDelete.length) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore complains about 'string' not being assignable to
    // keyof ConfigurationSchema, which is true but also moot since we're
    // trying to remove keys that _don't_ exist in the schema.
    keysToDelete.forEach((k) => this._store.delete(k));

    console.info(
      '[Config Service] Deleted deprecated keys from configuration store',
      keysToDelete
    );
  }

  /**
   * Determine whether a configuration value has changed.
   */
  private configValueChanged(key: string, value: any): boolean {
    // We're checking for null here because we don't allow storing
    // null values and as such if we get one, it's because it's empty/shouldn't
    // be saved.
    return value !== null && this._store.get(key) !== value;
  }

  private static logConfigChanged(newConfig: { [key: string]: any }): void {
    if (newConfig.cloudAccountPassword) {
      newConfig.cloudAccountPassword = '**********';
    }

    console.info('[Config Service] Configuration changed:', newConfig);
  }
}
