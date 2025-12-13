# Wiki Template Setup Guide

This guide will help you set up a new wiki using this template repository.

## 🎯 Overview

This template provides:
- ✅ Pre-configured wiki structure
- ✅ GitHub Wiki Framework as submodule
- ✅ Example content in all sections
- ✅ Ready-to-deploy configuration
- ✅ GitHub Actions workflow (inherited from framework)

## 📋 Step-by-Step Setup

### 1. Create Your Wiki Repository

**On GitHub:**

1. Click **"Use this template"** button (green button at the top)
2. Choose a name for your wiki (e.g., `my-game-wiki`)
3. Set visibility (Public or Private)
4. Click **"Create repository from template"**

### 2. Clone Your New Wiki

```bash
git clone --recursive https://github.com/yourusername/your-wiki-name.git
cd your-wiki-name
```

> **Important**: Use `--recursive` to clone the framework submodule!

### 3. Install Dependencies

```bash
npm install
```

This will install all required packages including React, Vite, and Tailwind CSS.

### 4. Configure Your Wiki

#### A. Update `wiki-config.json`

Change these required fields:

```json
{
  "wiki": {
    "title": "Your Actual Wiki Name",        // Change this!
    "description": "Your wiki description",  // Change this!
    "repository": {
      "owner": "yourusername",               // Your GitHub username!
      "repo": "your-wiki-name",              // Your repository name!
      "branch": "main",
      "contentPath": "content"
    }
  }
}
```

#### B. Update `vite.config.js`

Change the base URL to match your repository name:

```javascript
export default createWikiConfigSync({
  base: '/your-wiki-name/',  // Must match your GitHub repo name!
  // ...
});
```

> **For custom domains**: Use `base: '/'` instead

### 5. Set Up GitHub OAuth (Optional but Recommended)

To enable editing features:

#### A. Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: Your Wiki Name
   - **Homepage URL**: `https://yourusername.github.io/your-wiki-name/`
   - **Authorization callback URL**: `https://yourusername.github.io/your-wiki-name/`
4. Click **"Register application"**
5. Copy your **Client ID**

#### B. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_GITHUB_CLIENT_ID=your_actual_client_id_here
VITE_WIKI_REPO_OWNER=yourusername
VITE_WIKI_REPO_NAME=your-wiki-name
```

#### C. Add Secret to GitHub

1. Go to your repo **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Name: `GITHUB_CLIENT_ID`
4. Value: Your Client ID from step A
5. Click **"Add secret"**

### 6. Test Locally

```bash
npm run dev
```

Visit `http://localhost:5173` and verify:
- ✅ Wiki loads correctly
- ✅ Navigation works
- ✅ Pages display properly
- ✅ Search works (press Ctrl+K)
- ✅ Dark mode toggle works

### 7. Customize Content

#### Replace Example Content

Delete and replace the example content:

```bash
# Keep the structure, replace the content
# Edit these files:
- public/content/getting-started/index.md
- public/content/getting-started/installation.md
- public/content/guides/index.md
- public/content/guides/creating-content.md
- public/content/reference/index.md
```

#### Add Your Logo (Optional)

```bash
# Add your logo to public/
cp path/to/your-logo.svg public/logo.svg
```

Update `wiki-config.json`:

```json
{
  "wiki": {
    "logo": "/logo.svg"
  }
}
```

### 8. Build Search Index

After adding/editing content:

```bash
npm run build:search
```

This creates `public/search-index.json` for the search feature.

### 9. Commit Your Changes

```bash
git add .
git commit -m "Configure wiki for [Your Project Name]"
git push origin main
```

### 10. Deploy to GitHub Pages

#### A. Enable GitHub Pages

1. Go to your repository **Settings** → **Pages**
2. Under **"Source"**, select **"GitHub Actions"**
3. Click **"Save"**

#### B. Automatic Deployment

The framework includes a GitHub Actions workflow that will:
- ✅ Automatically build your wiki
- ✅ Deploy to GitHub Pages
- ✅ Run on every push to `main`

Your wiki will be live at:
```
https://yourusername.github.io/your-wiki-name/
```

## ✅ Verification Checklist

Before going live, verify:

- [ ] `wiki-config.json` has your wiki name and repo info
- [ ] `vite.config.js` has correct base URL
- [ ] Example content replaced with your content
- [ ] Search index built (`npm run build:search`)
- [ ] GitHub Pages enabled
- [ ] Site builds successfully
- [ ] All pages load correctly
- [ ] Search works
- [ ] Navigation works
- [ ] GitHub OAuth configured (if using editing features)

## 🔄 Updating the Framework

To get framework updates:

```bash
cd wiki-framework
git pull origin main
cd ..
git add wiki-framework
git commit -m "Update wiki framework"
git push
```

## 📚 Next Steps

- [Creating Content Guide](public/content/guides/creating-content.md)
- [Framework Documentation](https://github.com/BenDol/GithubWiki)
- [Deployment Guide](https://github.com/BenDol/GithubWiki/blob/main/DEPLOYMENT.md)

## 🆘 Troubleshooting

### Submodule Empty or Missing

```bash
git submodule update --init --recursive
```

### "Failed to load wiki configuration" Error

- Check that `wiki-config.json` exists and is valid JSON
- Restart dev server: `Ctrl+C` then `npm run dev`

### Build Fails

```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### GitHub Pages Not Deploying

1. Check **Actions** tab for errors
2. Verify GitHub Pages is set to **"GitHub Actions"** source
3. Check that `GITHUB_CLIENT_ID` secret is set (if using auth)
4. Verify `base` URL in `vite.config.js` matches repo name

### 404 on GitHub Pages

Make sure `base` in `vite.config.js` matches your repository name:

```javascript
base: '/your-actual-repo-name/'  // Must include trailing slash!
```

## 🎨 Customization Tips

### Change Theme Colors

Edit `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        50: '#f0f9ff',
        // ... your colors
      }
    }
  }
}
```

### Add Custom Sections

1. Edit `wiki-config.json`:
   ```json
   {
     "sections": [
       {
         "id": "tutorials",
         "title": "Tutorials",
         "path": "tutorials",
         "showInHeader": true,
         "allowContributions": true,
         "order": 4
       }
     ]
   }
   ```

2. Create directory:
   ```bash
   mkdir -p public/content/tutorials
   touch public/content/tutorials/index.md
   ```

### Custom Domain

1. Add `CNAME` file to `public/`:
   ```
   wiki.yourdomain.com
   ```

2. Configure DNS:
   - Add CNAME record pointing to `yourusername.github.io`

3. Update `vite.config.js`:
   ```javascript
   base: '/'  // Root path for custom domain
   ```

## 📞 Support

- [Framework Issues](https://github.com/BenDol/GithubWiki/issues)
- [Framework Discussions](https://github.com/BenDol/GithubWiki/discussions)
- [Your Wiki Issues](https://github.com/yourusername/your-wiki-name/issues)

---

**Happy wiki building!** 🎉
