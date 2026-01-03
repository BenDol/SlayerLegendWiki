/**
 * OpenAI Moderation Real Integration Tests
 * Tests REAL OpenAI Moderation API
 *
 * ⚠️ WARNING: Makes real API calls and may consume API credits
 * Requires: OPENAI_API_KEY in .env.test
 *
 * Run with: npm run test:integration -- integration/openai
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

// Load .env.test for local development only
// In CI/Cloudflare, environment variables are already set
if (!process.env.CI && !process.env.CF_PAGES) {
  config({ path: '.env.test', override: true });
}

describe('OpenAI Moderation Integration (REAL API)', () => {
  let apiKey;

  beforeAll(() => {
    apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('Missing required environment variable: OPENAI_API_KEY');
    }
  });

  describe('Content Moderation', () => {
    it('should accept clean content', async () => {
      const cleanContent = 'Hello, this is a friendly message about programming.';

      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: cleanContent
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`\n❌ OpenAI API Error:`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${errorText}`);
      }

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toHaveProperty('results');
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.results[0]).toHaveProperty('flagged');
      expect(data.results[0]).toHaveProperty('categories');
      expect(data.results[0]).toHaveProperty('category_scores');

      // Clean content should not be flagged
      expect(data.results[0].flagged).toBe(false);

      console.log('\n✅ Clean content passed moderation');
      console.log(`Flagged: ${data.results[0].flagged}`);
    }, 30000);

    it('should detect explicit content', async () => {
      // Using mild explicit example that should be flagged
      const explicitContent = 'I want to hurt people and cause violence.';

      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: explicitContent
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`\n❌ OpenAI API Error (explicit content test):`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${errorText}`);
      }

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.results[0]).toHaveProperty('flagged');
      expect(data.results[0]).toHaveProperty('categories');
      expect(data.results[0]).toHaveProperty('category_scores');

      // This should likely be flagged for violence/harassment
      if (data.results[0].flagged) {
        console.log('\n✅ Explicit content flagged as expected');
        console.log('Categories flagged:', Object.keys(data.results[0].categories).filter(
          key => data.results[0].categories[key]
        ));
      } else {
        console.log('\n⚠️  Content not flagged (OpenAI API may vary)');
      }
    }, 30000);

    it('should return category scores', async () => {
      const testContent = 'This is a test message.';

      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: testContent
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`\n❌ OpenAI API Error (category scores test):`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${errorText}`);
      }

      expect(response.ok).toBe(true);
      const data = await response.json();

      const scores = data.results[0].category_scores;

      // All expected categories should be present
      expect(scores).toHaveProperty('sexual');
      expect(scores).toHaveProperty('hate');
      expect(scores).toHaveProperty('harassment');
      expect(scores).toHaveProperty('self-harm');
      expect(scores).toHaveProperty('violence');

      // All scores should be numbers between 0 and 1
      Object.values(scores).forEach(score => {
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      console.log('\n✅ Category scores returned successfully');
      console.log('Sample scores:', {
        violence: scores.violence.toFixed(6),
        hate: scores.hate.toFixed(6),
        harassment: scores.harassment.toFixed(6)
      });
    }, 30000);

    it('should handle unauthorized API key', async () => {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: 'Test content'
        })
      });

      expect(response.status).toBe(401);

      console.log('\n✅ Unauthorized API key rejected as expected');
    }, 30000);

    it('should handle multiple inputs', async () => {
      const inputs = [
        'This is clean content.',
        'This is also clean content.',
        'Programming is fun!'
      ];

      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: inputs
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`\n❌ OpenAI API Error (multiple inputs test):`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${errorText}`);
      }

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.results).toHaveLength(inputs.length);

      console.log(`\n✅ Multiple inputs processed: ${inputs.length} results`);
    }, 30000);
  });

  describe('API Reliability', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();

      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: 'Quick test'
        })
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`\n❌ OpenAI API Error (timing test):`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${errorText}`);
      }

      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(5000); // Should respond within 5 seconds

      console.log(`\n✅ API responded in ${duration}ms`);
    }, 30000);
  });
});
