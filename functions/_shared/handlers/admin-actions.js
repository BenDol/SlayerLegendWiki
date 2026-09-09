/**
 * Admin Actions Handler
 * Platform-agnostic handler for admin operations (add/remove admins, ban/unban users)
 * All actions are authenticated server-side
 */

import { getOctokit } from '../../../wiki-framework/src/services/github/api.js';
import { createLogger } from '../../../wiki-framework/src/utils/logger.js';

const logger = createLogger('AdminActions');

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
  logger.debug('Token check', { hasToken: !!token });
  if (!token) {
    logger.warn('No auth token provided');
    return adapter.createJsonResponse(401, { error: 'Authentication required' });
  }

  // SECURITY: the caller's token is passed explicitly per request (see
  // getOctokit(token) / getCurrentUserAdminStatus(..., token) below) rather than
  // written to the shared process.env.GITHUB_TOKEN global, which could bleed
  // between concurrent requests in the same runtime.

  // Get bot username and token from environment
  const botUsername = adapter.getEnv('WIKI_BOT_USERNAME') || adapter.getEnv('VITE_WIKI_BOT_USERNAME');
  const botToken = adapter.getEnv('WIKI_BOT_TOKEN');

  // Bridge the (constant) bot token to botService and the framework's server-side
  // read fallback, which read it from process.env deep inside the admin helpers.
  // Set it ONCE if absent and never delete it: the value is identical for every
  // request, and deleting it in a warm runtime would strip the platform-provided
  // secret from every concurrent/subsequent request (on Netlify getEnv IS
  // process.env), leaving later reads unauthenticated.
  if (botToken && !process.env.WIKI_BOT_TOKEN) {
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
          logger.debug('Checking current user admin status', { owner, repo, botUsername });
          const { getCurrentUserAdminStatus } = await getAdminModule();
          const status = await getCurrentUserAdminStatus(owner, repo, config, botUsername, token);
          logger.debug('Status result', status);
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

      // Verify authenticated user (token passed explicitly, not via process.env)
      const octokit = getOctokit(token);
      const { data: user } = await octokit.rest.users.getAuthenticated();
      const currentUsername = user.login;

      logger.info(`Admin action ${action} by ${currentUsername}`);

      // SECURITY: the donator-badge actions perform bot writes but had no
      // authorization check - only add/remove-admin and ban/unban are gated
      // (inside their services). Without this, any authenticated GitHub user
      // could self-assign a donator badge. Require admin/owner for both.
      const DONATOR_ACTIONS = new Set(['assign-donator-badge', 'remove-donator-badge']);
      if (DONATOR_ACTIONS.has(action)) {
        const { isAdmin } = await getAdminModule();
        const callerIsAdmin = await isAdmin(currentUsername, owner, repo, config, botUsername);
        if (!callerIsAdmin) {
          logger.warn(`Denied ${action}: ${currentUsername} is not an admin`);
          return adapter.createJsonResponse(403, { error: 'Admin privileges required' });
        }
      }

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
          const botToken = adapter.getEnv('WIKI_BOT_TOKEN');
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
          const botTokenForRemoval = adapter.getEnv('WIKI_BOT_TOKEN');
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
  }
}
