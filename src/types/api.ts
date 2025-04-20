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
