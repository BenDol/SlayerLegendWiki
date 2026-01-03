# Donation System Documentation

A fun, animated donation prompt system with spirit sprites!

## Overview

The donation system features:
- 🎨 Animated spirit sprite that slides up with elastic bounce
- 💬 Speech bubble that slides in with typewriter effect
- 🎭 Bobbing animation while speaking
- 💳 Beautiful donation page with multiple payment options
- ⚙️ Fully configurable via `wiki-config.json`
- 🎯 Smart display logic (respects user preferences)

## How It Works

### Animation Sequence

1. **Spirit Enters** (0.8s)
   - Random spirit sprite slides up from bottom-right
   - Elastic bounce effect for fun entrance

2. **Speech Bubble Appears** (after spirit enters)
   - Slides in from left to right
   - Displays random friendly message
   - Typewriter effect (50ms per character)
   - Bobs left-right while "speaking"

3. **Spirit Exits** (after 2s showing complete message)
   - Spirit and bubble slide down
   - Smooth fadeout

4. **Donation Card Appears** (0.6s)
   - Slides up where spirit was
   - Shows "Support Our Wiki" card
   - Donate button and "Maybe Later" option

5. **Navigation**
   - Clicking "Donate Now" goes to `/donate`
   - Clicking "Maybe Later" dismisses prompt

### Display Logic

The prompt shows when:
- User has been on site for **60+ seconds** (configurable)
- User has viewed **3+ pages** (configurable)
- User hasn't dismissed in last **7 days** (configurable)
- User hasn't donated yet

The prompt will:
- Show **at most once per session**
- Respect user's "dismiss" preference
- Never show again if user has donated

## Files

```
src/
├── components/
│   ├── DonationPrompt.jsx      # Main prompt component with animations
│   └── DonationSystem.jsx       # Wrapper component
├── pages/
│   └── DonatePage.jsx           # Full donation page
└── hooks/
    └── useDonationPrompt.js     # Display logic hook
```

## Setup

### 1. Add DonationSystem to Your App

The DonationSystem needs to be added to your main app component. Since this wiki uses a framework, you'd typically add it to the framework's `App.jsx` or create a parent project wrapper.

**Option A: Framework Integration (Recommended)**

If you control the framework, add to `wiki-framework/src/App.jsx`:

```jsx
import DonationSystem from '../../../../src/components/DonationSystem';

function App() {
  return (
    <div className="app">
      {/* ... existing app structure ... */}

      {/* Add donation system */}
      <DonationSystem />
    </div>
  );
}
```

**Option B: Parent Project Wrapper**

Create a wrapper component in your parent project:

```jsx
// src/components/AppWrapper.jsx
import DonationSystem from './DonationSystem';

const AppWrapper = ({ children }) => {
  return (
    <>
      {children}
      <DonationSystem />
    </>
  );
};

export default AppWrapper;
```

Then wrap the framework's App in `main.jsx`:

```jsx
import AppWrapper from './src/components/AppWrapper';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ErrorBoundary>
        <AppWrapper>
          <App />
        </AppWrapper>
      </ErrorBoundary>
    </HelmetProvider>
  </React.StrictMode>,
);
```

### 2. Configure in wiki-config.json

```json
{
  "features": {
    "donation": {
      "enabled": true,
      "prompt": {
        "minTimeOnSite": 60,
        "minPagesViewed": 3,
        "daysUntilNextPrompt": 7
      },
      "methods": {
        "stripe": {
          "enabled": false,
          "url": ""
        },
        "paypal": {
          "enabled": false,
          "url": ""
        },
        "kofi": {
          "enabled": true,
          "url": "https://ko-fi.com/yourkofi"
        }
      }
    }
  }
}
```

### 3. Set Up Payment Integration

#### Ko-fi (Easiest)

1. Create account at https://ko-fi.com
2. Get your Ko-fi link
3. Update `DonatePage.jsx`:

```jsx
const handleDonate = (method) => {
  if (method === 'kofi') {
    window.open('https://ko-fi.com/YOURNAME', '_blank');
  }
};
```

#### Stripe

1. Create Stripe account
2. Set up Stripe Checkout or Payment Links
3. Get your payment link
4. Update `DonatePage.jsx`:

```jsx
if (method === 'stripe') {
  const amount = selectedAmount || parseFloat(customAmount) || 5;
  window.location.href = `https://buy.stripe.com/YOUR_LINK?amount=${amount * 100}`;
}
```

#### PayPal

1. Create PayPal Business account
2. Create donation button or use PayPal.me
3. Update `DonatePage.jsx`:

```jsx
if (method === 'paypal') {
  const amount = selectedAmount || parseFloat(customAmount) || 5;
  window.location.href = `https://www.paypal.com/donate?business=YOUR_EMAIL&amount=${amount}`;
}
```

## Configuration

### Prompt Display Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable donation prompts |
| `minTimeOnSite` | number | `60` | Seconds on site before showing |
| `minPagesViewed` | number | `3` | Pages viewed before showing |
| `daysUntilNextPrompt` | number | `7` | Days before showing again after dismiss |

### Payment Methods

Each payment method has:
- `enabled` (boolean) - Show this option on donation page
- `url` (string) - Payment URL/link

## Customization

### Change Messages

Edit `DONATION_MESSAGES` array in `DonationPrompt.jsx`:

```jsx
const DONATION_MESSAGES = [
  "Hey! Want to help keep this wiki running? ☕",
  "Your custom message here! 💖",
  // ... add more messages
];
```

### Change Animation Timing

In `DonationPrompt.jsx`:

```jsx
// Spirit enter duration
const enterTimeout = setTimeout(() => {
  setStage('speaking');
}, 800); // Change this (milliseconds)

