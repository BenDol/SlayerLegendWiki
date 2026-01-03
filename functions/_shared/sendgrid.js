/**
 * SendGrid Email Helper (Cloudflare Workers compatible)
 * Uses fetch instead of @sendgrid/mail package
 */

/**
 * Send email via SendGrid API
 * @param {Object} options
 * @param {string} options.apiKey - SendGrid API key
 * @param {string} options.to - Recipient email
 * @param {string} options.from - Sender email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendEmail({ apiKey, to, from, subject, text, html }) {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
        }],
        from: { email: from },
        subject,
        content: [
          ...(text ? [{ type: 'text/plain', value: text }] : []),
          ...(html ? [{ type: 'text/html', value: html }] : []),
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SendGrid] API error:', error);
      return {
        success: false,
        error: `SendGrid API error: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[SendGrid] Request failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
