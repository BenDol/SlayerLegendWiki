/**
 * Game Progress Achievement Deciders
 * Slayer Legend specific deciders for builds and loadouts
 */

import { createLogger } from '../../../utils/logger';

const logger = createLogger('GameProgressDeciders');

/**
 * Helper: Check game data count from GitHub Issues
 * @param {Object} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} userId - User ID
 * @param {string} dataType - Data type label (e.g., 'skill-builds', 'battle-loadouts')
 * @param {number} minCount - Minimum count required
 * @returns {Promise<boolean>}
 */
async function checkGameDataCount(octokit, owner, repo, userId, dataType, minCount) {
  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: `${dataType},user-id:${userId}`,
      state: 'open',
      per_page: 100,
    });

    let totalCount = 0;
    for (const issue of issues) {
      try {
        const data = JSON.parse(issue.body);
        // Data is stored as a direct array [item1, item2, ...], not as {dataType: [...]}
        if (Array.isArray(data)) {
          totalCount += data.length;
        }
      } catch (error) {
        logger.error('Failed to parse data issue', { dataType, error });
      }
    }

    return totalCount >= minCount;
  } catch (error) {
    logger.error('Failed to check data count', { dataType, error });
    return false;
  }
}

/**
 * First Build - User saved their first skill build
 */
export async function firstBuild(userData, context) {
  const { octokit, owner, repo, userId } = context;
  return await checkGameDataCount(octokit, owner, repo, userId, 'skill-builds', 1);
}

/**
 * Build Collector - User saved 10+ skill builds
 */
export async function buildCollector(userData, context) {
  const { octokit, owner, repo, userId } = context;
  return await checkGameDataCount(octokit, owner, repo, userId, 'skill-builds', 10);
}

/**
 * First Loadout - User saved their first battle loadout
 */
export async function firstLoadout(userData, context) {
  const { octokit, owner, repo, userId } = context;
  return await checkGameDataCount(octokit, owner, repo, userId, 'battle-loadouts', 1);
}

/**
 * Loadout Expert - User saved 10+ battle loadouts
 */
export async function loadoutExpert(userData, context) {
  const { octokit, owner, repo, userId } = context;
  return await checkGameDataCount(octokit, owner, repo, userId, 'battle-loadouts', 10);
}

/**
 * Build Master - User reached the maximum number of saved builds (10)
 */
export async function buildMaster(userData, context) {
  const { octokit, owner, repo, userId } = context;
  const MAX_BUILDS = 10; // From skillBuilds.js MAX_BUILDS_PER_USER
  return await checkGameDataCount(octokit, owner, repo, userId, 'skill-builds', MAX_BUILDS);
}

/**
 * Helper: Get all user's builds with parsed data
 */
async function getUserBuildsData(octokit, owner, repo, userId) {
  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: `skill-builds,user-id:${userId}`,
      state: 'open',
      per_page: 100,
    });

    const builds = [];
    for (const issue of issues) {
      try {
        const data = JSON.parse(issue.body);
        if (Array.isArray(data)) {
          builds.push(...data);
        }
      } catch (error) {
        logger.error('Failed to parse builds issue', { error });
      }
    }

    return builds;
  } catch (error) {
    logger.error('Failed to get user builds', { error });
    return [];
  }
}

/**
 * Helper: Get all user's loadouts with parsed data
 */
async function getUserLoadoutsData(octokit, owner, repo, userId) {
  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: `battle-loadouts,user-id:${userId}`,
      state: 'open',
      per_page: 100,
    });

    const loadouts = [];
    for (const issue of issues) {
      try {
        const data = JSON.parse(issue.body);
        if (Array.isArray(data)) {
          loadouts.push(...data);
        }
      } catch (error) {
        logger.error('Failed to parse loadouts issue', { error });
      }
    }

    return loadouts;
  } catch (error) {
    logger.error('Failed to get user loadouts', { error });
    return [];
  }
}

/**
 * Helper: Get all user's saved spirits with parsed data
 */
