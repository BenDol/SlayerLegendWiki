import React from 'react';
import { encodeLoadout } from '../utils/battleLoadoutSerializer';

/**
 * BattleLoadoutModal Component
 *
 * Simplified: Navigates directly to BattleLoadouts page with encoded data.
 * Since BattleLoadouts is a full page component, this is cleaner than trying
 * to embed it in a modal.
 *
 * Props:
 * - isOpen: Boolean - whether to trigger navigation
 * - onClose: Function - close handler (not used, kept for API compatibility)
 * - initialLoadout: Object - pre-loaded loadout data
 *
 * Note: This component triggers navigation and doesn't render UI.
 */
const BattleLoadoutModal = ({ isOpen, onClose, initialLoadout }) => {
  React.useEffect(() => {
    if (isOpen && initialLoadout) {
      // Encode loadout and navigate to editor
      const encoded = encodeLoadout(initialLoadout);
      window.location.href = `#/battle-loadouts?data=${encoded}`;
    }
  }, [isOpen, initialLoadout]);

  // No UI - just handles navigation
  return null;
};

export default BattleLoadoutModal;
