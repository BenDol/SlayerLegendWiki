/**
 * SendGrid Test Script
 * Tests SendGrid integration by sending a test verification email
 *
 * Usage: node scripts/testSendGrid.js <your-email@example.com>
 */

import sgMail from '@sendgrid/mail';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@slayerlegend.wiki';

if (!SENDGRID_API_KEY) {
  console.error('❌ Error: SENDGRID_API_KEY not found in .env.local');
  console.log('\nPlease add your SendGrid API key to .env.local:');
  console.log('SENDGRID_API_KEY=your_api_key_here\n');
  process.exit(1);
}

const recipientEmail = process.argv[2];

if (!recipientEmail) {
  console.error('❌ Error: No recipient email provided');
  console.log('\nUsage: node scripts/testSendGrid.js <your-email@example.com>\n');
  process.exit(1);
}

// Email regex validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(recipientEmail)) {
  console.error('❌ Error: Invalid email format');
  process.exit(1);
}

console.log('📧 SendGrid Integration Test');
console.log('─────────────────────────────');
console.log(`From: ${SENDGRID_FROM_EMAIL}`);
console.log(`To: ${recipientEmail}`);
console.log('');

// Generate test verification code
const testCode = Math.floor(100000 + Math.random() * 900000).toString();

sgMail.setApiKey(SENDGRID_API_KEY);

const msg = {
  to: recipientEmail,
  from: {
    email: SENDGRID_FROM_EMAIL,
    name: 'Slayer Legend Wiki'
  },
  subject: '[TEST] Verify your email - Slayer Legend Wiki',
  text: `This is a TEST email to verify SendGrid integration.\n\nYour verification code is: ${testCode}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification - Slayer Legend Wiki</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0f172a;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">

              <!-- Header with gradient -->
              <tr>
                <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center;">
                  <img
                    src="https://slayerlegend.wiki/images/logo.png"
                    alt="Slayer Legend"
                    width="96"
                    height="96"
                    style="display: block; margin: 0 auto 16px auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);"
                  />
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">Slayer Legend Wiki</h1>
                  <p style="margin: 8px 0 0 0; color: #fecaca; font-size: 14px; letter-spacing: 0.5px;">VERIFICATION CODE</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 24px 0; color: #e2e8f0; font-size: 16px; line-height: 1.6;">
                    Thank you for contributing to the Slayer Legend Wiki! To complete your anonymous edit, please use the verification code below:
                  </p>

                  <!-- Code Box -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding: 0 0 32px 0;">
                        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; display: inline-block;">
                          <div style="color: #ffffff; font-size: 42px; font-weight: bold; letter-spacing: 12px; font-family: 'Courier New', monospace; text-align: center;">
                            ${testCode}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- Info Box -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #334155; border-left: 4px solid #f59e0b; border-radius: 6px;">
                    <tr>
                      <td style="padding: 16px 20px;">
                        <p style="margin: 0; color: #fbbf24; font-size: 14px; font-weight: 600;">⏱️ Expires in 10 minutes</p>
                        <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
                          Enter this code in the wiki editor to verify your email address. After verification, you can make multiple edits for 24 hours without re-verifying.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 32px 0 0 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                    <strong style="color: #e2e8f0;">This is a TEST email.</strong><br>
                    If you didn't request this code, you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #0f172a; padding: 30px; text-align: center; border-top: 1px solid #334155;">
                  <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">
                    Sent by <strong style="color: #94a3b8;">Slayer Legend Wiki</strong>
                  </p>
                  <p style="margin: 0; color: #475569; font-size: 12px;">
                    Complete guide for Slayer Legend: Idle RPG
                  </p>
                  <div style="margin-top: 16px;">
                    <a href="https://slayerlegend.wiki" style="color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 600;">Visit Wiki →</a>
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `,
};

console.log('⏳ Sending test email...\n');

try {
  await sgMail.send(msg);
  console.log('✅ Success! Test email sent successfully.');
  console.log('');
  console.log('📬 Check your inbox for the test email.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Check your email inbox (and spam folder)');
  console.log('2. Verify the email looks correct');
  console.log('3. If everything looks good, your SendGrid integration is working!');
  console.log('');
  console.log('Test verification code sent:', testCode);
  console.log('');
} catch (error) {
  console.error('❌ Failed to send test email');
  console.error('');
  console.error('Error details:');
  console.error(error.response?.body || error.message || error);
  console.error('');

  if (error.code === 403) {
    console.error('💡 This error usually means:');
    console.error('   - Your SendGrid API key is invalid');
    console.error('   - Your API key doesn\'t have permission to send emails');
    console.error('   - Your sender email is not verified in SendGrid');
    console.error('');
    console.error('   Please verify your sender email in SendGrid:');
    console.error('   https://app.sendgrid.com/settings/sender_auth');
  }

  process.exit(1);
}
