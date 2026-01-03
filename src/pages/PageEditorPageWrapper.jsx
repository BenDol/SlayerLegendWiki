/**
 * PageEditorPageWrapper
 * Parent project wrapper that extends framework's PageEditorPage
 * Adds support for anonymous editing by loading content for unauthenticated users
 * Provides game-specific emoticon map for the emoticon picker
 */

import React from 'react';
import PageEditorPage from '../../wiki-framework/src/pages/PageEditorPage';
import { EMOTICON_MAP } from '../components/Emoticon';

// Wrapper component that passes game-specific emoticon map
const PageEditorPageWrapper = (props) => {
  return <PageEditorPage {...props} emoticonMap={EMOTICON_MAP} />;
};

export default PageEditorPageWrapper;
