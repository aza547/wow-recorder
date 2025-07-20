import { z } from 'zod';
import { REALM_LOCALE_VALUES_SCHEMA } from './REALM_LOCALES';

// Schema for localized name objects
const LocalizedNameSchema = z.object({
  it_IT: z.string().optional(),
  ru_RU: z.string().optional(),
  en_GB: z.string().optional(),
  zh_TW: z.string().optional(),
  ko_KR: z.string().optional(),
  en_US: z.string().optional(),
  es_MX: z.string().optional(),
  pt_BR: z.string().optional(),
  es_ES: z.string().optional(),
  zh_CN: z.string().optional(),
  fr_FR: z.string().optional(),
  de_DE: z.string().optional(),
});

// Schema for the key object containing href
const RealmKeySchema = z.object({
  href: z.string(),
});

// Schema for the region object
const RealmRegionSchema = z.object({
  name: LocalizedNameSchema,
  id: z.number(),
});

// Schema for the realm type object
const RealmTypeSchema = z.object({
  name: LocalizedNameSchema,
  type: z.string(),
});

// Schema for the realm data object
const RealmDataSchema = z.object({
  is_tournament: z.boolean(),
  timezone: z.string(),
  name: LocalizedNameSchema,
  id: z.number(),
  region: RealmRegionSchema,
  category: LocalizedNameSchema,
  // Object keys will loose
  locale: REALM_LOCALE_VALUES_SCHEMA,
  type: RealmTypeSchema,
  slug: z.string(),
});

// Schema for individual realm result
const RealmResultSchema = z.object({
  key: RealmKeySchema,
  data: RealmDataSchema,
});

// Main schema for the realm search response
export const RealmSearchResponseSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  maxPageSize: z.number(),
  pageCount: z.number(),
  results: z.array(RealmResultSchema),
});

// Type definitions
export type LocalizedName = z.infer<typeof LocalizedNameSchema>;
export type RealmKey = z.infer<typeof RealmKeySchema>;
export type RealmRegion = z.infer<typeof RealmRegionSchema>;
export type RealmType = z.infer<typeof RealmTypeSchema>;
export type RealmData = z.infer<typeof RealmDataSchema>;
export type RealmResult = z.infer<typeof RealmResultSchema>;
export type RealmSearchResponse = z.infer<typeof RealmSearchResponseSchema>;
