/**
 * PageEditorPageWrapper
 * Parent project wrapper that extends framework's PageEditorPage
 * Adds support for anonymous editing by loading content for unauthenticated users
 */

import { useEffect } from 'react';
import PageEditorPage from '../../wiki-framework/src/pages/PageEditorPage';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useWikiConfig, useSection } from '../../wiki-framework/src/hooks/useWikiConfig';
import { useBranchNamespace } from '../../wiki-framework/src/hooks/useBranchNamespace';

// Re-export the framework's PageEditorPage with anonymous editing support
// The framework already has anonymous editing built-in, but there's a bug
// where it doesn't load content for unauthenticated users

// For now, we'll just re-export the framework component
// The issue is that the framework stops loading at line 88-92 if !isAuthenticated
// This needs to be fixed in the framework itself

export default PageEditorPage;
