/**
 * Video Upload Handler
 * Handles video file uploads to CDN and creates PRs for approval
 */

import { createLogger } from '../../../wiki-framework/src/utils/logger.js';
const logger = createLogger('VideoUploadHandler');

// Import leo-profanity for content moderation
import LeoProfanity from 'leo-profanity';

// Import validation utilities
import {
  validatePageTitle,
  validatePageContent,
  validateEmail,
} from '../validation.js';

/**
 * Handle video upload request (server-side only)
 *
 * @param {Object} params - Upload parameters
 * @param {Buffer} params.videoFile - Video file buffer
 * @param {string} params.videoFilename - Original video filename
 * @param {string} params.videoMimeType - Video MIME type
 * @param {Buffer} [params.thumbnailFile] - Optional thumbnail buffer
 * @param {string} [params.thumbnailFilename] - Thumbnail filename
 * @param {string} [params.thumbnailMimeType] - Thumbnail MIME type
 * @param {string} params.title - Video title
 * @param {string} params.description - Video description
 * @param {string} [params.creator] - Creator name
 * @param {string} [params.category] - Video category
 * @param {Array<string>} [params.tags] - Video tags
 * @param {string} [params.difficulty] - Difficulty level
 * @param {string} [params.userEmail] - Email (for anonymous)
 * @param {string} [params.verificationToken] - Verification token (for anonymous)
 * @param {Object} params.auth - Authentication info
 * @param {string} [params.auth.user] - Authenticated GitHub user
 * @param {string} [params.auth.token] - User GitHub token
 * @param {string} [params.auth.botToken] - Bot token (for anonymous)
 * @param {Object} params.config - Wiki configuration
 * @param {Object} params.adapter - Platform adapter for env vars
 * @param {Object} params.cdnProvider - Initialized CDN provider
 * @param {Function} params.createContentPR - Function to create content PR
 * @returns {Promise<Object>} Upload result
 */
