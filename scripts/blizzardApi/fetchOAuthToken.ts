import { Buffer } from 'buffer';
import { z } from 'zod';

import memoize from 'lodash/memoize';

const OAuthTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.any(), // Do not validating right now.
});

/**
 * Fetches an OAuth token from Blizzard API using client credentials.
 * @param clientId Blizzard API client ID
 * @param clientSecret Blizzard API client secret
 * @returns Access token string
 */
export async function fetchOAuthToken(
  clientId?: string,
  clientSecret?: string,
): Promise<string> {
  clientId ??= process.env.BLIZZARD_CLIENT_ID;
  clientSecret ??= process.env.BLIZZARD_CLIENT_SECRET;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const data = 'grant_type=client_credentials';
  const response = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: data,
  });
  const json = await response.json();
  const parsed = OAuthTokenResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      'Invalid OAuth token response: ' + JSON.stringify(parsed.error.issues),
    );
  }

  return parsed.data.access_token;
}

/**
 * Memoized variant of fetchOAuthToken using lodash/memoize.
 * Caches based on clientId and clientSecret.
 */
export const fetchOAuthTokenMemoized = memoize(
  async (clientId?: string, clientSecret?: string) => {
    return await fetchOAuthToken(clientId, clientSecret);
  },
  (clientId, clientSecret) => `${clientId}:${clientSecret}`,
);
