import HomeHero from './HomeHero';
import HomeCreatorHighlights from './HomeCreatorHighlights';
import HomeSectionsGrid from './HomeSectionsGrid';

/**
 * Homepage building blocks, keyed by the `{{home:<widget>}}` marker name used
 * in public/content/home.md. Rendered by CustomParagraph in gameContentRenderer.
 */
export const HOME_WIDGETS = {
  hero: HomeHero,
  creators: HomeCreatorHighlights,
  sections: HomeSectionsGrid,
};

export { HomeHero, HomeCreatorHighlights, HomeSectionsGrid };
