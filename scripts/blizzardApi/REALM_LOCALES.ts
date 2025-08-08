import { z } from 'zod';
import { LOCALE_TO_NAME, SupportedLocale } from '../../data/locales';

/** I do not know why, but "realm locale" returns in such format */
export const REALM_LOCALES: Record<string, SupportedLocale> = Object.keys(
  LOCALE_TO_NAME,
).reduce(
  (acc, locale) => {
    const realmLocale = locale.replace('_', '');
    acc[realmLocale] = locale as SupportedLocale;
    return acc;
  },
  {} as Record<string, SupportedLocale>,
);

/** We need this casting to identify that is it "not empty array" for Zod. Actually it is fixed length array, but I blieve so strict type will be Overkill */
export const REALM_LOCALE_VALUES = Object.keys(REALM_LOCALES) as [
  string,
  ...string[],
];

/** So, i'll just put this part of Zod schema here to keep it together with REALM_LOCALES transformation */
export const REALM_LOCALE_VALUES_SCHEMA = z.enum(REALM_LOCALE_VALUES);
