import PageViewer from '../../wiki-framework/src/components/wiki/PageViewer';
import { processGameSyntax, getGameComponents } from '../utils/gameContentRenderer';

/**
 * Custom PageViewer for Slayer Legend Wiki
 * Wraps the generic PageViewer with game-specific spell/equipment rendering
 */
const CustomPageViewer = ({ content, metadata, className }) => {
  return (
    <PageViewer
      content={content}
      metadata={metadata}
      className={className}
      contentProcessor={processGameSyntax}
      customComponents={getGameComponents()}
    />
  );
};

export default CustomPageViewer;
