/**
 * SendGrid Real Integration Tests
 * Tests REAL SendGrid email API
 *
 * ⚠️ WARNING: Sends real emails and consumes SendGrid credits
 * Requires: SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in .env.test
 *
 * Run with: npm run test:integration -- integration/sendgrid
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { config } from 'dotenv';

// Load .env.test for local development only
// In CI/Cloudflare, environment variables are already set
if (!process.env.CI && !process.env.CF_PAGES) {
  config({ path: '.env.test', override: true });
}

describe('SendGrid Integration (REAL API)', () => {
  let apiKey;
  let fromEmail;

  beforeAll(() => {
    apiKey = process.env.SENDGRID_API_KEY;
    fromEmail = process.env.SENDGRID_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      throw new Error('Missing required environment variables: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL');
    }
  });

  describe('Email Sending', () => {
    it('should send verification email successfully', async () => {
      const verificationCode = '123456';
      const recipientEmail = fromEmail; // Send to self for testing

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: recipientEmail }],
            subject: '[TEST] Verify your email - Slayer Legend Wiki'
          }],
          from: { email: fromEmail },
          content: [{
            type: 'text/plain',
            value: `Your verification code is: ${verificationCode}\n\nThis is a test email.`
          }, {
            type: 'text/html',
            value: `<p>Your verification code is: <strong>${verificationCode}</strong></p><p>This is a test email.</p>`
          }]
        })
      });

      if (response.status !== 202) {
        const errorText = await response.text();
        console.log(`\n❌ SendGrid API Error:`);
        console.log(`Status: ${response.status}`);
        console.log(`Response: ${errorText}`);
      }

      expect(response.status).toBe(202); // SendGrid returns 202 Accepted
      const messageId = response.headers.get('x-message-id');
      expect(messageId).toBeTruthy();

      console.log(`\n✅ Email sent successfully`);
      console.log(`Message ID: ${messageId}`);
      console.log(`Recipient: ${recipientEmail}`);
    }, 30000);

    it('should reject invalid email format', async () => {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: 'invalid-email' }],
            subject: '[TEST] Verify your email'
          }],
          from: { email: fromEmail },
          content: [{
            type: 'text/plain',
            value: 'Test'
          }]
        })
      });

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData).toHaveProperty('errors');

      console.log('\n✅ Invalid email format rejected as expected');
    }, 30000);

    it('should reject unauthorized API key', async () => {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: fromEmail }],
            subject: '[TEST] Verify your email'
          }],
          from: { email: fromEmail },
          content: [{
            type: 'text/plain',
            value: 'Test'
          }]
        })
      });

      expect(response.status).toBe(401);

      console.log('\n✅ Unauthorized API key rejected as expected');
    }, 30000);
  });

  describe('Email Validation', () => {
    it('should validate sender email is verified', async () => {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: fromEmail }],
            subject: '[TEST] Sender verification'
          }],
          from: { email: 'unverified@example.com' }, // Unverified sender
          content: [{
            type: 'text/plain',
            value: 'Test'
          }]
        })
      });

      // SendGrid should reject unverified sender
      expect(response.status).toBe(403);

      console.log('\n✅ Unverified sender rejected as expected');
    }, 30000);
  });
});
