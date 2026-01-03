# Admin System Documentation

## Overview

The wiki includes a comprehensive admin system that allows repository owners and designated administrators to manage users through banning and admin privileges.

## Architecture

### Storage System

The admin system uses **GitHub Issues** as a database for storing admin and banned user lists:

- **Admins List**: Stored in an issue labeled `wiki-admin:admins`
- **Banned Users List**: Stored in an issue labeled `wiki-admin:banned-users`

**Why GitHub Issues?**
- ✅ No external database needed
- ✅ Uses existing GitHub infrastructure
- ✅ Managed by bot account (locked to prevent tampering)
- ✅ Full audit trail in issue history
- ✅ Accessible via GitHub API
- ✅ Free and scalable

### Bot Token Requirement

**IMPORTANT**: The admin system requires the bot token (`VITE_WIKI_BOT_TOKEN`) to be configured. The bot creates and manages the admin/banned user issues.

See `BOT-SETUP.md` for bot token configuration.

## User Roles

### Repository Owner
- **Always has admin access** (cannot be removed)
- Can manage admins (add/remove)
- Can ban/unban users
- Can remove other admins
- Can ban admins

### Administrators
- Designated by repository owner
- Can ban/unban regular users
- **Cannot** manage other admins
- **Cannot** ban other admins or the owner
- Can be removed by repository owner

### Regular Users
- Can view and contribute to wiki
- Can be banned by owner/admins
- Cannot access admin panel

### Banned Users
- **Cannot post comments** on wiki pages
- See error message when trying to comment
- Still can view wiki content
- Can be unbanned by owner/admins

## Features

### Ban System

**Who can ban:**
- Repository owner can ban anyone (including admins)
- Admins can ban regular users only

**Banned users cannot:**
- ❌ Post comments on wiki pages
- ❌ Create comment threads

**Banned users can still:**
- ✅ View wiki pages
- ✅ View existing comments
- ✅ Star the repository

**Ban includes:**
- Username
- Reason for ban
- Who banned them
- Timestamp

### Admin Management

**Only repository owner can:**
- Add administrators
- Remove administrators
- View admin list

**Admins cannot:**
- Add other admins
- Remove other admins
- Ban other admins
- Ban the repository owner

## Accessing the Admin Panel

### For Repository Owner and Admins:

