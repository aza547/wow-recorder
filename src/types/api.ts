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

export const ChatMessage = z.object({
  id: z.number(),
  guildName: z.string(),
  userName: z.string(),
  start: z.number(),
  uniqueHash: z.string(),
  message: z.string(),
});

export type TChatMessage = z.infer<typeof ChatMessage>;
