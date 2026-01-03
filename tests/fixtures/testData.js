/**
 * Test Data Fixtures
 * Reusable test data for all tests
 */

export const mockSkillBuild = {
  name: 'Test Skill Build',
  maxSlots: 10,
  slots: [
    { skillId: 7, level: 130 },
    { skillId: 9, level: 130 },
    { skillId: 10, level: 130 },
    { skillId: 4, level: 130 },
    { skillId: null, level: 1 }
  ],
  id: 'skill-builds-1766218568747-test',
  createdAt: '2025-12-20T08:16:08.747Z',
  updatedAt: '2025-12-20T08:16:09.114Z'
};

export const mockBattleLoadout = {
  name: 'Test Battle Loadout',
  skillBuild: {
    name: 'Test Skill Build',
    maxSlots: 10,
    slots: [
      { skillId: 7, level: 130 },
      { skillId: 9, level: 130 },
      { skillId: 10, level: 130 }
    ]
  },
  spiritBuild: {
    name: 'Test Spirit Build',
    slots: [
      { spiritId: 2, level: 1, awakeningLevel: 0, evolutionLevel: 4, skillEnhancementLevel: 0 },
      { spiritId: 9, level: 1, awakeningLevel: 0, evolutionLevel: 4, skillEnhancementLevel: 0 }
    ]
  },
  spirit: null,
  skillStone: null,
  promotionAbility: null,
  familiar: null,
  id: 'battle-loadouts-1766219113794-test',
  createdAt: '2025-12-20T08:25:13.794Z',
  updatedAt: '2025-12-20T12:50:06.912Z'
};

export const mockSpirit = {
  spiritId: 1,
  level: 1,
  awakeningLevel: 5,
  evolutionLevel: 4,
  skillEnhancementLevel: 0,
  id: 'my-spirits-1766217975811-test',
  createdAt: '2025-12-20T08:06:15.811Z',
  updatedAt: '2025-12-20T08:06:32.145Z'
};

export const mockSpiritBuild = {
  name: 'Test Spirit Build',
  slots: [
    { spiritId: 2, level: 1, awakeningLevel: 0, evolutionLevel: 4, skillEnhancementLevel: 0 },
    { spiritId: 7, level: 1, awakeningLevel: 0, evolutionLevel: 4, skillEnhancementLevel: 0 },
    { spiritId: 1, level: 1, awakeningLevel: 5, evolutionLevel: 4, skillEnhancementLevel: 0 }
  ],
  id: 'spirit-builds-1766217547293-test',
  createdAt: '2025-12-20T07:59:07.293Z',
  updatedAt: '2025-12-20T22:24:52.509Z'
};

export const mockEngravingBuild = {
  id: 'engraving-builds-1766275000000-test',
  name: 'Test Engraving Build',
  weaponId: '56',
  weaponName: 'Wanderer',
  gridState: [
    [1, 0, 1],
    [0, 1, 0],
    [1, 1, 1]
  ],
  inventory: [
    { id: 'rune-1', type: 'fire', level: 3 },
    { id: 'rune-2', type: 'ice', level: 2 }
  ],
  createdAt: '2025-12-21T00:00:00.000Z',
  updatedAt: '2025-12-21T00:00:00.000Z'
};

export const mockGridSubmission = {
  weaponId: '56',
  weaponName: 'Wanderer',
  gridType: '5x5',
  completionEffect: {
    atk: 58.8,
    hp: 253.2
  },
  activeSlots: [
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 1, col: 1 }
  ],
  totalActiveSlots: 4,
  submittedBy: 'testuser',
  gridLayout: [
    [1, 1, 0],
    [0, 1, 1],
    [1, 0, 1]
  ]
};

export const mockUser = {
  username: 'testuser',
  userId: 12345,
  email: 'test@example.com',
  displayName: 'Test User'
};

export const mockIssue = {
  number: 1,
  title: 'Test Issue',
  body: 'Test issue body',
  html_url: 'https://github.com/test-owner/test-repo/issues/1',
  labels: [{ name: 'test-label' }],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  state: 'open',
  user: {
    login: 'test-wiki-bot'
  }
};

export const mockComment = {
  id: 123456,
  body: 'Test comment body',
  created_at: '2024-01-01T00:00:00Z',
  html_url: 'https://github.com/test-owner/test-repo/issues/1#issuecomment-123456'
};

export const mockPullRequest = {
  number: 2,
  title: '[Anonymous] Update Test Page',
  body: 'Test PR body',
  html_url: 'https://github.com/test-owner/test-repo/pull/2',
  head: { ref: 'test-branch' },
  base: { ref: 'main' },
  state: 'open'
};

export const mockDeviceCodeResponse = {
  device_code: 'test-device-code-12345',
  user_code: 'ABCD-1234',
  verification_uri: 'https://github.com/login/device',
  expires_in: 900,
  interval: 5
};

export const mockAccessTokenResponse = {
  access_token: 'gho_test-access-token-12345',
  token_type: 'bearer',
  scope: 'repo'
};

export const mockRecaptchaResponse = {
  success: true,
  score: 0.9,
  action: 'submit',
  challenge_ts: '2024-01-01T00:00:00Z',
  hostname: 'localhost'
};

export const mockOpenAIModerationResponse = {
  id: 'modr-test-123',
  model: 'text-moderation-latest',
  results: [{
    flagged: false,
    categories: {
      sexual: false,
      hate: false,
      harassment: false,
      'self-harm': false,
      'sexual/minors': false,
      'hate/threatening': false,
      'violence/graphic': false,
      'self-harm/intent': false,
      'self-harm/instructions': false,
      'harassment/threatening': false,
      violence: false
    },
    category_scores: {
      sexual: 0.0001,
      hate: 0.0001,
      harassment: 0.0001,
      'self-harm': 0.0001,
      'sexual/minors': 0.0001,
      'hate/threatening': 0.0001,
      'violence/graphic': 0.0001,
      'self-harm/intent': 0.0001,
      'self-harm/instructions': 0.0001,
      'harassment/threatening': 0.0001,
      violence: 0.0001
    }
  }]
};

export const mockSendGridResponse = {
  statusCode: 202,
  body: '',
  headers: {
    'x-message-id': 'test-message-id-123'
  }
};
