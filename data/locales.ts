export const LOCALE_TO_NAME: Record<string, string> = {
  en_US: 'English (United States)',
  es_MX: 'Spanish (Mexico)',
  pt_BR: 'Portuguese',
  pt_PT: 'Portuguese', // I do not know why, but there is a different variants of Portuguese in Realm locale data and in Localization data
  de_DE: 'German',
  en_GB: 'English (Great Britain)',
  es_ES: 'Spanish (Spain)',
  fr_FR: 'French',
  it_IT: 'Italian',
  ru_RU: 'Russian',
  ko_KR: 'Korean',
  zh_TW: 'Chinese (Traditional)',
  zh_CN: 'Chinese (Simplified)',
} as const;

export type SupportedLocale = keyof typeof LOCALE_TO_NAME;
