import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWikiConfig } from '../../../wiki-framework/src/hooks/useWikiConfig';
import { getApprovedCreators, isContentCreatorsEnabled } from '../../../wiki-framework/src/services/contentCreators/contentCreatorService';
import { loadVideoGuides, areVideoGuidesEnabled } from '../../../wiki-framework/src/services/contentCreators/videoGuideService';
import { StreamEmbed, VideoGuideCard } from '../../../wiki-framework/src/components/contentCreators';
import { createLogger } from '../../utils/logger';

const logger = createLogger('HomeCreatorHighlights');

/** Arrow icon used by the "View All" links, matching the default homepage. */
const ArrowIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
    <div>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
        {title}
      </h2>
      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{subtitle}</p>
    </div>
    <Link
      to="/creators"
      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-2 group text-sm sm:text-base"
    >
      View All
      <ArrowIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
    </Link>
  </div>
);

/**
 * HomeCreatorHighlights
 *
 * Live streams and video guides for the custom home page ({{home:creators}} in
 * home.md). Ports the data loading and layout of the framework's default
 * homepage so the markdown-driven home page keeps both sections.
 */
const HomeCreatorHighlights = () => {
  const { config } = useWikiConfig();
  const [streamers, setStreamers] = useState([]);
  const [videoGuides, setVideoGuides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHighlights = async () => {
      if (!config) return;

      try {
        setLoading(true);

        const owner = config.wiki?.repository?.owner;
        const repo = config.wiki?.repository?.repo;

        if (isContentCreatorsEnabled(config) &&
            config.features?.contentCreators?.streamers?.enabled &&
            config.features?.contentCreators?.streamers?.showOnHomePage &&
            owner && repo) {
          const approvedStreamers = await getApprovedCreators(owner, repo, config);
          const limit = config.features?.contentCreators?.streamers?.homePageLimit || 3;
          setStreamers(approvedStreamers.slice(0, limit));
        }

        if (areVideoGuidesEnabled(config) &&
            config.features?.contentCreators?.videoGuides?.showOnHomePage) {
          const guides = await loadVideoGuides();
          const limit = config.features?.contentCreators?.videoGuides?.homePageLimit || 6;
          setVideoGuides(guides.slice(0, limit));
        }
      } catch (err) {
        logger.warn('Failed to load creator highlights for home page', { error: err?.message });
      } finally {
        setLoading(false);
      }
    };

    loadHighlights();
  }, [config]);

  if (loading || (!streamers.length && !videoGuides.length)) return null;

  return (
    <div>
      {streamers.length > 0 && (
        <div className="mb-8 sm:mb-12">
          <SectionHeader title="🎥 Live Streams" subtitle="Watch community streamers playing live" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {streamers.map((creator) => (
              <div
                key={creator.creatorId}
                className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-xl"
              >
                <StreamEmbed creator={creator} />
              </div>
            ))}
          </div>
        </div>
      )}

      {videoGuides.length > 0 && (
        <div className="mb-8 sm:mb-12">
          <SectionHeader title="📚 Video Guides" subtitle="Learn from community tutorials and guides" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {videoGuides.map((guide) => (
              <VideoGuideCard key={guide.id} guide={guide} mode="card" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeCreatorHighlights;
