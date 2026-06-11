import { z } from 'zod';

export const Affiliation = z.object({
  id: z.number(),
  userName: z.string(),
  guildName: z.string(),
  read: z.boolean(),
  write: z.boolean(),
  del: z.boolean(),
  admin: z.boolean(),
});

export type TAffiliation = z.infer<typeof Affiliation>;

export const ChatMessageWithId = z.object({
  id: z.number(),
  correlator: z.string(),
  userName: z.string(),
  message: z.string(),
  timestamp: z.number(),
});

export type TChatMessageWithId = z.infer<typeof ChatMessageWithId>;

export const KeystoneTimerResponse = z.object({
  1: z.number(),
  2: z.number(),
  3: z.number(),
});

export type TKeystoneTimerResponse = z.infer<typeof KeystoneTimerResponse>;

export const Guild = z.object({
  guildName: z.string(),
  bucketName: z.string(),
  tableName: z.string(),
  usageGB: z.number(),
  limitGB: z.number(),
  mtime: z.number(),
  expiry: z.number(),
  region: z.string(),
  patreonMemberId: z.string(),
  disabled: z.boolean(),
  migrated: z.boolean(),
});

export const PublicGuildInfo = Guild.omit({
  bucketName: true,
  tableName: true,
  patreonMemberId: true,
});

export type TPublicGuildInfo = z.infer<typeof PublicGuildInfo>;
