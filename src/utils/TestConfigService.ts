/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import { ConfigurationSchema } from 'config/configSchema';
import { IConfigService } from '../config/ConfigService';

/**
 * Test implementation of the ConfigService class.
 */
export default class ConfigService
  extends EventEmitter
  implements IConfigService
{
  has(_key: keyof ConfigurationSchema): boolean {
    throw new Error('Method not implemented.');
  }

  get<T>(key: keyof ConfigurationSchema): T {
    if (key === 'language') {
      return 'English' as unknown as T;
    }
    throw new Error('Method not implemented.');
  }

  set(_key: keyof ConfigurationSchema, _value: any): void {
    throw new Error('Method not implemented.');
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
