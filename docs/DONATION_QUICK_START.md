# Donation System - Quick Start Guide

Get your donation system up and running in 5 minutes! ⚡

## Step 1: Enable the System (2 minutes)

### Option A: Framework Integration

If you can modify the framework, add to `wiki-framework/src/App.jsx`:

```jsx
import DonationSystem from '../../../../src/components/DonationSystem';

// Inside your App component, add at the end:
<DonationSystem />
```

### Option B: Use AppWrapper (Recommended for Parent Project)

Create `src/components/AppWrapper.jsx`:

```jsx
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

Then wrap in `main.jsx`:

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

## Step 2: Configure Payment (2 minutes)

Edit `wiki-config.json`:

```json
{
  "features": {
    "donation": {
      "enabled": true,
      "methods": {
        "kofi": {
          "enabled": true,
          "url": "https://ko-fi.com/YOURNAME"
        }
      }
    }
  }
}
```

Replace `YOURNAME` with your Ko-fi username.

Don't have Ko-fi? Create free account at https://ko-fi.com

## Step 3: Set Up Ko-fi (1 minute)

Edit `src/pages/DonatePage.jsx`, find the `handleDonate` function:

```jsx
const handleDonate = (method) => {
  if (method === 'kofi') {
    window.open('https://ko-fi.com/YOURNAME', '_blank');
  }
  // ... other methods
};
```

Replace `YOURNAME` with your Ko-fi username.

## Step 4: Test It! (30 seconds)

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser console** and run:
   ```javascript
   // Force show prompt immediately
   localStorage.removeItem('donationPromptDismissedAt');
   sessionStorage.removeItem('donationPromptShownThisSession');
   location.reload();
   ```

3. **Wait 5-10 seconds** - The spirit should appear!

4. **Click through** to test the full flow

## Done! 🎉

Your donation system is now live!

## Next Steps

- **Customize messages** - Edit `DONATION_MESSAGES` in `DonationPrompt.jsx`
- **Add Stripe/PayPal** - See full docs: `DONATION_SYSTEM.md`
- **Adjust timing** - Change `minTimeOnSite` in `wiki-config.json`
- **Track donations** - Add analytics to donation page

## Quick Settings

### Show Prompt Faster (Testing)

In `wiki-config.json`:

```json
{
  "donation": {
    "prompt": {
      "minTimeOnSite": 5,        // 5 seconds (was 60)
      "minPagesViewed": 1,       // 1 page (was 3)
      "daysUntilNextPrompt": 7
    }
  }
}
```

### Disable System Temporarily

In `wiki-config.json`:

```json
{
  "donation": {
    "enabled": false
  }
}
```

## Troubleshooting

### Not seeing the prompt?

**Quick fix:**
```javascript
// Run in browser console
localStorage.removeItem('donationPromptDismissedAt');
sessionStorage.removeItem('donationPromptShownThisSession');
location.reload();
// Then wait 60 seconds or adjust minTimeOnSite
```

### Spirit not loading?

- Check `public/data/spirit-characters.json` exists
- Check browser console for errors
- Verify SpiritSprite component works (try viewing Spirit Builder)

### Payment not working?

- Update your Ko-fi URL in `DonatePage.jsx`
- Check URL is correct (open in new tab to test)
- Verify Ko-fi account is set up

## Production Checklist

Before deploying:

- [ ] Test full donation flow
- [ ] Verify payment URLs are correct
- [ ] Set reasonable timing (don't annoy users!)
- [ ] Test on mobile devices
- [ ] Check animations work smoothly
- [ ] Verify "Maybe Later" button works
- [ ] Test dismiss and re-show after 7 days

## Need More Help?

Read the full documentation: `docs/DONATION_SYSTEM.md`

---

**Happy fundraising! Remember to be respectful and never pushy. Users appreciate the option but also appreciate being able to say no! 💖**