async function handleVideoUpload(params) {
  const {
    videoFile,
    videoFilename,
    videoMimeType,
    thumbnailFile,
    thumbnailFilename,
    thumbnailMimeType,
    title,
    description,
    creator,
    category,
    tags,
    difficulty,
    userEmail,
    verificationToken,
    auth,
    config,
    adapter,
    cdnProvider,
    createContentPR,
  } = params;

  const fileSize = videoFile?.length || 0;

  logger.info('Processing video upload', {
    filename: videoFilename,
    size: fileSize,
    uploadMode: 'server-side',
    authenticated: !!auth.user,
    hasThumbnail: !!thumbnailFile,
  });

  try {
    // Step 1: Validate required fields
    if (!title || !description) {
      throw new Error('Title and description are required');
    }

    // Validate video file
    if (!videoFile || videoFile.length === 0) {
      throw new Error('Video file is required');
    }

    // Step 2: Validate title and description
    const titleValidation = validatePageTitle(title);
    if (!titleValidation.valid) {
      throw new Error(`Invalid title: ${titleValidation.error}`);
    }

    const descValidation = validatePageContent(description);
    if (!descValidation.valid) {
      throw new Error(`Invalid description: ${descValidation.error}`);
    }

    // Step 3: Content moderation and verification for anonymous uploads
    if (!auth.user && !auth.token) {
      logger.debug('Running content moderation for anonymous upload');

      // Require email and verification token for anonymous uploads
      if (!userEmail || !verificationToken) {
        throw new Error('Email verification required for anonymous uploads');
      }

      // Validate email format
      const emailValidation = validateEmail(userEmail);
      if (!emailValidation.valid) {
        throw new Error(`Invalid email: ${emailValidation.error}`);
      }

      // Verify email verification token
      const jwt = await import('../jwt.js');
      const secret = adapter.getEnv('EMAIL_VERIFICATION_SECRET');
      if (!secret) {
        throw new Error('Email verification not configured');
      }

      try {
        const decoded = await jwt.verify(verificationToken, secret);
        if (!decoded || decoded.email !== userEmail) {
          throw new Error('Email verification expired or invalid');
        }
        logger.debug('Email verification token valid', { email: userEmail });
      } catch (error) {
        logger.warn('Email verification failed', { error: error.message });
        throw new Error('Email verification expired or invalid');
      }

      // Check rate limit (5 video uploads per email per 24 hours)
      const { hashEmail } = await import('../utils.js');
      const emailHash = await hashEmail(userEmail);
      const { createWikiStorage } = await import('../createWikiStorage.js');
      const storage = await createWikiStorage(adapter, config);
      const rateLimitKey = `video-upload-rate:${emailHash}`;

      try {
        const rateLimitData = await storage.read(rateLimitKey);
        if (rateLimitData) {
          const { count, windowStart } = JSON.parse(rateLimitData);
          const windowMinutes = 1440; // 24 hours
          const windowMs = windowMinutes * 60 * 1000;
          const now = Date.now();

          if (now - windowStart < windowMs) {
            if (count >= 5) {
              const timeLeft = Math.ceil((windowMs - (now - windowStart)) / (60 * 1000));
              throw new Error(`Rate limit exceeded. You can upload 5 videos per 24 hours. Try again in ${timeLeft} minutes.`);
            }
            // Increment count
            await storage.write(rateLimitKey, JSON.stringify({ count: count + 1, windowStart }));
          } else {
            // New window
            await storage.write(rateLimitKey, JSON.stringify({ count: 1, windowStart: now }));
          }
        } else {
          // First upload
          await storage.write(rateLimitKey, JSON.stringify({ count: 1, windowStart: Date.now() }));
        }
      } catch (error) {
        logger.error('Rate limit check failed', { error: error.message });
        // Don't block upload if rate limit check fails
      }

      // OpenAI moderation for title and description
      const openaiApiKey = adapter.getEnv('OPENAI_API_KEY');

      logger.debug('Checking title for inappropriate content');
      const titleCheck = await checkContentModeration(openaiApiKey, title);
      if (titleCheck.containsProfanity) {
        logger.warn('Title rejected by moderation', { method: titleCheck.method });
        throw new Error('Title contains inappropriate content');
      }

      logger.debug('Checking description for inappropriate content');
      const descCheck = await checkContentModeration(openaiApiKey, description);
      if (descCheck.containsProfanity) {
        logger.warn('Description rejected by moderation', { method: descCheck.method });
        throw new Error('Description contains inappropriate content');
      }

      logger.debug('Content passed moderation checks');
    }

    // Step 4: Prepare file data for CDN upload
    const file = {
      content: videoFile,
      filename: videoFilename,
      mimeType: videoMimeType,
      size: videoFile.length,
    };

    let thumbnail = null;
    if (thumbnailFile && thumbnailFile.length > 0) {
      thumbnail = {
        content: thumbnailFile,
        filename: thumbnailFilename || 'thumbnail.jpg',
        mimeType: thumbnailMimeType || 'image/jpeg',
        size: thumbnailFile.length,
      };
    }

    // Step 5: Prepare metadata
    const uploadedBy = auth.user || 'anonymous';
    const metadata = {
      title,
      description,
      uploadedBy,
    };

    if (creator) metadata.creator = creator;
    if (category) metadata.category = category;
    if (difficulty) metadata.difficulty = difficulty;
    // Note: tags are handled differently in video-guides.json

    // Step 6: Upload to CDN (creates CDN PR)
    // Always use bot token for CDN PR since it's a separate repository
    logger.info('Uploading video to CDN', { title, uploadedBy });

    const cdnResult = await cdnProvider.uploadVideo(
      file,
      metadata,
      thumbnail,
      {
        token: null,              // Don't use user token for CDN
        botToken: auth.botToken,  // Always use bot for CDN repository
      }
    );

    logger.info('CDN upload completed', {
      videoId: cdnResult.videoId,
      cdnPR: cdnResult.prInfo.number,
    });

    // Step 7: Create content PR (updates video-guides.json)
    logger.info('Creating content PR', { videoId: cdnResult.videoId });

    const contentPRResult = await createContentPR({
      videoId: cdnResult.videoId,
      cdnPRNumber: cdnResult.prInfo.number,
      cdnPRUrl: cdnResult.prInfo.url,
      sourceType: 'uploaded',
      videoUrl: cdnResult.videoUrl,
      thumbnailUrl: cdnResult.thumbnailUrl,
      title,
      description,
      creator,
      category,
      tags,
      difficulty,
      uploadedBy,
      auth,
      config,
      adapter,
    });

    logger.info('Content PR created', {
      contentPR: contentPRResult.prNumber,
    });

    // Step 8: Return success response
    return {
      success: true,
      videoId: cdnResult.videoId,
      cdnPR: {
        number: cdnResult.prInfo.number,
        url: cdnResult.prInfo.url,
      },
      contentPR: {
        number: contentPRResult.prNumber,
        url: contentPRResult.prUrl,
      },
      videoUrl: cdnResult.videoUrl,
      thumbnailUrl: cdnResult.thumbnailUrl,
    };
  } catch (error) {
    logger.error('Video upload failed', {
      error: error.message,
      stack: error.stack,
      filename: videoFilename,
    });

    // If CDN upload succeeded but content PR failed, we should handle rollback
    // For now, we'll just log and return the error
    // TODO: Implement automatic CDN PR closure on content PR failure

    throw error;
  }
}

