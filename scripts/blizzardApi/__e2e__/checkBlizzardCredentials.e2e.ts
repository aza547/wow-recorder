// Integration test for checking Blizzard API credentials
// Requires BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET to be set in environment

describe('Blizzard API credentials (integration)', () => {
  it('checks if BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET are set', () => {
    expect(process.env.BLIZZARD_CLIENT_ID).toBeDefined();
    expect(process.env.BLIZZARD_CLIENT_SECRET).toBeDefined();
    expect(process.env.BLIZZARD_CLIENT_ID).not.toBe('');
    expect(process.env.BLIZZARD_CLIENT_SECRET).not.toBe('');

    console.dir(`Both Blizzard Client ID and Secret are set.`);
  });
});