async function getUserSpiritsData(octokit, owner, repo, userId) {
  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: `my-spirits,user-id:${userId}`,
      state: 'open',
      per_page: 100,
    });

    const spirits = [];
    for (const issue of issues) {
      try {
        const data = JSON.parse(issue.body);
        if (Array.isArray(data)) {
          spirits.push(...data);
        }
      } catch (error) {
        logger.error('Failed to parse my-spirits issue', { error });
      }
    }

    return spirits;
  } catch (error) {
    logger.error('Failed to get user spirits', { error });
    return [];
  }
}

/**
 * Spirit Collector - User collected and saved 10 different spirits
 */
export async function spiritCollector(userData, context) {
  const { octokit, owner, repo, userId } = context;

  try {
    const spirits = await getUserSpiritsData(octokit, owner, repo, userId);

    // Extract unique spirit IDs from my-spirits collection
    const uniqueSpirits = new Set();
    for (const spirit of spirits) {
      if (spirit.spiritId) {
        uniqueSpirits.add(spirit.spiritId);
      }
    }

    return uniqueSpirits.size >= 10;
  } catch (error) {
    logger.error('Failed to check spirit collection', { error });
    return false;
  }
}

/**
 * Skill Theorist - User created builds with unique skill combinations
 * Checks if user has at least 5 builds with different skill combinations
 */
export async function skillTheorist(userData, context) {
  const { octokit, owner, repo, userId } = context;

  try {
    const builds = await getUserBuildsData(octokit, owner, repo, userId);

    if (builds.length < 5) return false;

    // Create signature for each build based on skills used
    const buildSignatures = new Set();
    for (const build of builds) {
      if (build.slots && Array.isArray(build.slots)) {
        // Extract skill IDs and create a sorted signature
        const skillIds = build.slots
          .filter(slot => slot?.skill?.id)
          .map(slot => slot.skill.id)
          .sort()
          .join(',');

        if (skillIds) {
          buildSignatures.add(skillIds);
        }
      }
    }

    // At least 5 unique skill combinations
    return buildSignatures.size >= 5;
  } catch (error) {
    logger.error('Failed to check skill theorist', { error });
    return false;
  }
}

/**
 * Engraving Expert - User created 10 soul weapon engravings
 * Checks engraving-builds stored in GitHub Issues
 */
export async function engravingExpert(userData, context) {
  const { octokit, owner, repo, userId } = context;
  return await checkGameDataCount(octokit, owner, repo, userId, 'engraving-builds', 10);
}

/**
 * Completionist - User has variety of different builds saved
 * Checks if user has at least 5 builds with different skill combinations
 */
export async function completionist(userData, context) {
  const { octokit, owner, repo, userId } = context;

  try {
    const builds = await getUserBuildsData(octokit, owner, repo, userId);

    if (builds.length < 5) return false;

    // Create signatures for each build based on skills used
    const buildSignatures = new Set();
    for (const build of builds) {
      if (build.slots && Array.isArray(build.slots)) {
        // Extract skill IDs and create a sorted signature
        const skillIds = build.slots
          .filter(slot => slot?.skill?.id)
          .map(slot => slot.skill.id)
          .sort()
          .join(',');

        if (skillIds) {
          buildSignatures.add(skillIds);
        }
      }
    }

    // At least 5 unique skill combinations
    return buildSignatures.size >= 5;
  } catch (error) {
    logger.error('Failed to check completionist', { error });
    return false;
  }
}

/**
 * Innovative - User created a build with diverse skills
 * Checks if user has a build with at least 8 different skills (full build)
 * This is a simplified version - ideal would be cross-user comparison
 */