1. Sign in with GitHub
2. Click your avatar in the top-right
3. Click **"Admin Panel"** (only visible if you're admin/owner)

**Direct URL:** `/#/admin`

**Access Control:**
- Non-authenticated users are prompted to sign in
- Regular users are denied access and redirected
- Only owner and admins can access the panel

## Admin Panel Interface

### Banned Users Tab

**Available to:** Repository owner and admins

**Features:**
- **Ban User Form**: Enter username and reason to ban a user
- **Banned Users List**: Shows all banned users with:
  - Username (linked to GitHub profile)
  - Ban reason
  - Who banned them
  - When they were banned
  - Unban button

### Administrators Tab

**Available to:** Repository owner only

**Features:**
- **Add Administrator Form**: Enter username to grant admin privileges
- **Administrators List**: Shows all admins with:
  - Username (linked to GitHub profile)
  - Who added them
  - When they were added
  - Remove button

## Usage Examples

### Banning a User

1. Navigate to Admin Panel (`/#/admin`)
2. Ensure you're on the "Banned Users" tab
3. Enter the username (without `@`) and reason
4. Click "Ban User"
5. User is immediately banned from commenting

**Example:**
- Username: `spammer123`
- Reason: `Posting spam comments repeatedly`

### Unbanning a User

1. Navigate to Admin Panel
2. Find the user in the "Banned Users" list
3. Click "Unban" button
4. Confirm the action
5. User can now comment again

### Adding an Administrator

**Only repository owner can do this:**

1. Navigate to Admin Panel
2. Click "Administrators" tab
3. Enter the username (without `@`)
4. Click "Add Admin"
5. User now has admin privileges

**Example:**
- Username: `trusted_contributor`

### Removing an Administrator

**Only repository owner can do this:**

1. Navigate to Admin Panel
2. Click "Administrators" tab
3. Find the admin in the list
4. Click "Remove" button
5. Confirm the action
6. User loses admin privileges (reverts to regular user)

## Technical Implementation

### Files

**Admin Service:**
- `wiki-framework/src/services/github/admin.js` - Core admin functions

**Admin Panel UI:**
- `wiki-framework/src/pages/AdminPanel.jsx` - Admin panel component

**Integration:**
- `wiki-framework/src/components/auth/UserMenu.jsx` - Admin link in menu
- `wiki-framework/src/components/wiki/Comments.jsx` - Ban checking
- `wiki-framework/src/router.jsx` - Admin route

**Labels:**
- `wiki-framework/.github/labels.json` - Admin system labels

### API Functions

#### Admin Status
```javascript
import { getCurrentUserAdminStatus } from '../services/github/admin';

// Check if current user is admin or owner
const status = await getCurrentUserAdminStatus(owner, repo);
// Returns: { isOwner: boolean, isAdmin: boolean, username: string }
```

#### Check if User is Admin
```javascript
import { isAdmin } from '../services/github/admin';

const userIsAdmin = await isAdmin(username, owner, repo);
// Returns: boolean
```

#### Check if User is Banned
```javascript
import { isBanned } from '../services/github/admin';

const userIsBanned = await isBanned(username, owner, repo);
// Returns: boolean
```

#### Ban User
```javascript
import { banUser } from '../services/github/admin';

await banUser(
  'username',           // Username to ban
  'Spam comments',      // Reason
  owner,                // Repo owner
  repo,                 // Repo name
  'current_admin'       // Who is banning them
);
```

#### Unban User
```javascript
import { unbanUser } from '../services/github/admin';

await unbanUser('username', owner, repo, 'current_admin');
```

#### Add Admin (Owner Only)
```javascript
import { addAdmin } from '../services/github/admin';

await addAdmin('new_admin', owner, repo, 'owner_username');
```

#### Remove Admin (Owner Only)
```javascript
import { removeAdmin } from '../services/github/admin';

await removeAdmin('admin_username', owner, repo, 'owner_username');
```

### Data Storage Format

**Admins Issue Body:**
```markdown
🔐 **Wiki Administrators**

This issue stores the list of wiki administrators...

**Admin List:**
```json
[
  {
    "username": "admin_user",
    "addedBy": "repository_owner",
    "addedAt": "2025-12-14T10:30:00.000Z"
  }
]
```

⚠️ **This issue is managed by the wiki bot.**
```

**Banned Users Issue Body:**
```markdown
🚫 **Banned Users**

This issue stores the list of users who are banned...

**Banned Users:**
```json
[
  {
    "username": "banned_user",
    "reason": "Posting spam comments",
    "bannedBy": "admin_user",
    "bannedAt": "2025-12-14T11:00:00.000Z"
  }
]
```

⚠️ **This issue is managed by the wiki bot.**
```

### Issue Locking

Both admin and banned user issues are **automatically locked** when created to prevent unauthorized edits:

- Lock reason: `off-topic`
- Only bot can update these issues
- Users cannot comment on these issues
- Prevents tampering with the lists

## Security Considerations

### Permission Model

**Repository Owner:**
- ✅ Full admin access (cannot be removed)
- ✅ Can manage admins
- ✅ Can ban anyone (including admins)

**Admins:**
- ✅ Can ban regular users
- ❌ Cannot ban other admins or owner
- ❌ Cannot manage other admins
- ❌ Cannot access admin management tab

**Regular Users:**
- ✅ Can comment and contribute
- ❌ Cannot access admin panel
- ❌ No special privileges

**Banned Users:**
- ❌ Cannot comment
- ✅ Can still view wiki

### Bot Account Security

- Bot token stored securely in `.env.local` and GitHub Secrets
- Bot has Write access (NOT Admin)
- Admin/banned issues are locked to prevent tampering
- All actions logged in issue history

### API Validation

All admin actions validate:
1. User authentication
2. Admin/owner status
3. Target user validity
4. Permission level requirements

**Example Validation:**
- Only owner can add admins → Checked before adding
- Cannot ban the owner → Blocked at API level
- Admin cannot ban another admin → Blocked at API level

## Monitoring & Audit Trail

### Issue History

All admin actions are recorded in the issue history:
- When admins were added/removed
- When users were banned/unbanned
- Who performed each action
- Timestamps for all changes

**View History:**
1. Go to the repository Issues tab
2. Find "Wiki Admins List" or "Wiki Banned Users"
3. View issue history and edits

### Console Logging

The admin system logs all actions to browser console:
```
[Admin] Added admin: username
[Admin] Banned user: username
[Admin] Created admins list issue #123
[Comments] User username is banned from commenting
```

### GitHub Audit Log

For repository owners, GitHub's audit log shows all API calls made by the bot account, providing an additional layer of accountability.

## Error Handling

### Common Errors and Solutions

**"Only the repository owner can add admins"**
- Solution: Only the repo owner can manage admins. Admins cannot add other admins.

**"Bot token not configured"**
- Solution: Configure `VITE_WIKI_BOT_TOKEN` following `BOT-SETUP.md`

**"Cannot ban the repository owner"**
- Solution: The owner cannot be banned. This is by design.

**"Only the repository owner can ban admins"**
- Solution: Regular admins cannot ban other admins. Only owner can.

**"User is already banned/admin"**
- Solution: Check the current lists before adding/banning

### Access Denied

If a regular user tries to access the admin panel:
- Redirected to home page
- Alert shown: "You must be a repository owner or admin to access this page"

## Migration & Setup

### Initial Setup

1. **Configure bot token** (see `BOT-SETUP.md`)
2. **Navigate to Admin Panel** as repository owner
3. Admin/banned user issues are automatically created
4. Start managing users!

### Existing Wikis

No migration needed:
- Admin system is opt-in
- Works immediately when bot token is configured
- No impact on existing functionality
- Backward compatible

### First-Time Access

When you first access the admin panel:
1. Two issues are automatically created:
   - "Wiki Admins List" (empty initially)
   - "Wiki Banned Users" (empty initially)
2. Both issues are locked to prevent tampering
3. Lists are managed via Admin Panel UI

## Best Practices

### Banning Users

✅ **Do:**
- Provide clear, specific reasons for bans
- Give warnings before banning when appropriate
- Document repeated violations
- Review ban list periodically

❌ **Don't:**
- Ban users without reason
- Use vague ban reasons
- Ban users for disagreements
- Forget to unban when appropriate

### Managing Admins

✅ **Do:**
- Choose trusted, experienced contributors
- Limit number of admins (fewer is better)
- Communicate expectations clearly
- Review admin list periodically

❌ **Don't:**
- Add admins without vetting
- Give admin access too freely
- Forget to remove inactive admins
- Skip communication about admin duties

### General Admin Guidelines

1. **Be transparent** - Document why users are banned
2. **Be fair** - Apply rules consistently
3. **Be responsive** - Handle reports promptly
4. **Be protective** - Ban spam/abuse quickly
5. **Be reasonable** - Unban when appropriate

## Troubleshooting

### Admin Panel Not Showing

**Check:**
1. Are you signed in?
2. Are you the repository owner or an admin?
3. Is the admin check loading? (May take a moment on first load)
4. Check browser console for errors

### Cannot Ban User

**Check:**
1. Is bot token configured?
2. Are you an admin or owner?
3. Is the username spelled correctly?
4. Is there a reason provided?
5. Check if you're trying to ban another admin (only owner can)

### Cannot Add Admin

**Check:**
1. Are you the repository owner? (Only owner can add admins)
2. Is the username spelled correctly?
3. Is the user already an admin?
4. Check browser console for errors

### Issues Not Creating

**Check:**
1. Bot token configured correctly?
2. Bot account has Write access to repository?
3. Bot account accepted collaborator invitation?
4. Labels synced (run label sync workflow)?

## FAQ

### Q: Do I need to set up the admin system?

**A:** The admin system is optional. It's only needed if you want to:
- Ban users from commenting
- Delegate moderation to trusted users
- Have centralized user management

### Q: What happens to comments from banned users?

**A:** Existing comments remain visible. Banned users just cannot post new comments.

### Q: Can banned users still view the wiki?

**A:** Yes, banned users can view all wiki content. They just cannot comment.

### Q: How do I become an admin?

**A:** Only the repository owner can add admins. Contact the repo owner if you'd like to help moderate.

### Q: Can I transfer ownership?

**A:** Repository ownership is tied to GitHub repository ownership. Transfer the repository on GitHub to transfer admin system ownership.

### Q: What if the bot token expires?

**A:** The admin system will stop working. Generate a new bot token and update `.env.local` and GitHub Secrets. See `BOT-SETUP.md` for token rotation.

### Q: Are admin actions reversible?

**A:** Yes, all actions are reversible:
- Banned users can be unbanned
- Admins can be removed
- Issue history preserves all changes

### Q: Can I export the ban/admin lists?

**A:** Yes, go to the GitHub issues labeled `wiki-admin:admins` or `wiki-admin:banned-users`. The lists are stored as JSON in the issue body.

## Summary

The wiki's admin system provides:

✅ **Repository-specific banning** - Ban users from commenting
✅ **Admin delegation** - Let trusted users help moderate
✅ **GitHub Issue storage** - No external database needed
✅ **Bot-managed** - Secure and tamper-proof
✅ **Full audit trail** - Track all admin actions
✅ **Owner controls** - Repository owner has ultimate authority
✅ **Easy to use** - Clean UI in Admin Panel

**Access:** `/#/admin` (owner and admins only)

**Requirements:** Bot token configured (see `BOT-SETUP.md`)

**Support:** Check console logs and GitHub issue history for debugging
