---
id: privacy-policy
title: Privacy Policy
description: How the Slayer Legend Wiki collects, uses, stores and shares your data, including cookies and advertising.
tags: [meta, privacy, legal, cookies, data]
category: Meta
date: '2026-08-07'
order: 100
---

# Privacy Policy

**Last updated:** 7 August 2026

This policy explains what data the Slayer Legend Wiki collects, why, where it is stored, and what control you have over it. It covers this website only (`slayerlegend.wiki`).

The Slayer Legend Wiki is an independent, community-run fan project. It is not affiliated with, endorsed by, or operated by the developers or publishers of Slayer Legend.

---

## The short version

- **You can read the entire wiki without logging in, and without giving us anything.**
- **If you sign in with GitHub or save a build, that data is stored publicly.** The wiki has no private database. Saved builds, collections and display names live as issues in a public GitHub repository, visible to anyone. Please don't put anything private in them.
- **We show ads from Google AdSense**, which uses cookies. In the EEA, UK and Switzerland you'll be asked for consent first, and you can decline.
- **We never sell your data**, and we don't run our own analytics or tracking pixels.
- **You can delete your saved data at any time** from within the wiki, or ask us to remove it.

---

## Who is responsible for your data

This wiki is operated by its maintainer as a non-commercial community project. For anything in this policy - questions, requests, complaints - see [Contacting us](#contacting-us) at the end.

---

## What we collect, and why

### If you only read the wiki

We collect nothing that identifies you. No account, no analytics, no tracking pixels.

Our hosting provider (Cloudflare) processes your IP address as an unavoidable part of delivering the page to you, and to protect the site from abuse. Google's advertising cookies may also be set - see [Cookies and advertising](#cookies-and-advertising).

### If you sign in with GitHub

Signing in is optional and only needed to save builds, edit pages under your own name, or earn contributor achievements. We use GitHub's OAuth device flow, which means **we never see your GitHub password**.

We receive and use:

| Data | Why |
|---|---|
| GitHub username | Attribution on edits, builds and the contributor leaderboard |
| GitHub numeric user ID | A permanent identifier, so your data survives a username change |
| Avatar image URL | Displayed next to your contributions |

Your GitHub access token is encrypted and stored **in your own browser**. It is sent to our serverless functions only to perform actions you initiate - saving a build, submitting an edit - and is never written to our logs or stored on a server.

### If you save builds, loadouts or collections

We store the build data itself, plus your GitHub username and user ID. See [Where your data is stored](#where-your-data-is-stored) - this is public.

### If you edit a page anonymously

Anonymous editing requires a verified email address, to prevent abuse and to let you claim your contributions later.

| Data | How it's handled |
|---|---|
| Your email address | Used once to send a verification code. Stored only as an irreversible SHA-256 hash |
| Verification code | Encrypted, expires after 10 minutes |
| Verification token | Expires after 24 hours |
| Display name | Whatever name you choose, published with your edit |
| Your IP address | Hashed with SHA-256 and held briefly in memory for rate limiting. The raw IP is never stored |

**Important and permanent:** when your edit is published, the commit message records your chosen display name, a **masked** form of your email (for example `j••••@example.com`), and the SHA-256 hash of your email. Git history is public and effectively immutable, so this cannot be removed later. If you would rather not have that recorded, sign in with GitHub instead, or don't edit.

### If you donate

Donations are handled by PayPal. Payments happen on PayPal's systems - **we never receive or store your card or bank details**. We receive a confirmation containing the amount and a transaction identifier, which we use to grant the donator badge.

### If you upload an image or video

Uploaded media is committed to a public repository and served over a public CDN. Please strip anything sensitive first - note that photos can carry EXIF metadata including location.

### Content moderation

Text submitted by anonymous editors - page content, edit summaries, display names - is automatically screened for abusive content before publication.

---

## Where your data is stored

**This is the most important section of this policy.**

The wiki has no private user database. Everything you save is stored as **issues in a public GitHub repository** ([`BenDol/SlayerLegendWiki`](https://github.com/BenDol/SlayerLegendWiki)). That includes:

- Saved skill builds, spirit builds, familiar builds, battle loadouts, soul weapon engravings and skill stone builds
- Your spirit and familiar collections
- Your chosen display name
- Your profile snapshot (username, user ID, contribution stats, achievements)

**Anyone on the internet can read these**, and they are included in GitHub's public API. Treat everything you save here as public. Do not put personal information, real names, contact details or anything confidential into build names, notes or display names.

Wiki page content, and the full history of every edit, is likewise public and permanent.

The only things **not** stored publicly are: your encrypted GitHub token (browser only), your email hash and verification codes (deleted after use - see [Retention](#how-long-we-keep-things)), and hashed IPs used for rate limiting (memory only).

---

## Cookies and advertising

### What's stored in your browser

| Purpose | What |
|---|---|
| Essential | Your encrypted login token, theme preference, and unsaved page drafts. Stored locally; never sent to us except when you act |
| Performance | A short-lived cache of wiki pages and game data, so the site loads faster |
| Advertising | Cookies set by Google - see below |

The essential and performance items are stored in your browser's local storage. Clearing your browser data removes them and signs you out.

### Advertising

This site is supported by advertising through **Google AdSense**. As required by Google:

- Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites.
- Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this site and/or other sites on the internet.
- You may opt out of personalised advertising by visiting [Google Ads Settings](https://www.google.com/settings/ads).
- You can opt out of a third-party vendor's use of cookies for personalised advertising at [aboutads.info/choices](http://www.aboutads.info/choices/).

If you are in the European Economic Area, the United Kingdom or Switzerland, you will be shown a consent message before any advertising cookies are set, and you can decline. If you decline, you will still see ads, but they will be non-personalised. You can change your choice at any time through the privacy settings link in the consent message.

Ads are not shown to supporters who have donated, or on the page editor.

---

## Third parties we rely on

| Service | Role | Their policy |
|---|---|---|
| GitHub | Login, and public storage of content and saved data | [Policy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) |
| Cloudflare | Hosting, delivery and abuse protection | [Policy](https://www.cloudflare.com/privacypolicy/) |
| Google AdSense | Advertising and consent management | [Policy](https://policies.google.com/technologies/ads) |
| Google reCAPTCHA | Bot protection on anonymous edits | [Policy](https://policies.google.com/privacy) |
| SendGrid (Twilio) | Sending verification emails | [Policy](https://www.twilio.com/legal/privacy) |
| PayPal | Processing donations | [Policy](https://www.paypal.com/webapps/mpp/ua/privacy-full) |
| jsDelivr | Serving game images and assets | [Policy](https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net) |

These providers operate internationally, so your data may be processed outside your country, including in the United States.

---

## How long we keep things

| Data | Retention |
|---|---|
| Email verification codes | 10 minutes, then invalid |
| Verification tokens | 24 hours |
| Stored email verification records | Deleted within 1 day |
| Hashed IPs for rate limiting | Held in memory only, discarded shortly after |
| Login token | In your browser until you sign out or clear browser data |
| Saved builds and collections | Until you delete them |
| Published page edits and commit history | Permanent and public - this cannot be undone |

---

## Your rights

If you are in the EEA or UK, you have the right to access, correct, delete, restrict or object to our use of your data, to receive a copy of it, and to complain to your local data protection authority. We honour these requests regardless of where you live.

In practice:

- **Access** - everything we hold about you is already public on GitHub, and you can read it there.
- **Deletion** - you can delete saved builds and collections yourself from within the wiki at any time. To remove a display name or profile snapshot, contact us.
- **Withdraw consent** - sign out, and use the consent message's privacy settings link to withdraw advertising consent.

**One honest limitation:** we cannot delete published page edits or commit history. Git history is a permanent public record by design, and removing it would destroy the wiki's attribution and integrity. Please keep that in mind before contributing.

Our lawful bases are: **consent** for advertising cookies and for optional email verification; **legitimate interests** for keeping the wiki secure, preventing abuse and attributing contributions; and **contract** for delivering features you actively ask for, such as saving a build.

---

## Children

This wiki is not directed at children under 13, and we do not knowingly collect data from them. Advertising shown here is not personalised to anyone we believe to be a child. If you believe a child has provided personal information, contact us and we will remove what we can.

---

## Security

Login uses GitHub's OAuth device flow, so we never handle your password. Tokens are encrypted in your browser. Emails and IP addresses are hashed with SHA-256 before storage. All traffic is served over HTTPS.

No system is perfectly secure, and because saved data is stored publicly by design, please do not rely on this site to keep anything confidential.

---

## Changes to this policy

We'll update this page when our practices change, and revise the "last updated" date above. The full revision history is public in the wiki's page history. Significant changes will be announced on our Discord.

---

## Contacting us

For privacy questions or requests, use whichever you prefer:

- **Email:** [privacy@slayerlegend.wiki](mailto:privacy@slayerlegend.wiki)
- **GitHub:** [open an issue](https://github.com/BenDol/SlayerLegendWiki/issues) - note that issues are public, so don't include personal details
- **Discord:** [join our server](https://discord.gg/slayerlegendsna2) and message a maintainer

We aim to respond within 30 days.
