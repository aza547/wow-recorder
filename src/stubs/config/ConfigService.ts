import { EventEmitter } from 'stream';
import { ConfigurationSchema } from 'config/configSchema';

export interface IConfigService extends EventEmitter {
  has(key: keyof ConfigurationSchema): boolean;
  get<T>(key: keyof ConfigurationSchema): T;
  set(key: keyof ConfigurationSchema, value: any): void;
  getNumber(key: keyof ConfigurationSchema): number;
  getString(key: keyof ConfigurationSchema): string;
  getPath(key: keyof ConfigurationSchema): string;
}

export default class ConfigService extends EventEmitter implements IConfigService {
  private static instance: ConfigService;

  private values: Partial<Record<keyof ConfigurationSchema, unknown>> = {
    language: 'English',
  };

  static getInstance(): ConfigService {
    if (!this.instance) this.instance = new ConfigService();
    return this.instance;
  }

  has(key: keyof ConfigurationSchema): boolean {
    return Object.prototype.hasOwnProperty.call(this.values, key);
  }

  get<T>(key: keyof ConfigurationSchema): T {
    if (key === 'language') return 'English' as unknown as T;
    throw new Error(`Test ConfigService missing key: ${String(key)}`);
  }

  set(key: keyof ConfigurationSchema, value: any): void {
    this.values[key] = value;
  }

  getNumber(_key: keyof ConfigurationSchema): number {
    throw new Error('Method not implemented.');
  }

  getString(_key: keyof ConfigurationSchema): string {
    throw new Error('Method not implemented.');
  }

  getPath(_key: keyof ConfigurationSchema): string {
    throw new Error('Method not implemented.');
  }
}

