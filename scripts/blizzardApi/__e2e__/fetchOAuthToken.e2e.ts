import process from 'node:process';
import { fetchOAuthToken } from '../fetchOAuthToken';

// Integration test for fetchOAuthToken
// Requires BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET to be set in environment

describe('fetchOAuthToken (integration)', () => {
  it('fetches a real token from Blizzard API', async () => {
    const clientId = process.env.BLIZZARD_CLIENT_ID!;
    const clientSecret = process.env.BLIZZARD_CLIENT_SECRET!;

    const token = await fetchOAuthToken(clientId, clientSecret);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    console.info(`Token fetched: ${token}`);
  });
});
