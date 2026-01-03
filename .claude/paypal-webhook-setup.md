# PayPal Smart Payment Buttons Setup Guide

Complete guide for setting up **automatic donator badge assignment** using PayPal Smart Payment Buttons with webhooks.

## Overview

When a user donates via PayPal Smart Payment Buttons and provides their GitHub username, the webhook automatically assigns them a donator badge (💎) that appears on their profile throughout the wiki.

## ✨ Key Features

- **Automatic Badge Assignment**: Users get badges immediately after donation
- **GitHub Username Integration**: Username passed securely via PayPal's `custom_id` field
- **Graceful Fallback**: Automatically falls back to paypal.me if SDK fails
- **Manual Assignment**: Admins can still assign badges manually via admin panel

## Prerequisites

1. **PayPal Business Account** (required for Smart Buttons & webhooks)
2. **Deployed wiki with HTTPS** (required for webhook security)
3. **GitHub bot token** with repository write access

## Step 1: Create PayPal App & Get Credentials

### A. Create PayPal App

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Navigate to **Dashboard** → **My Apps & Credentials**
3. Click **Create App**
4. Enter app name (e.g., "Wiki Donations")
5. Select **Merchant** app type
6. Click **Create App**

### B. Get Client ID & Secret

After creating the app:
- **Copy your Client ID** - you'll need this for `VITE_PAYPAL_CLIENT_ID`
- **Copy your Secret** - you'll need this for `PAYPAL_SECRET`

### C. Enable Live Mode (Production)

- Switch from **Sandbox** to **Live** in the dashboard
- Get your **Live** Client ID and Secret (different from sandbox!)

## Step 2: Create PayPal Donation Page (Optional)

**Note:** The Smart Payment Buttons work without a pre-configured donation page. However, you can optionally create one for branding:

1. Go to [paypal.com/donate](https://www.paypal.com/donate/) → Click "Create a link"
2. Configure your donation page (name, logo, theme)
3. **Keep the link as fallback** (in case Smart Buttons fail to load)

**Format:** `https://www.paypal.com/donate/?hosted_button_id=XXXXXXXXX` or `https://paypal.me/YourUsername`

## Step 3: Configure Environment Variables

Add these to your deployment platform (Cloudflare Pages, Netlify, etc.):

```bash
# PayPal Smart Buttons - Client-side (Public)
VITE_PAYPAL_CLIENT_ID=AXXXxxx...  # Your Live Client ID from Step 1

# PayPal Webhooks - Server-side (Secret)
PAYPAL_SECRET=EXXXxxx...          # Your Secret from Step 1
PAYPAL_WEBHOOK_ID=WH-XXX...       # Will get this in Step 4

# GitHub Bot Token (if not already set)
WIKI_BOT_TOKEN=ghp_xxxxxxxxxxxxx  # Bot token with repo write access

# Repository Info (if not already set)
WIKI_REPO_OWNER=your-github-username
WIKI_REPO_NAME=your-repo-name
```

**Important Notes:**
- `VITE_PAYPAL_CLIENT_ID` is **public** (embedded in client-side code)
- `PAYPAL_SECRET` is **secret** (server-side only, never expose!)
- Use **Live** credentials for production (not Sandbox!)

## Step 4: Create PayPal Webhook

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Navigate to **My Apps & Credentials**
3. Select your app
4. Scroll to **Webhooks** section
5. Click **Add Webhook**

### Webhook Configuration

**Webhook URL:**
```
https://your-site.com/api/paypal-webhook
```

**Event Types to Subscribe:**
- ✅ `PAYMENT.CAPTURE.COMPLETED` (for Orders API / Smart Buttons)
- ✅ `PAYMENT.SALE.COMPLETED` (for legacy compatibility)

**After saving:**
- **Copy the Webhook ID** (format: `WH-XXXxxxXXX...`)
- Add it to your environment variables as `PAYPAL_WEBHOOK_ID`

## Step 5: Update Wiki Configuration

Edit `wiki-config.json`:

```json
{
  "features": {
    "donation": {
      "enabled": true,
      "badge": {
        "enabled": true,
        "badge": "💎",
        "color": "#ffd700",
        "title": "Donator"
      },
      "methods": {
        "paypal": {
          "enabled": true,
          "clientId": "OPTIONAL-can-use-VITE_PAYPAL_CLIENT_ID-instead",
          "fallbackUrl": "https://paypal.me/YourUsername"
        },
        "stripe": {
          "enabled": false,
          "url": "https://donate.stripe.com/..."
        },
        "kofi": {
          "enabled": false,
          "url": "https://ko-fi.com/..."
        }
      },
      "amounts": [
        { "amount": 5, "label": "☕ One Coffee", "description": "Buy us a coffee!" },
        { "amount": 10, "label": "☕☕ Two Coffees", "description": "Keep us caffeinated!" },
        { "amount": 25, "label": "🍕 Pizza Party", "description": "Fuel a late-night coding session!" },
        { "amount": 50, "label": "⚡ Power Boost", "description": "Help cover server costs!" }
      ]
    }
  }
}
```

**Configuration Notes:**

- **`clientId`** (optional): Can be set in config or use `VITE_PAYPAL_CLIENT_ID` environment variable
- **`fallbackUrl`** (recommended): PayPal.me or donate link used if Smart Buttons fail to load
- **Badge is automatically assigned** when Smart Buttons are used
- **Badge is manually assigned** when fallback URL is used

## Step 6: Test the Integration

### Testing in Sandbox Mode

1. **Switch to Sandbox:**
   - In PayPal Developer Dashboard, use **Sandbox** credentials
   - Update `VITE_PAYPAL_CLIENT_ID` with sandbox Client ID
   - Update `PAYPAL_SECRET` with sandbox Secret
   - Create sandbox webhook (separate from live!)

2. **Create Test Accounts:**
   - In PayPal Dashboard → **Sandbox** → **Accounts**
   - Create a Personal (buyer) sandbox account
   - Note the email and password

3. **Test Flow:**
   - Go to `/donate` page on your wiki (local or staging)
   - Sign in with GitHub (or enter GitHub username manually)
   - Select donation amount
   - PayPal Smart Button should appear
   - Click button → Login with sandbox buyer account
   - Complete mock payment
   - Check webhook logs (see Step 7)
   - Verify badge appears on your profile

### Testing in Production

**IMPORTANT:** Only test with real money if you're ready for production!

1. Switch environment variables to **Live** credentials
2. Go to `/donate` page
3. Make a small test donation ($1-5)
4. Verify badge assignment works
5. Optional: Refund via PayPal dashboard if desired

### Fallback Testing

Test the graceful fallback:

1. Temporarily set `VITE_PAYPAL_CLIENT_ID` to invalid value (e.g., "test")
2. Visit `/donate` page
3. Should see: **"PayPal Smart Buttons unavailable. Using fallback donation link."**
4. Fallback button should redirect to `paypal.me`
5. Restore valid Client ID after testing

## Step 6: Monitor Webhooks

### View Webhook Logs

**In PayPal Dashboard:**
- Go to your app → Webhooks → Your webhook
- Click "Events" tab to see webhook deliveries
- Check for successful 200 responses

**In Your Server Logs:**
```
[PayPal Webhook] Request received
[PayPal Webhook] Event type: PAYMENT.SALE.COMPLETED
[PayPal Webhook] Processing donator badge assignment
[PayPal Webhook] Found GitHub user: username ID: 12345
[PayPal Webhook] Donator badge assigned successfully
```

### Common Issues

#### 1. Badge Not Assigned

**Check:**
- GitHub username was entered correctly
- User exists on GitHub
- Bot token has write access to repository
- Webhook received 200 response
- Check server logs for errors

**Manual Assignment:**
- Go to `/admin` → 💎 Donators tab
- Manually assign badge with transaction details

#### 2. Invalid Signature Error

**Causes:**
- Wrong `PAYPAL_WEBHOOK_ID` environment variable
- Webhook URL mismatch (HTTP vs HTTPS)
- Request not from PayPal

**Fix:**
- Verify `PAYPAL_WEBHOOK_ID` matches webhook in PayPal Dashboard
- Ensure webhook URL uses HTTPS
- Check PayPal webhook signature verification logs

#### 3. Username Not Found in Payment

**Causes:**
- User didn't enter GitHub username
- Using PayPal.me (doesn't support custom fields)
- Custom field not passed correctly

**Fix:**
- Use PayPal Donate Button instead of PayPal.me
- Manually assign badge via admin panel
- Check webhook logs for custom field value

## User Flow

### For Authenticated Users (Smart Buttons)

1. User visits `/donate` page while signed in
2. GitHub username is **pre-filled automatically** ✅
3. User selects donation amount
4. **PayPal Smart Button appears** (gold button with PayPal logo)
5. User clicks button → PayPal login window opens
6. User completes payment in PayPal
7. Payment captured → Username passed via `custom_id` field
8. Webhook receives `PAYMENT.CAPTURE.COMPLETED` event
9. Badge assigned automatically 💎
10. User redirected to `/donation-success` page
11. Badge appears immediately on profile!

### For Anonymous Users (Smart Buttons)

1. User visits `/donate` page (not signed in)
2. User manually enters GitHub username in form field
3. User selects donation amount
4. PayPal Smart Button appears
5. User completes payment
6. Badge assigned automatically if username provided ✅
7. If no username → admin can assign manually later

### Fallback Flow (if Smart Buttons fail)

1. User visits `/donate` page
2. Sees warning: "PayPal Smart Buttons unavailable. Using fallback donation link."
3. Simple button redirects to `paypal.me`
4. User completes payment
5. **Badge must be assigned manually** by admin

## Manual Badge Assignment

If automatic assignment fails or user didn't provide username:

1. Go to `/admin` panel (requires admin access)
2. Click **💎 Donators** tab
3. Enter:
   - GitHub username
   - Donation amount (optional)
   - Reason/Notes (e.g., "PayPal donation - Transaction ID: ABC123")
4. Click **Assign Badge**
5. Badge appears immediately

## Security Notes

### Webhook Signature Verification

The endpoint **automatically verifies** PayPal webhook signatures using:
1. PayPal transmission ID
2. PayPal transmission time
3. Webhook ID
4. Event body hash
5. PayPal certificate (fetched and verified)

**Never disable signature verification** - this prevents fake webhook attacks.

### Rate Limiting

PayPal webhooks are rate-limited on their side. If a webhook fails, PayPal will retry automatically with exponential backoff.

### Bot Token Permissions

The `WIKI_BOT_TOKEN` must have:
- ✅ Read/write access to repository
- ✅ Issues read/write (for donator registry)
- ❌ NOT your personal token (use dedicated bot account)

## Troubleshooting Commands

### Test Webhook Manually

Use curl to simulate a PayPal webhook (for debugging):

```bash
curl -X POST https://your-site.com/api/paypal-webhook \
  -H "Content-Type: application/json" \
  -H "paypal-transmission-id: test-123" \
  -H "paypal-transmission-time: 2025-01-01T00:00:00Z" \
  -H "paypal-transmission-sig: test-sig" \
  -H "paypal-cert-url: https://api.paypal.com/cert" \
  -H "paypal-auth-algo: SHA256withRSA" \
  -d '{
    "event_type": "PAYMENT.SALE.COMPLETED",
    "resource": {
      "id": "test-transaction-123",
      "custom": "YourGitHubUsername",
      "amount": {
        "total": "25.00",
        "currency": "USD"
      }
    }
  }'
```

**Note:** This will fail signature verification (expected). Check logs to see if webhook handler receives and parses the request.

### Check Donator Registry

The donator data is stored in GitHub Issues with label `donator-registry`. To view:

1. Go to your repository → Issues
2. Filter by label: `donator-registry`
3. Each issue contains one user's donator status

## Cost Considerations

- **PayPal Fees:** PayPal charges 2.9% + $0.30 per transaction
- **Webhook Costs:** Free (no additional cost from PayPal or Cloudflare)
- **GitHub API:** Free within rate limits (bot operations count toward limits)

## Alternative: Manual Process

If webhooks are too complex, use manual assignment only:

1. **Disable webhook** (remove environment variables)
2. Users donate via any method (PayPal, Ko-fi, Stripe, cash, etc.)
3. You receive notification from payment provider
4. Manually assign badge via `/admin` panel
5. Users get badge within minutes

**Advantages:**
- ✅ Works with any payment method
- ✅ No webhook configuration
- ✅ Full control over assignments

**Disadvantages:**
- ❌ Manual work required
- ❌ Slower badge assignment

## Support

If you encounter issues:

1. Check server logs in your deployment platform
2. Check PayPal webhook delivery logs
3. Test with manual badge assignment first
4. Create issue in wiki framework repository

## References

- [PayPal Webhooks Documentation](https://developer.paypal.com/docs/api-basics/notifications/webhooks/)
- [PayPal REST API Reference](https://developer.paypal.com/docs/api/overview/)
- [GitHub Issues API](https://docs.github.com/en/rest/issues)