/**
 * Check content for inappropriate content using OpenAI Moderation API
 * Falls back to leo-profanity if API is not configured or fails
 * @private
 */
async function checkContentModeration(openaiApiKey, text) {
  // Try OpenAI Moderation API first (if configured)
  if (openaiApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input: text })
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.results[0];
        return {
          containsProfanity: result.flagged,
          method: 'openai-moderation',
          categories: result.categories,
          scores: result.category_scores
        };
      }
    } catch (error) {
      logger.warn('OpenAI API error, falling back to leo-profanity', { error: error.message });
    }
  }

  // Fallback to leo-profanity package
  const containsProfanity = LeoProfanity.check(text);
  return { containsProfanity, method: 'leo-profanity' };
}

/**
 * Create content PR for uploaded video
 * Updates video-guides.json with new entry
 *
 * @param {Object} params - PR parameters
 * @returns {Promise<Object>} PR result with prNumber and prUrl
 */
async function createContentPR(params) {
  const {
    videoId,
    cdnPRNumber,
    cdnPRUrl,
    sourceType,
    videoUrl,
    thumbnailUrl,
    title,
    description,
    creator,
    category,
    tags,
    difficulty,
    uploadedBy,
    auth,
    config,
    adapter,
  } = params;

  // Import GitHub services
  const { getOctokit } = await import('../../../wiki-framework/src/services/github/api.js');
  const { createBranch } = await import('../../../wiki-framework/src/services/github/api.js');
  const { updateFileContent } = await import('../../../wiki-framework/src/services/github/content.js');
  const { createPullRequest } = await import('../../../wiki-framework/src/services/github/pullRequests.js');

  // Get repository info from environment variables (adapter has access)
  const owner = adapter.getEnv('WIKI_REPO_OWNER') || adapter.getEnv('VITE_WIKI_REPO_OWNER');
  const repo = adapter.getEnv('WIKI_REPO_NAME') || adapter.getEnv('VITE_WIKI_REPO_NAME');
  const dataFile = config.features?.contentCreators?.videoGuides?.dataFile || 'public/data/video-guides.json';

  logger.debug('Creating content PR', { owner, repo, dataFile });

  try {
    // Get Octokit instance:
    // - Use user's token if authenticated (PR created by user)
    // - Use bot token if anonymous (PR created by bot with user-id label)
    const token = auth.token || auth.botToken;
    const octokit = getOctokit(token);

    // Get default branch
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch || 'main';

    // Get latest commit SHA
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const baseSha = refData.object.sha;

    // Create branch
    const branchName = `video-guide-${videoId}-${Date.now()}`;
    await createBranch(owner, repo, branchName, baseSha);

    // Fetch current video-guides.json
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: dataFile,
      ref: defaultBranch,
    });

    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const videoGuidesData = JSON.parse(content);

    // Generate guide ID (URL-safe slug)
    const { generateGuideId } = await import('../../../wiki-framework/src/services/contentCreators/videoGuideService.js');
    const guideId = generateGuideId(title, videoGuidesData.videoGuides || []);

    // Create new guide entry
    const newGuide = {
      id: guideId,
      sourceType, // 'uploaded'
      cdnVideoId: videoId,
      cdnPRNumber,
      videoUrl,
      thumbnailUrl,
      title,
      description,
      submittedBy: uploadedBy,
      submittedAt: new Date().toISOString(),
      featured: false,
    };

    // Add optional fields
    if (creator) newGuide.creator = creator;
    if (category) newGuide.category = category;
    if (tags && Array.isArray(tags) && tags.length > 0) newGuide.tags = tags;
    if (difficulty) newGuide.difficulty = difficulty;

    // Add to guides array
    if (!videoGuidesData.videoGuides) {
      videoGuidesData.videoGuides = [];
    }
    videoGuidesData.videoGuides.push(newGuide);

    // Commit updated file
    const updatedContent = JSON.stringify(videoGuidesData, null, 2);
    await updateFileContent(
      owner,
      repo,
      branchName,
      dataFile,
      updatedContent,
      `Add uploaded video guide: ${title}`,
      fileData.sha
    );

    // Create PR
    const prTitle = `[Video Guide] ${title}`;
    const prBody = generateContentPRBody({
      title,
      description,
      creator,
      videoUrl,
      cdnPRNumber,
      cdnPRUrl,
      uploadedBy,
    });

    // Prepare labels
    const labels = ['video-guide', 'uploaded-video'];

    // Add ref label for anonymous submissions (enables linking later)
    // GitHub labels max 50 chars: "ref:" (4) + hash (46) = 50
    if (!auth.user) {
      const { hashEmail } = await import('../utils.js');
      const fullHash = await hashEmail(params.userEmail || 'anonymous');
      const { createEmailLabel } = await import('../../../wiki-framework/src/utils/githubLabelUtils.js');
      const LABEL_MAX_HASH_LENGTH = 46; // Max hash chars that fit in GitHub label (50 - len('ref:'))
      const refLabel = createEmailLabel(fullHash, LABEL_MAX_HASH_LENGTH);
      labels.push(refLabel);
      labels.push('linkable'); // Enable account linking for anonymous submissions
      logger.debug('Added ref label for anonymous submission', { refLabel });
    }

    const pr = await createPullRequest(
      owner,
      repo,
      prTitle,
      prBody,
      branchName,
      defaultBranch,
      labels
    );

    logger.info('Content PR created successfully', {
      prNumber: pr.prNumber,
      prUrl: pr.prUrl,
    });

    return {
      prNumber: pr.prNumber,
      prUrl: pr.prUrl,
      branch: branchName,
    };
  } catch (error) {
    logger.error('Failed to create content PR', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to create content PR: ${error.message}`);
  }
}

/**
 * Generate PR body for content submission
 * @private
 */
function generateContentPRBody(params) {
  const { title, description, creator, videoUrl, cdnPRNumber, cdnPRUrl, uploadedBy } = params;

  const lines = [
    '## Video Guide Submission',
    '',
    `**Title:** ${title}`,
    `**Video:** Uploaded video (see CDN PR)`,
    `**Description:** ${description}`,
    creator ? `**Creator:** ${creator}` : '',
    '',
    `**Video in CDN PR:** [#${cdnPRNumber}](${cdnPRUrl})`,
    '',
    '---',
    '',
    `Submitted by @${uploadedBy}`,
    '',
    '**For reviewers:** Please review the video content in the CDN PR first. Once the CDN PR is merged, you can merge this PR to publish the video guide.',
    '',
    '_This PR was created automatically by the video upload system._',
  ];

  return lines.filter(line => line !== '').join('\n');
}

export {
  handleVideoUpload,
  createContentPR,
};
