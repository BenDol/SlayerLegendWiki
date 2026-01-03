/**
 * Admin Actions Handler
 * Platform-agnostic handler for admin operations (add/remove admins, ban/unban users)
 * All actions are authenticated server-side
 */

import { getOctokit } from '../../../wiki-framework/src/services/github/api.js';

// Lazy-load admin module to avoid top-level await issues (admin.js imports botService.js)
let adminModule = null;
async function getAdminModule() {
  if (!adminModule) {
    adminModule = await import('../../../wiki-framework/src/services/github/admin.js');
  }
  return adminModule;
}

// Lazy-load donator registry to avoid top-level await issues
let donatorRegistryModule = null;
async function getDonatorRegistry() {
  if (!donatorRegistryModule) {
    donatorRegistryModule = await import('../../../wiki-framework/src/services/github/donatorRegistry.js');
  }
  return donatorRegistryModule;
}

/**
 * Handle admin action requests
 * @param {Object} adapter - Platform adapter (Netlify, Cloudflare, etc)
 * @param {Object} configAdapter - Config adapter instance
 * @returns {Promise<Response>} API response
 */
export async function handleAdminAction(adapter, configAdapter) {
  console.log('[Admin Actions] Request received');

  // Get repository info from environment variables (adapter has access)
  const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
  const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');

  if (!owner || !repo) {
    console.error('[Admin Actions] Missing repository configuration');
    return adapter.createJsonResponse(500, { error: 'Server configuration error' });
  }

  // Get config for other settings (features, etc.) - but NOT for repository info
  const config = configAdapter.getWikiConfig();

  // Authentication check
  const token = adapter.getAuthToken();
  console.log('[Admin Actions] Token check:', { hasToken: !!token, tokenLength: token?.length });
  if (!token) {
    console.error('[Admin Actions] No auth token provided');
    return adapter.createJsonResponse(401, { error: 'Authentication required' });
  }

  // Set token for this request
  process.env.GITHUB_TOKEN = token;

  // Get bot username and token from environment
  const botUsername = adapter.getEnv('WIKI_BOT_USERNAME') || adapter.getEnv('VITE_WIKI_BOT_USERNAME');
  const botToken = adapter.getEnv('WIKI_BOT_TOKEN') || adapter.getEnv('VITE_WIKI_BOT_TOKEN');

  // Set bot token in process.env so botService can access it
  if (botToken) {
    process.env.WIKI_BOT_TOKEN = botToken;
  }

  try {
    const method = adapter.getMethod();

    if (method === 'GET') {
      // GET endpoints for fetching lists
      const params = adapter.getQueryParams();
      const action = params.action;

      switch (action) {
        case 'get-admins':
          console.log('[Admin Actions] Fetching admin list');
          const { getAdmins } = await getAdminModule();
          const admins = await getAdmins(owner, repo, config, botUsername);
          return adapter.createJsonResponse(200, { admins });

        case 'get-banned-users':
          console.log('[Admin Actions] Fetching banned users list');
          const { getBannedUsers } = await getAdminModule();
          const bannedUsers = await getBannedUsers(owner, repo, config, botUsername);
          return adapter.createJsonResponse(200, { bannedUsers });

        case 'get-admin-status':
          console.log('[Admin Actions] Checking current user admin status');
          console.log('[Admin Actions] Environment check:', {
            hasGithubToken: !!process.env.GITHUB_TOKEN,
            tokenLength: process.env.GITHUB_TOKEN?.length,
            owner,
            repo,
            botUsername
          });
          const { getCurrentUserAdminStatus } = await getAdminModule();
          const status = await getCurrentUserAdminStatus(owner, repo, config, botUsername);
          console.log('[Admin Actions] Status result:', status);
          return adapter.createJsonResponse(200, status);

        case 'get-all-donators':
          console.log('[Admin Actions] Fetching all donators');
          const { getAllDonators } = await getDonatorRegistry();
          const donators = await getAllDonators(owner, repo);
          return adapter.createJsonResponse(200, { donators });

        default:
          return adapter.createJsonResponse(400, { error: 'Invalid action' });
      }
    }

    if (method === 'POST') {
      // POST endpoints for mutations
      const body = await adapter.getJsonBody();
      const { action, username, reason, amount, addedBy, removedBy, bannedBy, unbannedBy } = body;

      // Verify authenticated user
      const octokit = getOctokit();
      const { data: user } = await octokit.rest.users.getAuthenticated();
      const currentUsername = user.login;

      console.log(`[Admin Actions] Action: ${action}, User: ${currentUsername}`);

      switch (action) {
        case 'add-admin':
          if (!username) {
            return adapter.createJsonResponse(400, { error: 'Username required' });
          }
          console.log(`[Admin Actions] Adding admin: ${username} by ${currentUsername}`);
          const { addAdmin: addAdminService } = await getAdminModule();
          const updatedAdmins = await addAdminService(username, owner, repo, currentUsername, config);
          return adapter.createJsonResponse(200, {
            success: true,
            message: `Successfully added ${username} as administrator`,
            admins: updatedAdmins
          });

        case 'remove-admin':
          if (!username) {
            return adapter.createJsonResponse(400, { error: 'Username required' });
          }
          console.log(`[Admin Actions] Removing admin: ${username} by ${currentUsername}`);
          const { removeAdmin: removeAdminService } = await getAdminModule();
          const updatedAdminsAfterRemoval = await removeAdminService(username, owner, repo, currentUsername, config);
          return adapter.createJsonResponse(200, {
            success: true,
            message: `Successfully removed ${username} from administrators`,
            admins: updatedAdminsAfterRemoval
          });

        case 'ban-user':
          if (!username || !reason) {
            return adapter.createJsonResponse(400, { error: 'Username and reason required' });
          }
          console.log(`[Admin Actions] Banning user: ${username} by ${currentUsername}`);
          const { banUser: banUserService } = await getAdminModule();
          const bannedUsers = await banUserService(username, reason, owner, repo, currentUsername, config);
          return adapter.createJsonResponse(200, {
            success: true,
            message: `Successfully banned ${username}`,
            bannedUsers
          });

        case 'unban-user':
          if (!username) {
            return adapter.createJsonResponse(400, { error: 'Username required' });
          }
          console.log(`[Admin Actions] Unbanning user: ${username} by ${currentUsername}`);
          const { unbanUser: unbanUserService } = await getAdminModule();
          const bannedUsersAfterUnban = await unbanUserService(username, owner, repo, currentUsername, config);
          return adapter.createJsonResponse(200, {
            success: true,
            message: `Successfully unbanned ${username}`,
            bannedUsers: bannedUsersAfterUnban
          });

        case 'assign-donator-badge':
          if (!username) {
            return adapter.createJsonResponse(400, { error: 'Username required' });
          }
          console.log(`[Admin Actions] Assigning donator badge: ${username} by ${currentUsername}`);

          // Get user ID from GitHub
          let userId;
          try {
            const { data: targetUser } = await octokit.rest.users.getByUsername({ username });
            userId = targetUser.id;
          } catch (error) {
            return adapter.createJsonResponse(404, { error: `User not found: ${username}` });
          }

          // Create donator status
          const donatorStatus = {
            isDonator: true,
            donatedAt: new Date().toISOString(),
            badge: config.features?.donation?.badge?.badge || '💎',
            color: config.features?.donation?.badge?.color || '#ffd700',
            assignedBy: `admin:${currentUsername}`,
          };

          if (amount) donatorStatus.amount = amount;
          if (reason) donatorStatus.reason = reason;

          const { saveDonatorStatus } = await getDonatorRegistry();

          // Get bot token from environment
          const botToken = adapter.getEnv('WIKI_BOT_TOKEN') || adapter.getEnv('VITE_WIKI_BOT_TOKEN');
          if (!botToken) {
            return adapter.createJsonResponse(500, { error: 'Bot token not configured' });
          }

          await saveDonatorStatus(owner, repo, username, userId, donatorStatus, botToken);

          return adapter.createJsonResponse(200, {
            success: true,
            message: `Successfully assigned donator badge to ${username}`,
            donatorStatus
          });

        case 'remove-donator-badge':
          if (!username) {
            return adapter.createJsonResponse(400, { error: 'Username required' });
          }
          console.log(`[Admin Actions] Removing donator badge: ${username} by ${currentUsername}`);

          // Get user ID from GitHub (optional for removal)
          let userIdForRemoval;
          try {
            const { data: targetUser } = await octokit.rest.users.getByUsername({ username });
            userIdForRemoval = targetUser.id;
          } catch (error) {
            console.warn(`[Admin Actions] Could not fetch user ID for ${username}, proceeding with username only`);
          }

          const { removeDonatorStatus } = await getDonatorRegistry();

          // Get bot token from environment
          const botTokenForRemoval = adapter.getEnv('WIKI_BOT_TOKEN') || adapter.getEnv('VITE_WIKI_BOT_TOKEN');
          if (!botTokenForRemoval) {
            return adapter.createJsonResponse(500, { error: 'Bot token not configured' });
          }

          await removeDonatorStatus(owner, repo, username, userIdForRemoval, botTokenForRemoval);

          return adapter.createJsonResponse(200, {
            success: true,
            message: `Successfully removed donator badge from ${username}`
          });

        default:
          return adapter.createJsonResponse(400, { error: 'Invalid action' });
      }
    }

    return adapter.createJsonResponse(405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('[Admin Actions] Error:', error);
    return adapter.createJsonResponse(500, {
      error: error.message || 'Internal server error'
    });
  } finally {
    // Clean up tokens
    delete process.env.GITHUB_TOKEN;
    delete process.env.WIKI_BOT_TOKEN;
  }
}