export async function innovative(userData, context) {
  const { octokit, owner, repo, userId } = context;

  try {
    const builds = await getUserBuildsData(octokit, owner, repo, userId);

    // Check if user has at least one build with 8+ unique skills (full slots)
    for (const build of builds) {
      if (build.slots && Array.isArray(build.slots)) {
        const uniqueSkills = new Set(
          build.slots
            .filter(slot => slot?.skill?.id)
            .map(slot => slot.skill.id)
        );

        if (uniqueSkills.size >= 8) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.error('Failed to check innovative', { error });
    return false;
  }
}

/**
 * Min-Maxer - User optimized their build for maximum efficiency
 * Checks if user has a build with all 8 skill slots filled
 */
export async function minMaxer(userData, context) {
  const { octokit, owner, repo, userId } = context;

  try {
    const builds = await getUserBuildsData(octokit, owner, repo, userId);

    // Check if user has at least one build with all 8 skill slots filled
    for (const build of builds) {
      if (build.slots && Array.isArray(build.slots)) {
        const filledSlots = build.slots.filter(slot => slot?.skill?.id).length;

        if (filledSlots >= 8) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.error('Failed to check min-maxer', { error });
    return false;
  }
}

/**
 * Strategist - User created an advanced tactical loadout
 * Checks if user has a complete loadout with all equipment slots filled
 */
export async function strategist(userData, context) {
  const { octokit, owner, repo, userId } = context;

  try {
    const loadouts = await getUserLoadoutsData(octokit, owner, repo, userId);

    // Check if user has at least one complete loadout
    for (const loadout of loadouts) {
      const hasSkillBuild = loadout.skillBuild && Object.keys(loadout.skillBuild).length > 0;
      const hasSpirit = loadout.spirit && Object.keys(loadout.spirit).length > 0;
      const hasSkillStone = loadout.skillStone && Object.keys(loadout.skillStone).length > 0;
      const hasPromotionAbility = loadout.promotionAbility && Object.keys(loadout.promotionAbility).length > 0;
      const hasFamiliar = loadout.familiar && Object.keys(loadout.familiar).length > 0;

      // Consider it "advanced" if at least 4 out of 5 slots are filled
      const filledSlots = [hasSkillBuild, hasSpirit, hasSkillStone, hasPromotionAbility, hasFamiliar].filter(Boolean).length;
      if (filledSlots >= 4) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('Failed to check strategist', { error });
    return false;
  }
}

/**
 * Collector - User collected all types of spirits
 * Checks if user has collected all 12 spirit characters
 */
export async function collector(userData, context) {
  const { octokit, owner, repo, userId } = context;

  try {
    // Fetch spirit-characters.json from deployed site
    // Use absolute URL since this runs server-side
    const baseUrl = context.baseUrl || 'https://slayerlegend.wiki';
    const spiritDataUrl = `${baseUrl}/data/spirit-characters.json`;

    const spiritDataResponse = await fetch(spiritDataUrl);
    if (!spiritDataResponse.ok) {
      logger.error('Failed to load spirit-characters.json', {
        url: spiritDataUrl,
        status: spiritDataResponse.status
      });
      return false;
    }

    const spiritData = await spiritDataResponse.json();
    const totalSpirits = spiritData.metadata?.totalSpirits || spiritData.spirits?.length || 0;

    if (totalSpirits === 0) return false;

    // Get user's collected spirits from my-spirits collection
    const spirits = await getUserSpiritsData(octokit, owner, repo, userId);

    // Extract unique spirit IDs from my-spirits collection
    const uniqueSpirits = new Set();
    for (const spirit of spirits) {
      if (spirit.spiritId) {
        uniqueSpirits.add(spirit.spiritId);
      }
    }

    // User must have collected all spirits
    return uniqueSpirits.size >= totalSpirits;
  } catch (error) {
    logger.error('Failed to check spirit collection', { error });
    return false;
  }
}

/**
 * Build Sharer - User shared a build with other players
 *
 * NOTE: This achievement requires additional tracking infrastructure:
 * - Track when users export builds (copy link, download JSON)
 * - Add "shareCount" or "shared" flag to build metadata
 * - Add analytics event when builds are exported/shared
 *
 * For now, returns false until sharing tracking is implemented.
 */
export async function buildSharer(userData, context) {
  // TODO: Implement when build sharing tracking is added
  // Possible approaches:
  // 1. Add shareCount to build metadata
  // 2. Track export events in separate analytics issue
  // 3. Add "lastShared" timestamp to builds
  return false;
}

/**
 * Popular Builder - User's build was viewed 10+ times
 *
 * NOTE: This achievement requires additional tracking infrastructure:
 * - Track view counts for each build (anonymous + authenticated)
 * - Store view counts in build metadata or separate analytics
 * - Handle privacy concerns (opt-in analytics)
 *
 * For now, returns false until view tracking is implemented.
 */
export async function popularBuilder(userData, context) {
  // TODO: Implement when build view tracking is added
  // Possible approaches:
  // 1. Add viewCount to build metadata
  // 2. Track views in separate analytics issue
  // 3. Use GitHub API issue views (not granular enough)
  return false;
}
