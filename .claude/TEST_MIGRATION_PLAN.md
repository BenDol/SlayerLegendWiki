# Test Infrastructure Migration Plan

## Executive Summary

Migrate shared serverless infrastructure and tests to the wiki-framework, establish comprehensive test coverage for both framework and parent project, and integrate framework tests into CI/CD pipeline.

---

## Phase 1: Framework Structure Analysis

### What Exists Now

**Main Project (`wiki/`)**:
```
functions/_shared/
├── adapters/
│   ├── PlatformAdapter.js     ← MOVE TO FRAMEWORK
│   ├── ConfigAdapter.js       ← MOVE TO FRAMEWORK
│   └── CryptoAdapter.js       ← MOVE TO FRAMEWORK
├── handlers/
│   ├── access-token.js        ← STAY (uses adapters)
│   ├── device-code.js         ← STAY (uses adapters)
│   ├── github-bot.js          ← STAY (app-specific)
│   ├── save-data.js           ← STAY (app-specific)
│   ├── load-data.js           ← STAY (app-specific)
│   └── delete-data.js         ← STAY (app-specific)
├── oauth.js                   ← MOVE TO FRAMEWORK
├── jwt.js                     ← MOVE TO FRAMEWORK
├── sendgrid.js                ← MOVE TO FRAMEWORK
├── utils.js                   ← REVIEW (mixed concerns)
├── validation.js              ← STAY (app-specific rules)
├── validationRules.js         ← STAY (app-specific)
├── WikiGitHubStorage.js       ← STAY (app-specific)
├── createWikiStorage.js       ← STAY (app-specific)
└── githubBot.js               ← STAY (app-specific)

tests/
├── adapters/                  ← MOVE TO FRAMEWORK
│   ├── PlatformAdapter.test.js
│   ├── ConfigAdapter.test.js
│   └── CryptoAdapter.test.js
├── handlers/                  ← STAY (test app handlers)
├── integration/               ← STAY (test app integrations)
├── mocks/                     ← MOVE shared mocks TO FRAMEWORK
├── helpers/                   ← MOVE shared helpers TO FRAMEWORK
└── fixtures/                  ← STAY (app-specific data)
```

**Framework (`wiki-framework/`)**:
```
serverless/netlify/functions/  ← OLD IMPLEMENTATION
├── access-token.js            ← REPLACE with adapter pattern
├── device-code.js             ← REPLACE with adapter pattern
└── [other old files]          ← DEPRECATE

(No test infrastructure exists)
```

---

## Phase 2: What Moves to Framework

### 2.1 Core Adapters (MOVE)
**Rationale**: Platform abstraction is a framework concern

- ✅ `PlatformAdapter.js` - Abstracts Netlify/Cloudflare differences
- ✅ `ConfigAdapter.js` - Handles wiki-config.json loading
- ✅ `CryptoAdapter.js` - Platform-agnostic crypto operations

### 2.2 Shared Serverless Utilities (MOVE)
**Rationale**: Generic serverless helpers

- ✅ `oauth.js` - GitHub OAuth device flow (generic)
- ✅ `jwt.js` - Web Crypto JWT implementation (generic)
- ✅ `sendgrid.js` - SendGrid email wrapper (generic)

### 2.3 Adapter Tests (MOVE)
**Rationale**: Test framework infrastructure

- ✅ `tests/adapters/PlatformAdapter.test.js`
- ✅ `tests/adapters/ConfigAdapter.test.js`
- ✅ `tests/adapters/CryptoAdapter.test.js`

### 2.4 Test Helpers (MOVE)
**Rationale**: Shared test utilities

- ✅ `tests/helpers/adapterHelpers.js` - Mock creation helpers
- ✅ `tests/mocks/externalApis.js` - API mocks
- ✅ `tests/mocks/octokit.js` - Octokit mocks
- ⚠️  `tests/mocks/storage.js` - REVIEW (app-specific?)

---

## Phase 3: Framework Test Environment Setup

### 3.1 Install Test Dependencies in Framework

```json
// wiki-framework/package.json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 3.2 Create Vitest Config

```javascript
// wiki-framework/vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['serverless/**/*.js', 'src/**/*.{js,jsx}'],
      exclude: ['**/node_modules/**', '**/dist/**']
    }
  }
});
```

### 3.3 Create Framework Test Structure

```
wiki-framework/
├── tests/
│   ├── serverless/
│   │   ├── adapters/
│   │   │   ├── PlatformAdapter.test.js
│   │   │   ├── ConfigAdapter.test.js
│   │   │   └── CryptoAdapter.test.js
│   │   └── utils/
│   │       ├── oauth.test.js
│   │       ├── jwt.test.js
│   │       └── sendgrid.test.js
│   ├── components/              ← NEW: Client tests
│   ├── hooks/                   ← NEW: Hook tests
│   ├── helpers/
│   │   └── adapterHelpers.js
│   └── mocks/
│       ├── externalApis.js
│       └── octokit.js
├── serverless/
│   └── shared/                  ← NEW: Framework shared code
│       ├── adapters/
│       ├── utils/
│       └── README.md
└── vitest.config.js
```

---

## Phase 4: Parent Project Integration

### 4.1 Update Parent Project to Use Framework Adapters

```javascript
// functions/_shared/handlers/github-bot.js
import { PlatformAdapter, ConfigAdapter, CryptoAdapter } from 'github-wiki-framework/serverless/shared/adapters';
```

### 4.2 Run Framework Tests from Parent

```json
// wiki/package.json
{
  "scripts": {
    "test": "npm run test:framework && vitest run",
    "test:framework": "cd wiki-framework && npm test",
    "test:all": "npm run test:framework && npm run test",
    "test:watch": "vitest watch"
  }
}
```

---

## Phase 5: CI/CD Integration

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies (framework)
        run: cd wiki-framework && npm ci

      - name: Install dependencies (parent)
        run: npm ci

      - name: Run framework tests
        run: cd wiki-framework && npm test

      - name: Run parent tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration
        env:
          GITHUB_CLIENT_ID: ${{ secrets.GITHUB_CLIENT_ID }}
          # ... other secrets
```

