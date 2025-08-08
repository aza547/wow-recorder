import { fetchOAuthToken } from '../fetchOAuthToken';

describe('fetchOAuthToken', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        access_token: 'mock_token',
        token_type: 'bearer',
        expires_in: 86399,
        scope: 'example.scope',
      }),
    });
  });

  it('returns access_token from valid response', async () => {
    const token = await fetchOAuthToken('test_id', 'test_secret');
    expect(token).toBe('mock_token');
    // Validate that fetch was called with correct parameters using native Jest
    expect(global.fetch).toHaveBeenCalledWith(
      'https://oauth.battle.net/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Basic dGVzdF9pZDp0ZXN0X3NlY3JldA==',
        }),
        body: 'grant_type=client_credentials',
      }),
    );
  });

  it('throws error for missing access_token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ invalid: true }),
    });
    await expect(fetchOAuthToken('test_id', 'test_secret')).rejects.toThrow(
      'Invalid OAuth token response:',
    );
  });
});
