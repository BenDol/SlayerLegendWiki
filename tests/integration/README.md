# Real Integration Tests

This directory contains real integration tests that make actual HTTP requests to external APIs.

## ⚠️ WARNING

These tests:
- Make real API calls to external services
- Consume API quotas/credits
- Require valid API keys (from `.env.test` locally or environment variables in CI/Cloudflare)
- May take longer to run than unit tests
- Run automatically before Cloudflare deployments via `prebuild:cloudflare`

## Running Real Integration Tests

```bash
# Run all real integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- tests/integration/github-oauth.integration.test.js

# Run with coverage
npm run test:integration -- --coverage
```

## Required Environment Variables

### Local Development

Create a `.env.test` file in the project root with the following variables:

```bash
# GitHub OAuth (for device-code and access-token tests)
# Note: Device Flow only needs client_id, NOT client_secret
GITHUB_CLIENT_ID=your_github_client_id

# GitHub API (for github-bot tests)
WIKI_BOT_TOKEN=your_github_pat_token
WIKI_REPO_OWNER=your_test_repo_owner
WIKI_REPO_NAME=your_test_repo_name

# SendGrid (for email verification tests)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_verified_sender_email

# OpenAI (for profanity check tests)
OPENAI_API_KEY=your_openai_api_key

# Email Verification
EMAIL_VERIFICATION_SECRET=your_secret_key_32_chars_long

# reCAPTCHA (for anonymous PR tests)
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

### Cloudflare Pages (CI/CD)

Tests run automatically before each Cloudflare deployment via `prebuild:cloudflare`.

Set these environment variables in **Cloudflare Pages Dashboard**:
1. Go to your site → Settings → Environment variables
2. Add each variable for **Production** and **Preview** environments:
   - `GITHUB_CLIENT_ID`
   - `WIKI_BOT_TOKEN`
   - `WIKI_REPO_OWNER`
   - `WIKI_REPO_NAME`
   - `SENDGRID_API_KEY`
   - `SENDGRID_FROM_EMAIL`
   - `OPENAI_API_KEY`
   - `EMAIL_VERIFICATION_SECRET`
   - `RECAPTCHA_SECRET_KEY`

**Note:** Cloudflare automatically sets `CF_PAGES=1`, which tells tests to use environment variables instead of `.env.test`.

## Test Suites

### github-oauth.integration.test.js
Tests real GitHub OAuth device flow:
- Device code initiation
- Token polling (authorization_pending)
- Access token exchange

### sendgrid.integration.test.js
Tests real SendGrid email sending:
- Verification email delivery
- Email format validation
- Template rendering

### openai.integration.test.js
Tests real OpenAI Moderation API:
- Profanity detection
- Content moderation
- Category scoring

### github-api.integration.test.js
Tests real GitHub API operations:
- Issue creation
- Comment posting
- PR creation
- Label management

## Best Practices

1. **Use test accounts/repos**: Never run these tests against production data
2. **Rate limiting**: Be mindful of API rate limits
3. **Cost**: Some APIs charge per request (OpenAI, SendGrid)
4. **Cleanup**: Tests should clean up created resources when possible
5. **Isolation**: Each test should be independent
6. **Manual review**: Review test results manually to ensure API responses are as expected

## Skipping Tests

To skip integration tests in normal test runs, they are in a separate directory and require explicit command to run.

Regular unit tests: `npm test`
Integration tests: `npm run test:integration`