// Typewriter speed
setTimeout(() => {
  setDisplayedText(prev => prev + message[messageIndexRef.current]);
}, 50); // Change this (milliseconds per character)

// Message display duration
const exitTimeout = setTimeout(() => {
  setStage('exiting');
}, 2000); // Change this (milliseconds)
```

### Change Donation Amounts

Edit `donationAmounts` in `DonatePage.jsx`:

```jsx
const donationAmounts = [
  { amount: 5, label: '☕ One Coffee', description: 'Buy us a coffee!' },
  { amount: 10, label: '☕☕ Two Coffees', description: 'Keep us caffeinated!' },
  // Add/modify amounts
];
```

### Style Customization

The components use Tailwind CSS. You can customize:

**Colors:**
```jsx
// Change gradient colors
className="bg-gradient-to-br from-blue-50 to-purple-50"

// Change button colors
className="bg-gradient-to-r from-blue-500 to-purple-500"
```

**Sizes:**
```jsx
// Change spirit size
<SpiritSprite size="large" /> // small, medium, large, or custom CSS

// Change card width
className="max-w-sm" // max-w-xs, max-w-md, max-w-lg, etc.
```

## Testing

### Test the Prompt

To test without waiting for conditions:

1. **Quick Test** - Open browser console:
```javascript
// Reset all conditions
localStorage.removeItem('donationPromptDismissedAt');
sessionStorage.removeItem('donationPromptShownThisSession');
localStorage.removeItem('userHasDonated');

// Reload page
location.reload();
```

2. **Temporary Config** - Modify `useDonationPrompt` defaults:
```jsx
const config = {
  enabled: true,
  minTimeOnSite: 5, // 5 seconds for testing
  minPagesViewed: 1, // 1 page for testing
  daysUntilNextPrompt: 7
};
```

### Test Payment Flow

Replace payment handlers in `DonatePage.jsx` with console logs:

```jsx
const handleDonate = (method) => {
  const amount = selectedAmount || parseFloat(customAmount) || 5;
  console.log(`Testing ${method} payment for $${amount}`);
  alert(`Would redirect to ${method} with amount $${amount}`);
};
```

## User Actions

### Mark User as Donated

After successful payment, call:

```jsx
import { markUserAsDonated } from '../hooks/useDonationPrompt';

// On payment success
markUserAsDonated();
```

This prevents showing donation prompts to users who have donated.

### Reset Prompt Status (Testing)

```jsx
import { resetDonationPromptStatus } from '../hooks/useDonationPrompt';

// Reset everything
resetDonationPromptStatus();
```

## API Reference

### DonationPrompt Component

```jsx
<DonationPrompt
  onClose={() => {}}     // Called when user dismisses
  onDonate={() => {}}    // Called when user clicks donate
/>
```

### useDonationPrompt Hook

```jsx
const { shouldShow, handleClose, handleDonate } = useDonationPrompt({
  minTimeOnSite: 60,
  minPagesViewed: 3,
  daysUntilNextPrompt: 7,
  enabled: true
});
```

Returns:
- `shouldShow` (boolean) - Whether to show prompt
- `handleClose` (function) - Call when user dismisses
- `handleDonate` (function) - Call when user clicks donate

### Utility Functions

```jsx
import {
  markUserAsDonated,
  resetDonationPromptStatus
} from '../hooks/useDonationPrompt';

// Mark user as donated
markUserAsDonated();

// Reset for testing
resetDonationPromptStatus();
```

## LocalStorage Keys

The system uses these localStorage keys:

| Key | Purpose |
|-----|---------|
| `donationPromptDismissedAt` | Timestamp when user dismissed prompt |
| `userHasDonated` | Whether user has donated (`'true'` or not set) |
| `donationDate` | Timestamp of donation |

SessionStorage:
| Key | Purpose |
|-----|---------|
| `donationPromptShownThisSession` | Whether prompt shown this session |

## Troubleshooting

### Prompt Not Showing

1. Check `wiki-config.json` - `donation.enabled` is `true`
2. Check conditions met (time on site, pages viewed)
3. Check localStorage - not recently dismissed
4. Check console for errors
5. Verify DonationSystem is rendered in App

### Animations Not Working

1. Ensure Tailwind CSS is loaded
2. Check browser DevTools for CSS errors
3. Verify `<style jsx>` block is rendered (check if your framework supports it)
4. Alternative: Move animations to separate CSS file

### Spirit Not Loading

1. Check `public/data/spirit-characters.json` exists
2. Check spirit image files exist
3. Check SpiritSprite component is working
4. Check browser console for errors

### Payment Not Working

1. Verify payment URLs are correct
2. Check payment method is enabled in config
3. Test with console.log before actual redirect
4. Verify payment provider accounts are set up

## Best Practices

1. **Be Respectful** - Don't show prompts too frequently
2. **Clear Messaging** - Explain where money goes
3. **Easy Dismiss** - Make it easy to say "no thanks"
4. **Test Thoroughly** - Test all payment flows
5. **Monitor Analytics** - Track donation conversions
6. **Thank Users** - Show appreciation for donations
7. **Be Transparent** - Share how funds are used

## Future Enhancements

Possible improvements:

- [ ] Add progress bar showing funding goal
- [ ] Show different messages based on user actions
- [ ] Add sound effects
- [ ] Add confetti on donation
- [ ] Show recent donor "hall of fame"
- [ ] Add donation tiers with rewards
- [ ] A/B test different messages
- [ ] Analytics integration
- [ ] Email receipts
- [ ] Recurring donations

## Support

For issues or questions:

1. Check this documentation
2. Review code comments
3. Test with resetDonationPromptStatus()
4. Check browser console for errors
5. Verify config is correct

---

**Remember: This system is designed to be fun and non-intrusive. Always respect your users' choices and never be pushy about donations! 💖**
