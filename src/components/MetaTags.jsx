import { Helmet } from 'react-helmet-async';
import { useWikiConfig } from '../../wiki-framework/src/hooks/useWikiConfig';

/**
 * MetaTags component for managing dynamic Open Graph, Twitter Card, and SEO meta tags
 *
 * @param {Object} props
 * @param {string} props.title - Page title (will be appended with site name)
 * @param {string} props.description - Page description
 * @param {string} props.image - Absolute or relative URL to preview image
 * @param {string} props.url - Canonical URL for the page
 * @param {string} props.type - Open Graph type (default: 'website')
 * @param {string} props.twitterCard - Twitter card type (default: 'summary_large_image')
 * @param {Array<string>} props.keywords - SEO keywords
 * @param {string} props.author - Content author name
 * @param {string} props.datePublished - ISO date when content was published
 * @param {string} props.dateModified - ISO date when content was last modified
 * @param {string} props.section - Article section/category
 * @param {string} props.robots - Robots meta tag value (default: 'index, follow')
 * @param {string} props.language - Content language (default: 'en')
 */
const MetaTags = ({
  title,
  description,
  image,
  url,
  type = 'website',
  twitterCard = 'summary_large_image',
  keywords = [],
  author,
  datePublished,
  dateModified,
  section,
  robots = 'index, follow',
  language = 'en',
}) => {
  const { config } = useWikiConfig();

  // Fallback to wiki config defaults
  const wikiConfig = config?.wiki || {};
  const siteTitle = wikiConfig.title || 'Slayer Legend Wiki';
  const siteDescription = wikiConfig.description || 'Complete guide for Slayer Legend: Idle RPG';
  const siteUrl = wikiConfig.url || 'https://slayerlegend.wiki';
  const siteLogo = wikiConfig.logo || '/images/logo.png';

  // Build full title
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;

  // Use provided values or fallback to defaults
  const metaDescription = description || siteDescription;
  const metaImage = image || siteLogo;
  const metaUrl = url || siteUrl;

  // Ensure image URL is absolute
  const absoluteImageUrl = metaImage.startsWith('http')
    ? metaImage
    : `${siteUrl}${metaImage.startsWith('/') ? metaImage : `/${metaImage}`}`;

  // Ensure URL is absolute
  const absoluteUrl = metaUrl.startsWith('http')
    ? metaUrl
    : `${siteUrl}${metaUrl.startsWith('/') ? metaUrl : `/${metaUrl}`}`;

  return (
    <Helmet htmlAttributes={{ lang: language }}>
      {/* Basic HTML Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}
      <meta name="robots" content={robots} />
      <meta name="language" content={language} />
      {author && <meta name="author" content={author} />}

      {/* Open Graph Meta Tags (Facebook, Discord, LinkedIn, etc.) */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={absoluteImageUrl} />
      <meta property="og:image:alt" content={`${fullTitle} preview image`} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:site_name" content={siteTitle} />
      <meta property="og:locale" content={language === 'en' ? 'en_US' : language} />

      {/* Article-specific Open Graph tags */}
      {type === 'article' && datePublished && (
        <meta property="article:published_time" content={datePublished} />
      )}
      {type === 'article' && dateModified && (
        <meta property="article:modified_time" content={dateModified} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      {type === 'article' && section && (
        <meta property="article:section" content={section} />
      )}
      {type === 'article' && keywords.length > 0 && keywords.map((keyword, index) => (
        <meta key={index} property="article:tag" content={keyword} />
      ))}

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={absoluteImageUrl} />
      <meta name="twitter:image:alt" content={`${fullTitle} preview image`} />

      {/* Additional SEO Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="revisit-after" content="7 days" />

      {/* Canonical URL */}
      <link rel="canonical" href={absoluteUrl} />
    </Helmet>
  );
};

export default MetaTags;
