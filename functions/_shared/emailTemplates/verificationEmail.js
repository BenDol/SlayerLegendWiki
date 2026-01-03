/**
 * Slayer Legend Wiki - Email Verification Template
 * Beautiful, responsive HTML email template for verification codes
 */

/**
 * Generate verification email HTML
 * @param {string} code - 6-digit verification code
 * @returns {string} HTML email template
 */
export function generateVerificationEmail(code) {
  return `
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
                        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); border: 2px solid #3b82f6; border-radius: 8px; padding: 16px 24px; display: inline-block;">
                          <div style="color: #ffffff; font-size: 42px; font-weight: bold; letter-spacing: 12px; font-family: 'Courier New', monospace; text-align: center;">
                            ${code}
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
                    If you didn't request this code, you can safely ignore this email. The code will expire automatically.
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
                    Complete guide for Slayer Legend: Idle RPG (슬레이어 키우기)
                  </p>
                  <div style="margin-top: 16px;">
                    <a href="https://slayerlegend.wiki" style="color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 600;">Visit Wiki →</a>
                  </div>
                </td>
              </tr>

            </table>

            <!-- Mobile optimizations -->
            <div style="display: none; max-height: 0px; overflow: hidden;">
              Your Slayer Legend Wiki verification code is: ${code}. Valid for 10 minutes.
            </div>

          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Generate plain text version of verification email
 * @param {string} code - 6-digit verification code
 * @returns {string} Plain text email
 */
export function generateVerificationEmailText(code) {
  return `
⚔️ SLAYER LEGEND WIKI
Email Verification

Thank you for contributing to the Slayer Legend Wiki!

Your verification code is:

    ${code}

⏱️ This code will expire in 10 minutes.

Enter this code in the wiki editor to verify your email address. After verification, you can make multiple edits for 24 hours without re-verifying.

If you didn't request this code, you can safely ignore this email. The code will expire automatically.

────────────────────────────────
Slayer Legend Wiki
Complete guide for Slayer Legend: Idle RPG (슬레이어 키우기)
https://slayerlegend.wiki
  `.trim();
}
