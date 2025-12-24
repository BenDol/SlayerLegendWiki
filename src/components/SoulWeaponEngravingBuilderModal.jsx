import React, { useEffect, useState, useRef } from 'react';
import { X, Check } from 'lucide-react';
import SoulWeaponEngravingBuilder from './SoulWeaponEngravingBuilder';

/**
 * Modal wrapper for Soul Weapon Engraving Builder
 *
 * Used in Battle Loadouts and other systems where soul weapon builds
 * need to be created/edited without navigating away from the page
 */
const SoulWeaponEngravingBuilderModal = ({ isOpen, onClose, initialBuild = null, onSave }) => {
  const [buildSaved, setBuildSaved] = useState(false);
  const builderRef = useRef(null);

  const handleSave = (build) => {
    setBuildSaved(true);
    if (onSave) {
      onSave(build);
    }
    onClose();
  };

  const handleSaveBuild = () => {
    // Call the saveBuild function exposed by SoulWeaponEngravingBuilder via ref
    if (builderRef.current) {
      builderRef.current.saveBuild();
    }
  };

  const handleClose = () => {
    // If build was saved, close immediately
    if (buildSaved) {
      onClose();
      return;
    }

    // Otherwise, show confirmation
    const confirmed = window.confirm(
      'You have unsaved changes. Are you sure you want to close without saving the build?'
    );

    if (confirmed) {
      onClose();
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current overflow state
      const originalOverflow = document.body.style.overflow;
      // Prevent scrolling
      document.body.style.overflow = 'hidden';

      // Reset saved flag when modal opens
      setBuildSaved(false);

      // Handle Escape key
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      document.addEventListener('keydown', handleEscape);

      // Restore on cleanup
      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, buildSaved]); // Include buildSaved in deps for handleClose

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div
        className="relative w-full h-full md:max-w-7xl md:max-h-[90vh] md:m-4 md:rounded-lg bg-gray-900 shadow-2xl flex flex-col"
      >
        {/* Fixed Header with title and close button */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 bg-gray-900 md:rounded-t-lg border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <h2 className="text-xl font-bold text-white">Soul Weapon Engraving Builder</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shadow-lg"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4">
          <SoulWeaponEngravingBuilder
            ref={builderRef}
            isModal={true}
            initialBuild={initialBuild}
            onSave={handleSave}
            allowSavingBuilds={true}
          />
        </div>

        {/* Fixed Footer with Save button */}
        <div className="flex-shrink-0 flex justify-center p-4 bg-gray-900 md:rounded-b-lg border-t border-gray-800">
          <button
            onClick={handleSaveBuild}
            className="flex items-center justify-center gap-2 px-8 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-base font-semibold transition-colors shadow-lg"
          >
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SoulWeaponEngravingBuilderModal;
