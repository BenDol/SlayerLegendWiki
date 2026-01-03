# Donation System Components

Fun animated donation prompt system with spirit sprites!

## Components

### DonationPrompt.jsx
The main animated component that shows:
- Random spirit sprite sliding up with elastic bounce
- Speech bubble with typewriter effect
- Bobbing animation while speaking
- Donation card after spirit exits

**Props:**
- `onClose()` - Called when user dismisses
- `onDonate()` - Called when user clicks donate

### DonationSystem.jsx
Wrapper component that manages display logic and navigation.
Add this to your App to enable donation prompts.

**Features:**
- Reads config from wiki-config.json
- Manages display conditions
- Handles navigation to /donate page

### AppWrapper.jsx
App wrapper that includes DonationSystem.
Already integrated in main.jsx.

## Pages

### DonatePage.jsx
Full-featured donation page at `/donate` with:
- ☕ Coffee cup animation
- Multiple donation amounts
- Custom amount input
- Payment options (Stripe, PayPal, Ko-fi)
- Friendly community message

## Hooks

### useDonationPrompt.js
Custom hook that manages event-based donation prompt logic.

**Features:**
- Event-based triggering (triggered by useful interactions)
- 24-hour cooldown between prompts
- Random chance to trigger (30% by default)
- Requires minimum interactions before eligible (2 by default)
- Respects user dismissals and donations
- One prompt per session maximum
- Proper storage key conventions (persistName/cacheName)

**API:**
```jsx
const { shouldShow, handleClose, handleDonate, triggerPrompt, canTrigger } = useDonationPrompt({
  enabled: true,
  cooldownHours: 24,              // 24 hours between prompts
  triggerChance: 0.3,             // 30% chance to trigger
  minInteractionsBeforeEligible: 2 // Must interact twice first
});
```

**Triggering the Prompt:**
```jsx
// From any component (globally exposed)
window.triggerDonationPrompt?.();

// Or via custom event
window.dispatchEvent(new CustomEvent('donation-trigger'));

// Force trigger (for testing)
window.forceDonationPrompt?.();
```

**Utility Functions:**
```jsx
import {
  markUserAsDonated,
  resetDonationPromptStatus
} from '../hooks/useDonationPrompt';

// Mark user as donated (call after successful payment)
markUserAsDonated();

// Reset everything (for testing)
resetDonationPromptStatus();
```

## Configuration

The donation prompt is configured in `src/components/DonationSystem.jsx`:

```javascript
const config = {
  enabled: true,
  cooldownHours: 24,              // 24 hours between prompts
  triggerChance: 0.3,             // 30% random chance to trigger
  minInteractionsBeforeEligible: 2 // Must interact twice first
};
```

**To modify:**
1. Edit the `config` object in `DonationSystem.jsx` (lines 18-24)
2. Or enhance the component to read from `wiki-config.json` under `features.donation.prompt`

**Payment methods** are configured in `src/pages/DonatePage.jsx`:
- Update the `PAYMENT_METHODS` array with your Stripe, PayPal, Ko-fi URLs
- Enable/disable methods by modifying the array

## Event-Based Triggers

The donation prompt is triggered by useful user interactions, not passive browsing. Current triggers include:

**Soul Weapon Engraving Builder:**
- Auto-Solve button (successful solve)
- Find Best Weapon button (successful find)
- Share build button (successful share)

**Skill Builder:**
- Share build button (successful share)

**Spirit Builder:**
- Share build button (successful share)

**Battle Loadouts:**
- Share loadout button (successful share)

Each trigger has a:
- **30% random chance** to show the prompt (configurable)
- **24-hour cooldown** before showing again
- **One per session** maximum
- **Minimum 2 interactions** required before becoming eligible

## Quick Test

Open browser console:

```javascript
// Method 1: Force trigger without checks
window.forceDonationPrompt?.();

// Method 2: Reset all status and trigger normally
import { resetDonationPromptStatus } from './src/hooks/useDonationPrompt';
resetDonationPromptStatus();
window.triggerDonationPrompt?.();

// Method 3: Check current status
import { getDonationPromptStatus } from './src/hooks/useDonationPrompt';
console.log(getDonationPromptStatus());
```

**Testing in actual usage:**
1. Perform 2+ useful interactions (build shares, auto-solve, etc.)
2. The prompt has a 30% chance to trigger on each interaction
3. If it doesn't show, try clicking Auto-Solve or Share Build again

## Customization

### Change Messages

Edit `DONATION_MESSAGES` in `DonationPrompt.jsx`:

```jsx
const DONATION_MESSAGES = [
  "Your custom message here! ☕",
  // Add more...
];
```

### Change Donation Amounts

Edit `donationAmounts` in `DonatePage.jsx`:

```jsx
const donationAmounts = [
  { amount: 5, label: '☕ One Coffee', description: 'Buy us a coffee!' },
  // Add more...
];
```

### Change Animation Speed

In `DonationPrompt.jsx`:

```jsx
// Typewriter speed (ms per character)
setTimeout(() => { ... }, 50);

// Message display time (ms)
setTimeout(() => { ... }, 2000);
```

## Integration Status

✅ Components created
✅ Page created
✅ Route registered (`/donate`)
✅ AppWrapper created
✅ Integrated in main.jsx
✅ Configuration added to wiki-config.json
✅ Sitemap updated
✅ Meta tags added
✅ Documentation created

## Documentation

- **Full Guide:** `docs/DONATION_SYSTEM.md`
- **Quick Start:** `docs/DONATION_QUICK_START.md`

## Dependencies

- React
- react-router-dom (for navigation)
- SpiritSprite component
- Tailwind CSS (for styling)
- lucide-react (for icons)

## File Structure

```
src/
├── components/
│   ├── DonationPrompt.jsx       # Animated prompt
│   ├── DonationSystem.jsx       # System wrapper
│   ├── AppWrapper.jsx           # App wrapper
│   └── README-Donation.md       # This file
├── pages/
│   └── DonatePage.jsx           # Donation page
└── hooks/
    └── useDonationPrompt.js     # Display logic

docs/
├── DONATION_SYSTEM.md           # Full documentation
└── DONATION_QUICK_START.md      # Quick setup guide

wiki-config.json                 # Configuration
main.jsx                         # Integration point
```

## Next Steps

1. **Set up payment provider** (Ko-fi recommended for simplicity)
2. **Update payment URLs** in `src/pages/DonatePage.jsx` (PAYMENT_METHODS array)
3. **Test the flow** end-to-end:
   - Perform 2+ interactions (share builds, auto-solve, etc.)
   - Use `window.forceDonationPrompt()` in console for immediate testing
   - Verify 24-hour cooldown works
4. **Customize messages** in `src/components/DonationPrompt.jsx` (DONATION_MESSAGES array)
5. **Adjust trigger probability** if needed in `src/components/DonationSystem.jsx` (config.triggerChance)
6. **Add more triggers** to other useful interactions across your app
7. **Deploy and monitor** donation conversions

## Support

Questions? Check the full documentation or review the code comments.

---

**Remember: Be respectful of users. Donation prompts should be fun, not annoying! 💖**
