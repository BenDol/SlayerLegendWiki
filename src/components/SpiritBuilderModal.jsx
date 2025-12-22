import React, { useRef } from 'react';
import { X } from 'lucide-react';
import SpiritBuilder from './SpiritBuilder';

/**
 * SpiritBuilderModal Component
 *
 * Modal wrapper for Spirit Builder
 * Used in BattleLoadouts to create/edit spirit builds inline
 *
 * @param {boolean} isOpen - Is the modal open?
 * @param {function} onClose - Callback when closing modal
 * @param {object} initialBuild - Initial build data to load
 * @param {function} onSave - Callback when Save is clicked
 */
const SpiritBuilderModal = ({ isOpen, onClose, initialBuild = null, onSave }) => {
  const spiritBuilderRef = useRef(null);

  if (!isOpen) return null;

  const handleSave = () => {
    // Trigger save on the Spirit Builder component
    if (spiritBuilderRef.current && spiritBuilderRef.current.saveBuild) {
      spiritBuilderRef.current.saveBuild();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 md:rounded-lg shadow-xl w-full h-full md:max-w-6xl md:max-h-[90vh] md:h-auto overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🔮</span>
            <span>Spirit Builder</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <SpiritBuilder
            ref={spiritBuilderRef}
            isModal={true}
            initialBuild={initialBuild}
            onSave={onSave}
            allowSavingBuilds={true}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Save Build
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpiritBuilderModal;