### 5.2 Cloudflare Pages Integration

```yaml
# wrangler.toml or cloudflare config
[build]
  command = "npm run test:all && npm run build:cloudflare"
```

---

## Phase 6: Coverage Analysis

### 6.1 Critical User Flows to Test

**Authentication & Authorization**:
- ✅ GitHub OAuth device flow (integration test exists)
- ❌ User session management (MISSING)
- ❌ Permission checks for admin actions (MISSING)

**Data Management**:
- ✅ Save/Load/Delete for all data types (tested)
- ❌ Data validation edge cases (PARTIAL)
- ❌ Concurrent access scenarios (MISSING)

**GitHub Bot Operations**:
- ✅ Email verification flow (tested)
- ✅ Anonymous PR creation (tested)
- ❌ Rate limiting (MISSING)
- ❌ Error recovery (PARTIAL)

**Content Rendering**:
- ❌ Markdown rendering (MISSING)
- ❌ Custom components (MISSING)
- ❌ Link handling (MISSING)

**UI Components**:
- ❌ Navigation (MISSING)
- ❌ Search (MISSING)
- ❌ Editor (MISSING)
- ❌ Builder components (MISSING)

### 6.2 Coverage Targets

- **Adapters**: 100% (critical infrastructure)
- **Handlers**: 90% (business logic)
- **Components**: 80% (UI logic)
- **Integration**: Key user flows (E2E scenarios)

---

## Phase 7: Client-Side Component Tests

### 7.1 Framework Components to Test

```javascript
// wiki-framework/tests/components/
├── Navigation.test.jsx
├── Search.test.jsx
├── ContentRenderer.test.jsx
├── MarkdownEditor.test.jsx
├── PageViewer.test.jsx
└── ErrorBoundary.test.jsx
```

### 7.2 Parent Project Components to Test

```javascript
// tests/components/
├── EquipmentCard.test.jsx
├── EquipmentPicker.test.jsx
├── SoulWeaponEngravingBuilder.test.jsx
├── BattleLoadoutBuilder.test.jsx
└── [other game-specific components]
```

### 7.3 Testing Library Setup

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

---

## Phase 8: Execution Checklist

### Step 1: Framework Setup
- [ ] Install test dependencies in framework
- [ ] Create vitest.config.js
- [ ] Create test directory structure
- [ ] Set up test scripts

### Step 2: Move Shared Code
- [ ] Create serverless/shared/ directory
- [ ] Move adapters to framework
- [ ] Move utilities (oauth, jwt, sendgrid)
- [ ] Update imports in parent project

### Step 3: Move Tests
- [ ] Move adapter tests to framework
- [ ] Move test helpers to framework
- [ ] Update test imports
- [ ] Verify all tests pass

### Step 4: Integration
- [ ] Add framework test runner to parent
- [ ] Update CI/CD workflows
- [ ] Test local execution
- [ ] Test CI execution

### Step 5: Coverage Expansion
- [ ] Identify gaps in test coverage
- [ ] Write missing handler tests
- [ ] Write missing integration tests
- [ ] Write component tests (framework)
- [ ] Write component tests (parent)

### Step 6: Verification
- [ ] Run all tests locally
- [ ] Run tests in CI
- [ ] Generate coverage reports
- [ ] Review coverage gaps
- [ ] Document any known limitations

---

## Timeline Estimate

- Phase 1-2 (Analysis): ✅ Complete
- Phase 3 (Framework Setup): 30 minutes
- Phase 4 (Code Migration): 1 hour
- Phase 5 (CI/CD): 30 minutes
- Phase 6 (Coverage Analysis): 1 hour
- Phase 7 (Component Tests): 2-3 hours
- Phase 8 (Verification): 30 minutes

**Total**: ~6-7 hours

---

## Risk Mitigation

**Risk**: Breaking existing functionality during migration
**Mitigation**: Move incrementally, run tests after each step

**Risk**: Import path issues after moving to framework
**Mitigation**: Update all imports immediately, use find/replace

**Risk**: Test failures due to environment differences
**Mitigation**: Ensure test environments match (Node version, dependencies)

**Risk**: CI/CD failures on Cloudflare
**Mitigation**: Test locally first, use same test commands

---

## Success Criteria

✅ All framework tests pass independently
✅ All parent tests pass with framework as dependency
✅ Framework tests run in parent's CI/CD
✅ Coverage reports show >85% overall
✅ No functionality regressions
✅ Documentation updated
