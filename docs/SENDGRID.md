# SendGrid Setup & Testing Guide

This guide will help you set up and test SendGrid for anonymous wiki editing with email verification.

## Prerequisites

- SendGrid account (free tier works fine)
- Node.js installed
- `.env.local` file in the project root

## Step 1: Create SendGrid Account

1. Go to [SendGrid](https://sendgrid.com/) and sign up for a free account
2. Verify your email address
3. Complete the account setup

## Step 2: Create API Key

1. Go to [Settings > API Keys](https://app.sendgrid.com/settings/api_keys)
2. Click "Create API Key"
3. Name it: `Slayer Legend Wiki`
4. Permission level: **Restricted Access**
5. Enable only: **Mail Send** → **Full Access**
6. Click "Create & View"
7. **Copy the API key** (you won't see it again!)

## Step 3: Verify Sender Email

**IMPORTANT:** You must verify your sender email before SendGrid will send emails.

### Option A: Single Sender Verification (Recommended for testing)

1. Go to [Settings > Sender Authentication](https://app.sendgrid.com/settings/sender_auth)
2. Click "Single Sender Verification"
3. Click "Create New Sender"
4. Fill in the form:
   - **From Name:** `Slayer Legend Wiki`
   - **From Email Address:** Your email (e.g., `you@gmail.com` or `noreply@slayerlegend.wiki`)
   - **Reply To:** Same as From Email
   - **Company Address:** Your address
   - **City, State, Zip, Country:** Your location
   - **Nickname:** `Slayer Legend Wiki`
5. Click "Create"
6. Check your email and click the verification link
7. Once verified, you can send emails from this address

### Option B: Domain Authentication (For production)

1. Go to [Settings > Sender Authentication](https://app.sendgrid.com/settings/sender_auth)
2. Click "Authenticate Your Domain"
3. Follow the DNS configuration steps for `slayerlegend.wiki`

## Step 4: Configure Environment Variables

Add these to your `.env.local` file:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=your-verified-email@example.com

# reCAPTCHA (get from https://www.google.com/recaptcha/admin)
RECAPTCHA_SECRET_KEY=your_secret_key_here
VITE_RECAPTCHA_SITE_KEY=your_site_key_here

# Email Verification Secret (generate with: openssl rand -hex 32)
EMAIL_VERIFICATION_SECRET=your_random_secret_here

# GitHub Bot Token (already configured)
GITHUB_BOT_TOKEN=your_github_token_here
```

**Important:** Use the **verified sender email** for `SENDGRID_FROM_EMAIL`!

## Step 5: Test SendGrid Integration

Run the test script with your email address:

```bash
npm run test:sendgrid your-email@example.com
```

For example:
```bash
npm run test:sendgrid myemail@gmail.com
```

### Expected Output

**Success:**
```
📧 SendGrid Integration Test
─────────────────────────────
From: noreply@slayerlegend.wiki
To: myemail@gmail.com

⏳ Sending test email...

✅ Success! Test email sent successfully.

📬 Check your inbox for the test email.

Next steps:
1. Check your email inbox (and spam folder)
2. Verify the email looks correct
3. If everything looks good, your SendGrid integration is working!

Test verification code sent: 123456
```

**Common Errors:**

1. **Error 403 - Forbidden**
   - Your API key is invalid
   - Your sender email is not verified in SendGrid
   - Go to [Sender Authentication](https://app.sendgrid.com/settings/sender_auth) and verify your email

2. **Environment variable not found**
   - Make sure `.env.local` exists in the project root
   - Check that `SENDGRID_API_KEY` is set correctly

3. **Module not found**
   - Run `npm install` to install dependencies

## Step 6: Verify Email Template

Once you receive the test email, verify:

- ✅ Email subject is correct
- ✅ Slayer Legend Wiki branding (⚔️ icon, red gradient header)
- ✅ 6-digit code is clearly visible
- ✅ "Expires in 10 minutes" warning is shown
- ✅ Dark theme looks good
- ✅ Footer links work
- ✅ Email is responsive on mobile

## Step 7: Update wiki-config.json

Add your reCAPTCHA site key to `wiki-config.json` (line 262):

```json
"reCaptcha": {
  "enabled": true,
  "siteKey": "your_recaptcha_site_key_here",
  "minimumScore": 0.5
}
```

## Step 8: Test Anonymous Edit Flow

1. Start dev server: `npm run dev`
2. Open browser in incognito mode
3. Navigate to any wiki page
4. Click "Edit" button
5. Choose "Edit Anonymously"
6. Make an edit and click "Save"
7. Fill in email, display name, reason
8. Click "Submit Edit"
9. Check your email for the verification code
10. Enter the code in the modal
11. Verify that the PR is created successfully

## Troubleshooting

### Email not received?

1. **Check spam folder** - SendGrid emails sometimes go to spam
2. **Verify sender email** - Go to [Sender Authentication](https://app.sendgrid.com/settings/sender_auth)
3. **Check SendGrid Activity** - Go to [Activity Feed](https://app.sendgrid.com/email_activity) to see if the email was sent
4. **API key permissions** - Make sure "Mail Send" has "Full Access"

### Email looks broken?

1. **Test in multiple clients** - Gmail, Outlook, mobile
2. **Check HTML in browser** - Copy HTML from console and open in browser
3. **Inline CSS** - Email clients have limited CSS support

### Rate limiting in SendGrid?

- Free tier: 100 emails/day
- If you hit the limit, wait 24 hours or upgrade to a paid plan

## Production Checklist

Before deploying to production:

- [ ] Domain authentication configured (not single sender)
- [ ] Sender email uses your domain (e.g., `noreply@slayerlegend.wiki`)
- [ ] API key is stored securely (environment variables)
- [ ] Test email delivery on all major clients
- [ ] Monitor SendGrid Activity Feed for bounces
- [ ] Set up SendGrid alerts for issues
- [ ] Consider upgrading SendGrid plan if needed

## Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid API Keys](https://app.sendgrid.com/settings/api_keys)
- [Sender Authentication](https://app.sendgrid.com/settings/sender_auth)
- [Activity Feed](https://app.sendgrid.com/email_activity)
- [Email Testing Tool](https://www.mail-tester.com/)
