# MIME Type Module Loading Errors - Fix Guide

## Error Message
```
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/html"
```

## Root Causes
1. **Stale browser cache** - Old references to renamed/deleted chunk files
2. **Vite dev server cache** - Out-of-sync cached modules
3. **HMR race conditions** - Files requested before fully written during hot reload
4. **Service worker cache** - PWA service worker serving old files

## Solutions (Try in Order)

### 1. Hard Refresh Browser (Quickest)
- **Chrome/Edge**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Firefox**: `Ctrl + Shift + R`
- Also try: Clear browser cache completely

### 2. Clear Vite Cache & Restart Dev Server
```bash
# Stop dev server (Ctrl+C)
# Delete Vite cache
rm -rf node_modules/.vite

# Restart dev server
npm run dev
```

### 3. Full Clean & Rebuild
```bash
# Stop dev server
# Clear all caches and build artifacts
rm -rf node_modules/.vite
rm -rf dist

# Restart
npm run dev
```

### 4. Clear Browser Application Cache (If Using PWA Features)
1. Open DevTools (F12)
2. Application tab
3. Clear Storage → Clear site data
4. Reload page

### 5. Nuclear Option (If Nothing Else Works)
```bash
# Stop dev server
# Clear everything
rm -rf node_modules
rm -rf node_modules/.vite
rm -rf dist
rm -rf wiki-framework/node_modules

# Reinstall
npm install

# Restart
npm run dev
```

## Prevention Tips
- **Hard refresh** after major code changes
- **Restart dev server** when switching branches
- Clear cache before testing production builds locally
- Use incognito/private browsing for clean testing

## When It Happens
- After renaming/moving large components
- After switching git branches
- After updating dependencies
- During rapid hot module replacement cycles
- When multiple chunks are updated simultaneously

## Quick Fix Command (Windows PowerShell)
```powershell
# One-liner to clear Vite cache and restart
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue; npm run dev
```
