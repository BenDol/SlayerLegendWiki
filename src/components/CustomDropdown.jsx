import React, { useState, useRef, useEffect } from 'react';
import { Loader } from 'lucide-react';

/**
 * CustomDropdown Component
 *
 * A custom dropdown that supports images, descriptions, and complex HTML in menu items.
 * Designed to replace native <select> elements where more visual customization is needed.
 *
 * @param {Array} options - Array of option objects { value, label, image, description }
 * @param {*} value - Currently selected value
 * @param {Object} selectedOptionOverride - Optional: Provide selected option data directly (for when value not in options)
 * @param {Function} onChange - Callback when selection changes (receives new value)
 * @param {string} placeholder - Placeholder text when no selection
 * @param {string} className - Additional CSS classes for the container
 */
const CustomDropdown = ({
  options = [],
  value,
  selectedOptionOverride = null,
  onChange,
  placeholder = 'Select an option',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingImages, setLoadingImages] = useState(new Set());
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const selectedOptionRef = useRef(null);
  const loadedImagesRef = useRef(new Set()); // Track successfully loaded images across reopens

  // Find the selected option (handle null/undefined values)
  // Use override if provided, otherwise find in options
  const selectedOption = selectedOptionOverride || (value != null ? options.find(opt => opt.value === value) : null);

  // Mark images as loading when dropdown opens (but skip already loaded ones)
  useEffect(() => {
    if (isOpen) {
      const imagesToLoad = options
        .filter(opt => opt.image && !loadedImagesRef.current.has(opt.image))
        .map(opt => opt.image);

      setLoadingImages(new Set(imagesToLoad));

      // Failsafe: Remove loading state after 5 seconds for any images that didn't trigger onLoad/onError
      const timeout = setTimeout(() => {
        imagesToLoad.forEach(img => {
          loadedImagesRef.current.add(img);
        });
        setLoadingImages(new Set());
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [isOpen, options]);

  // Handle image load complete
  const handleImageLoad = (imageSrc) => {
    loadedImagesRef.current.add(imageSrc); // Remember this image loaded successfully
    setLoadingImages(prev => {
      const next = new Set(prev);
      next.delete(imageSrc);
      return next;
    });
  };

  // Handle image load error
  const handleImageError = (imageSrc) => {
    loadedImagesRef.current.add(imageSrc); // Mark as "loaded" to prevent retry loop
    setLoadingImages(prev => {
      const next = new Set(prev);
      next.delete(imageSrc);
      return next;
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Prevent body scroll on mobile when dropdown is open
  useEffect(() => {
    if (isOpen) {
      // Store original body overflow
      const originalOverflow = document.body.style.overflow;
      // Only prevent scroll on mobile (screens < 768px)
      if (window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
      }

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Scroll to selected option when dropdown opens
  useEffect(() => {
    if (isOpen && selectedOptionRef.current) {
      // Use setTimeout to ensure the menu is fully rendered
      setTimeout(() => {
        selectedOptionRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'center'
        });
      }, 0);
    }
  }, [isOpen]);

  const handleSelect = (optionValue, event) => {
    if (event) {
      event.stopPropagation();
    }
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-3 md:py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium hover:border-gray-400 dark:hover:border-gray-500 active:bg-gray-50 dark:active:bg-gray-700 transition-colors cursor-pointer text-left flex items-center justify-between touch-manipulation min-h-[44px]"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {selectedOption?.image && (
            <div className="relative w-6 h-6 flex-shrink-0">
              <img
                src={selectedOption.image}
                alt=""
                className="w-full h-full object-contain"
                onLoad={() => handleImageLoad(selectedOption.image)}
                onError={() => handleImageError(selectedOption.image)}
              />
            </div>
          )}
          <span className="truncate text-sm md:text-base">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[150] md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute z-[150] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-[60vh] md:max-h-96 overflow-y-auto overscroll-contain"
          style={{
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {options.map((option) => {
            const isSelected = value != null && option.value === value;
            return (
              <button
                key={option.value}
                ref={isSelected ? selectedOptionRef : null}
                type="button"
                onClick={(e) => handleSelect(option.value, e)}
                className={`w-full px-3 py-3 md:py-2.5 text-left flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-700 transition-colors touch-manipulation ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {option.image && (
                  <div className="relative w-6 h-6 md:w-6 md:h-6 flex-shrink-0">
                    {loadingImages.has(option.image) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded">
                        <Loader className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                    <img
                      src={option.image}
                      alt=""
                      className="w-full h-full object-contain"
                      onLoad={() => handleImageLoad(option.image)}
                      onError={() => handleImageError(option.image)}
                      style={{ opacity: loadingImages.has(option.image) ? 0 : 1 }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm md:text-base">{option.label}</div>
                  {option.description && (
                    <div className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
                      {option.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
