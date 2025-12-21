import { Helmet } from 'react-helmet-async';
import { useWikiConfig } from '../../wiki-framework/src/hooks/useWikiConfig';

/**
 * StructuredData component for adding Schema.org JSON-LD markup
 * Helps search engines understand your content better
 *
 * @param {Object} props
 * @param {string} props.type - Schema.org type (Article, WebSite, BreadcrumbList, etc.)
 * @param {Object} props.data - Schema.org data object
 */
const StructuredData = ({ type, data }) => {
  const { config } = useWikiConfig();
  const wikiConfig = config?.wiki || {};

  // Common organization data
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: wikiConfig.title || 'Slayer Legend Wiki',
    url: wikiConfig.url || 'https://slayerlegend.wiki',
    logo: wikiConfig.logo ? `${wikiConfig.url}${wikiConfig.logo}` : undefined,
    description: wikiConfig.description,
  };

  let schemaData = null;

  switch (type) {
    case 'WebSite':
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: wikiConfig.title || 'Slayer Legend Wiki',
        url: wikiConfig.url || 'https://slayerlegend.wiki',
        description: wikiConfig.description,
        publisher: organizationData,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${wikiConfig.url}/?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
        ...data,
      };
      break;

    case 'Article':
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        publisher: organizationData,
        ...data,
      };
      break;

    case 'BreadcrumbList':
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        ...data,
      };
      break;

    case 'FAQPage':
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        ...data,
      };
      break;

    case 'HowTo':
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        ...data,
      };
      break;

    case 'VideoGame':
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        ...data,
      };
      break;

    case 'SoftwareApplication':
      schemaData = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        applicationCategory: 'WebApplication',
        operatingSystem: 'Any',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        ...data,
      };
      break;

    default:
      // Custom type - use data as-is
      schemaData = {
        '@context': 'https://schema.org',
        '@type': type,
        ...data,
      };
  }

  if (!schemaData) return null;

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schemaData)}
      </script>
    </Helmet>
  );
};

/**
 * Pre-built structured data components for common use cases
 */

/**
 * Website structured data (use on homepage)
 */
export const WebSiteStructuredData = () => {
  return <StructuredData type="WebSite" data={{}} />;
};

/**
 * Article structured data (use on wiki pages)
 */
export const ArticleStructuredData = ({ title, description, url, datePublished, dateModified, author, image, section }) => {
  return (
    <StructuredData
      type="Article"
      data={{
        headline: title,
        description: description,
        url: url,
        datePublished: datePublished,
        dateModified: dateModified || datePublished,
        author: author
          ? {
              '@type': 'Person',
              name: author,
            }
          : undefined,
        image: image,
        articleSection: section,
      }}
    />
  );
};

/**
 * Breadcrumb structured data (use on all pages)
 */
export const BreadcrumbStructuredData = ({ items }) => {
  return (
    <StructuredData
      type="BreadcrumbList"
      data={{
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
};

/**
 * Tool/Application structured data (use on tool pages)
 */
export const ToolStructuredData = ({ name, description, url, image, category }) => {
  return (
    <StructuredData
      type="SoftwareApplication"
      data={{
        name: name,
        description: description,
        url: url,
        image: image,
        applicationCategory: category || 'Game Tool',
      }}
    />
  );
};

/**
 * Video Game structured data (use for game-related content)
 */
export const GameStructuredData = ({ name, description, url, image, genre, publisher }) => {
  return (
    <StructuredData
      type="VideoGame"
      data={{
        name: name,
        description: description,
        url: url,
        image: image,
        genre: genre || 'RPG',
        gamePlatform: ['iOS', 'Android'],
        publisher: publisher
          ? {
              '@type': 'Organization',
              name: publisher,
            }
          : undefined,
      }}
    />
  );
};

export default StructuredData;
