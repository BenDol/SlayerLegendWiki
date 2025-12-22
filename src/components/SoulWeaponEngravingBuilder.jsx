import React, { useState, useEffect, useRef } from 'react';
import { Share2, Download, Upload, Settings, Trash2, Check, Loader, RefreshCw, RotateCw, Lock, X, CheckCircle, CheckCircle2, Zap, Edit, Send, Save } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { encodeBuild, decodeBuild } from '../../wiki-framework/src/components/wiki/BuildEncoder';
import { saveBuild as saveSharedBuild, loadBuild as loadSharedBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';
import { createGitHubIssue, searchGitHubIssues, getGitHubIssue, updateGitHubIssue, getOctokit } from '../../wiki-framework/src/services/github/api';
import { retryGitHubAPI } from '../../wiki-framework/src/utils/retryWithBackoff';
import { persistName, getItem, setItem, cacheName, configName } from '../../wiki-framework/src/utils/storageManager';
import { createWeaponLabel, createWeaponIdLabel } from '../../wiki-framework/src/utils/githubLabelUtils.js';
import EngravingPiece from './EngravingPiece';
import CustomDropdown from './CustomDropdown';
import ValidatedInput from './ValidatedInput';
import SavedBuildsPanel from './SavedBuildsPanel';
import { getSaveDataEndpoint } from '../utils/apiEndpoints.js';
import { validateBuildName, validateCompletionEffect, STRING_LIMITS } from '../utils/validation';
import { setCache } from '../utils/buildCache';
import { createLogger } from '../utils/logger';

const logger = createLogger('SoulWeapon');
const cacheLogger = logger.child('Cache');
const bestWeaponCacheLogger = logger.child('BestWeaponCache');
const gridLogger = logger.child('Grid');
const touchLogger = logger.child('Touch');
const autoSolveLogger = logger.child('AutoSolve');

/**
 * SoulWeaponEngravingBuilder Component
 *
 * Interactive tool for planning soul weapon engraving layouts
 * Features:
 * - 42 soul weapons with unique grid patterns
 * - 7 engraving piece shapes with 6 rarity tiers
 * - Drag-and-drop piece placement with preview
 * - Piece rotation with confirmation UI
 * - Grid completion bonus display
 * - Share/save builds
 * - Configurable piece inventory slots
 */
const SoulWeaponEngravingBuilder = ({ isModal = false, initialBuild = null, onSave = null, allowSavingBuilds = true }) => {
  const { isAuthenticated, user } = useAuthStore();
  const gridRef = useRef(null);

  // ===== CONSTANTS =====
  // Grid configuration
  const GAP_SIZE = 4; // Gap between grid cells in pixels
  const GRID_PADDING = 8; // Padding inside grid container (affects all positioning)
  const LINE_THICKNESS = 8; // Thickness of connecting lines between gems

  // Grid scaling
  const GRID_SCALE_DEFAULT = 1.5; // Default scale (150%) when auto-scale is off
  const GRID_SCALE_MIN = 0.5; // Minimum scale (50%)
  const GRID_SCALE_MAX = 2.4; // Maximum scale (240%)
  const GRID_SCALE_STEP = 0.1; // Scale slider step size
  const GRID_SCALE_MARGIN_MULTIPLIER = 300; // Multiplier for calculating margins during scaling

  // Inventory
  const INVENTORY_SIZE = 8; // Number of piece inventory slots

  // Piece levels
  const MIN_PIECE_LEVEL = 1;
  const MAX_PIECE_LEVEL = 50;

  // Rarity tiers
  const RARITY_COUNT = 6; // Common, Great, Rare, Epic, Legendary, Mythic (0-5)

  // Preset inventory configurations
  const INVENTORY_PRESETS = [
    {
      id: 'atk-gold',
      name: '4 ATK + 4 Gold',
      description: '4 L-Shapes (ATK) + 4 Lines (Gold)',
      pieces: [
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }  // Line (EXTRA_GOLD) - Mythic
      ]
    },
    {
      id: 'crit-atk-gold',
      name: '1 CRIT + 3 ATK + 4 Gold',
      description: '1 Square (CRIT) + 3 L-Shapes (ATK) + 4 Lines (Gold)',
      pieces: [
        { shapeId: 4, rarity: 5, level: 50 }, // Square (CRIT_DMG) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }  // Line (EXTRA_GOLD) - Mythic
      ]
    },
    {
      id: 'hp-atk-gold',
      name: '1 HP + 3 ATK + 4 Gold',
      description: '1 Reverse L-Shape (HP) + 3 L-Shapes (ATK) + 4 Lines (Gold)',
      pieces: [
        { shapeId: 2, rarity: 5, level: 50 }, // Reverse L-Shape (HP) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 1, rarity: 5, level: 50 }, // L-Shape (ATK) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }, // Line (EXTRA_GOLD) - Mythic
        { shapeId: 5, rarity: 5, level: 50 }  // Line (EXTRA_GOLD) - Mythic
      ]
    }
  ];

  // Natural image sizing - calculated from actual piece images
  const [cellSize, setCellSize] = useState(45); // Will be set from image dimensions
  const [imageSizesCache, setImageSizesCache] = useState({}); // Cache of natural image sizes

  // Data loading states
  const [weapons, setWeapons] = useState([]); // Weapons WITH grid data (from soul-weapon-grids.json)
  const [allWeapons, setAllWeapons] = useState([]); // ALL weapons (from soul-weapons.json)
  const [engravings, setEngravings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wikiConfig, setWikiConfig] = useState(null); // Wiki config for repo info

  // Builder state
  const [selectedWeapon, setSelectedWeapon] = useState(null);
  const [buildName, setBuildName] = useState('');
  const [gridState, setGridState] = useState([]); // Grid with placed pieces
  const [inventory, setInventory] = useState(Array(INVENTORY_SIZE).fill(null)); // Inventory slots
  const [lockedInventoryIndices, setLockedInventoryIndices] = useState([]); // Tracks which inventory pieces are placed
  const [highestUnlockedWeapon, setHighestUnlockedWeapon] = useState(57); // Highest weapon ID unlocked (default: all)

  // Drag and placement states
  const [draggingPiece, setDraggingPiece] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [draggingFromGrid, setDraggingFromGrid] = useState(null); // {anchorRow, anchorCol} if dragging from grid
  const [dragPatternOffset, setDragPatternOffset] = useState({ row: 0, col: 0 }); // Which pattern cell was clicked
  const [previewPosition, setPreviewPosition] = useState(null); // { row, col }
  const [dragPreviewCells, setDragPreviewCells] = useState([]); // Array of {row, col, valid} for highlighting
  const [currentDragRotation, setCurrentDragRotation] = useState(0); // Rotation during drag
  const [placingPiece, setPlacingPiece] = useState(null); // Piece awaiting confirmation
  const [placingPosition, setPlacingPosition] = useState(null); // { row, col }
  const [placingRotation, setPlacingRotation] = useState(0);
  const [placingInventoryIndex, setPlacingInventoryIndex] = useState(null); // Preserve inventory index during placement

  // UI states
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Saved builds state
  const [savedBuilds, setSavedBuilds] = useState([]);
  const [currentLoadedBuildId, setCurrentLoadedBuildId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Debug mode
  const [debugMode, setDebugMode] = useState(false);

  // Grid scaling state (1.0 = 100%, 2.0 = 200%, etc.)
  const [autoScale, setAutoScale] = useState(true); // Auto-fit to parent container
  const [gridScale, setGridScale] = useState(GRID_SCALE_DEFAULT);
  const [calculatedScale, setCalculatedScale] = useState(GRID_SCALE_DEFAULT); // Scale calculated from container size
  const gridContainerRef = useRef(null); // Ref for measuring parent container

  // Piece selection modal states
  const [showPieceSelector, setShowPieceSelector] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [selectedRarity, setSelectedRarity] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState(MIN_PIECE_LEVEL);

  // Level editor state
  const [editingLevelSlot, setEditingLevelSlot] = useState(null); // Index of slot being edited
  const [levelInputValue, setLevelInputValue] = useState('');

  // Touch state for mobile drag support
  const [touchDragging, setTouchDragging] = useState(false);
  const touchDraggingRef = useRef(false); // Immediate drag state without React update delay
  const draggingPieceRef = useRef(null); // Immediate piece state without React update delay
  const touchCleanupRef = useRef(null); // Store cleanup function for document touch listeners
  const [touchStartPos, setTouchStartPos] = useState(null);
  const [touchCurrentPos, setTouchCurrentPos] = useState(null); // Current finger position
  const inventoryContainerRef = useRef(null);

  // Placement button position (fixed during rotation to prevent movement)
  const [placingButtonPosition, setPlacingButtonPosition] = useState(null);

  // Auto-solve state
  const [autoSolveSolutions, setAutoSolveSolutions] = useState([]);
  const [showSolutionPicker, setShowSolutionPicker] = useState(false);
  const [isSolving, setIsSolving] = useState(false);

  // Find Best Weapon state
  const [showBestWeaponModal, setShowBestWeaponModal] = useState(false);
  const [bestWeaponResults, setBestWeaponResults] = useState([]);
  const [isFindingBestWeapon, setIsFindingBestWeapon] = useState(false);

  // Solution cache - stores solutions by weapon and inventory signature
  const [solutionCache, setSolutionCache] = useState({});

  // Grid Designer state (for weapons without grid data)
  const [isGridDesigner, setIsGridDesigner] = useState(false); // True when selected weapon has no grid data
  const [forceDesignMode, setForceDesignMode] = useState(false); // Force design mode even when submissions exist
  const [designerGrid, setDesignerGrid] = useState([]); // Grid for designer mode (toggle cells)
  const [gridType, setGridType] = useState('4x4'); // Grid size selection
  const [completionAtk, setCompletionAtk] = useState(''); // ATK completion effect %
  const [completionHp, setCompletionHp] = useState(''); // HP completion effect %
  const [submitting, setSubmitting] = useState(false); // Submission in progress
  const [existingSubmissions, setExistingSubmissions] = useState([]); // Existing submissions from GitHub
  const [loadingSubmissions, setLoadingSubmissions] = useState(false); // Loading submissions
  const [submissionLoadError, setSubmissionLoadError] = useState(null); // Error loading submissions
  const [selectedSubmissionIndex, setSelectedSubmissionIndex] = useState(0); // Which submission to show (0 = first)
  const [weaponsWithSubmissions, setWeaponsWithSubmissions] = useState(new Set()); // Set of weapon names that have community submissions
  const [currentSubmissionMeta, setCurrentSubmissionMeta] = useState(null); // Metadata for currently loaded submission
  const [loadingSharedBuild, setLoadingSharedBuild] = useState(false); // True while loading a shared build (prevents grid initialization)
  const hasInitializedGridForWeapon = useRef(null); // Track which weapon we've initialized the grid for
  const hasLoadedSubmissionsForWeapon = useRef(null); // Track which weapon we've loaded submissions for

  // Submission cache constants
  const SUBMISSION_CACHE_KEY = cacheName('soul_weapon_submissions');
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Best Weapon cache constants
  const BEST_WEAPON_CACHE_KEY = cacheName('soul_weapon_best');
  const BEST_WEAPON_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  // Helper functions for localStorage-based submission cache
  const getSubmissionCache = () => {
    try {
      const cached = localStorage.getItem(SUBMISSION_CACHE_KEY);
      if (!cached) return {};
      return JSON.parse(cached);
    } catch (error) {
      cacheLogger.error('Failed to read submission cache', { error });
      return {};
    }
  };

  const setSubmissionCache = (weaponName, submissions) => {
    try {
      const cache = getSubmissionCache();
      cache[weaponName] = {
        submissions,
        timestamp: Date.now()
      };
      localStorage.setItem(SUBMISSION_CACHE_KEY, JSON.stringify(cache));
      cacheLogger.debug(`Cached ${submissions.length} submission(s) for ${weaponName}`);
    } catch (error) {
      cacheLogger.error('Failed to write submission cache', { error });
    }
  };

  const invalidateSubmissionCache = (weaponName) => {
    try {
      const cache = getSubmissionCache();
      delete cache[weaponName];
      localStorage.setItem(SUBMISSION_CACHE_KEY, JSON.stringify(cache));
      cacheLogger.debug(`Invalidated cache for ${weaponName}`);
    } catch (error) {
      cacheLogger.error('Failed to invalidate cache', { error });
    }
  };

  const cleanExpiredCache = () => {
    try {
      const cache = getSubmissionCache();
      const now = Date.now();
      let cleaned = false;

      Object.keys(cache).forEach(weaponName => {
        if (now - cache[weaponName].timestamp > CACHE_TTL) {
          delete cache[weaponName];
          cleaned = true;
        }
      });

      if (cleaned) {
        localStorage.setItem(SUBMISSION_CACHE_KEY, JSON.stringify(cache));
        cacheLogger.debug('Cleaned expired cache entries');
      }
    } catch (error) {
      cacheLogger.error('Failed to clean expired cache', { error });
    }
  };

  // Helper functions for best weapon cache
  const getBestWeaponCache = () => {
    try {
      const cached = localStorage.getItem(BEST_WEAPON_CACHE_KEY);
      if (!cached) return null;

      const { results, timestamp, inventorySignature, highestUnlockedWeapon: cachedHighestWeapon } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is expired
      if (now - timestamp > BEST_WEAPON_CACHE_TTL) {
        bestWeaponCacheLogger.debug('Cache expired');
        localStorage.removeItem(BEST_WEAPON_CACHE_KEY);
        return null;
      }

      // Generate current inventory signature
      const currentInventorySignature = inventory
        .filter(p => p !== null)
        .map(p => `${p.shapeId}-${p.rarity}-${p.level}`)
        .sort()
        .join('|');

      // Check if inventory has changed
      if (inventorySignature !== currentInventorySignature) {
        bestWeaponCacheLogger.debug('Inventory changed, cache invalid');
        localStorage.removeItem(BEST_WEAPON_CACHE_KEY);
        return null;
      }

      // Check if highest unlocked weapon has changed
      if (cachedHighestWeapon !== highestUnlockedWeapon) {
        bestWeaponCacheLogger.debug('Highest unlocked weapon changed, cache invalid');
        localStorage.removeItem(BEST_WEAPON_CACHE_KEY);
        return null;
      }

      bestWeaponCacheLogger.debug('Valid cache found');
      return results;
    } catch (error) {
      bestWeaponCacheLogger.error('Failed to read cache', { error });
      return null;
    }
  };

  const setBestWeaponCache = (results) => {
    try {
      const inventorySignature = inventory
        .filter(p => p !== null)
        .map(p => `${p.shapeId}-${p.rarity}-${p.level}`)
        .sort()
        .join('|');

      const cacheData = {
        results,
        timestamp: Date.now(),
        inventorySignature,
        highestUnlockedWeapon
      };

      localStorage.setItem(BEST_WEAPON_CACHE_KEY, JSON.stringify(cacheData));
      bestWeaponCacheLogger.debug('Cached results for current inventory');
    } catch (error) {
      bestWeaponCacheLogger.error('Failed to write cache', { error });
    }
  };

  // Serialize gridState and inventory for draft storage (remove complex shape objects)
  const serializedDraftData = React.useMemo(() => {
    // Serialize gridState: Only include serializable piece data
    const serializedGridState = gridState.map(row =>
      row.map(cell => ({
        active: cell.active,
        piece: cell.piece ? {
          shapeId: cell.piece.shapeId,
          rarity: cell.piece.rarity,
          level: cell.piece.level,
          rotation: cell.piece.rotation,
          anchorRow: cell.piece.anchorRow,
          anchorCol: cell.piece.anchorCol
        } : null
      }))
    );

    // Serialize inventory: Only include serializable piece data
    const serializedInventory = inventory.map(item => item ? {
      shapeId: item.shapeId,
      rarity: item.rarity,
      level: item.level
    } : null);

    return {
      buildName,
      selectedWeapon,
      gridState: serializedGridState,
      inventory: serializedInventory,
      highestUnlockedWeapon,
      isGridDesigner,
      forceDesignMode,
      designerGrid,
      gridType,
      completionAtk,
      completionHp
    };
  }, [buildName, selectedWeapon, gridState, inventory, highestUnlockedWeapon, isGridDesigner, forceDesignMode, designerGrid, gridType, completionAtk, completionHp]);

  // Draft storage hook
  const { loadDraft, clearDraft } = useDraftStorage(
    'soulWeaponEngraving',
    user,
    isModal,
    serializedDraftData
  );

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Clean expired cache on mount
  useEffect(() => {
    cleanExpiredCache();
  }, []);

  // Load shared build from URL
  useEffect(() => {
    if (weapons.length === 0 || engravings.length === 0 || allWeapons.length === 0) return; // Wait for data to load

    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const shareChecksum = urlParams.get('share');

    if (shareChecksum) {
      const loadFromSharedUrl = async () => {
        try {
          setLoading(true);
          setLoadingSharedBuild(true); // Prevent grid initialization
          logger.info('Loading shared build', { shareChecksum });

          if (!wikiConfig) {
            logger.error('Wiki config not loaded');
            return;
          }

          const owner = wikiConfig.wiki.repository.owner;
          const repo = wikiConfig.wiki.repository.repo;

          const buildData = await loadSharedBuild(owner, repo, shareChecksum);

          if (buildData.type === 'soul-weapon-engraving') {
            // Load the build data
            setBuildName(buildData.data.name || '');

            logger.debug('Build data received', {
              hasWeaponId: !!buildData.data.weaponId,
              weaponId: buildData.data.weaponId,
              hasGridState: !!buildData.data.gridState,
              hasInventory: !!buildData.data.inventory,
              gridStateLength: buildData.data.gridState?.length,
              inventoryLength: buildData.data.inventory?.length
            });

            // IMPORTANT: Load grid state and inventory BEFORE setting weapon
            // This prevents the weapon change effect from reinitializing an empty grid

            // Support both old format (gridState) and new optimized format (pieces)
            if (buildData.data.pieces) {
              // New optimized format: pieces array with anchor coordinates
              logger.debug('Loading pieces from shared build (optimized format)');

              // First, get the weapon to know the grid structure
              const gridWeapon = weapons.find(w => w.id === buildData.data.weaponId);
              if (gridWeapon) {
                // Initialize grid with weapon's active slots
                const gridSize = gridWeapon.gridType === '4x4' ? 4 : 5;
                const newGrid = Array(gridSize).fill(null).map(() =>
                  Array(gridSize).fill(null).map(() => ({
                    active: false,
                    piece: null
                  }))
                );

                // Mark active slots
                gridWeapon.activeSlots.forEach(slot => {
                  if (slot.row < gridSize && slot.col < gridSize) {
                    newGrid[slot.row][slot.col].active = true;
                  }
                });

                // Place pieces on the grid
                buildData.data.pieces.forEach(piece => {
                  const shape = engravings.find(e => e.id === piece.shapeId);
                  if (shape) {
                    const pattern = getRotatedPattern(shape.pattern, piece.rotation);

                    // Place piece at all occupied cells
                    for (let pRow = 0; pRow < pattern.length; pRow++) {
                      for (let pCol = 0; pCol < pattern[pRow].length; pCol++) {
                        if (pattern[pRow][pCol] === 1) {
                          const gridRow = piece.row + pRow;
                          const gridCol = piece.col + pCol;

                          if (gridRow < gridSize && gridCol < gridSize) {
                            newGrid[gridRow][gridCol].piece = {
                              shapeId: piece.shapeId,
                              shape: shape,
                              rarity: piece.rarity,
                              level: piece.level,
                              rotation: piece.rotation,
                              anchorRow: piece.row,
                              anchorCol: piece.col
                            };
                          }
                        }
                      }
                    }
                  }
                });

                setGridState(newGrid);
              }
            } else if (buildData.data.gridState) {
              // Legacy format: full gridState array (backward compatibility)
              logger.debug('Loading grid state from shared build (legacy format)');

              const deserializedGridState = buildData.data.gridState.map(row =>
                row.map(cell => ({
                  active: cell.active,
                  piece: cell.piece ? {
                    ...cell.piece,
                    shape: engravings.find(e => e.id === cell.piece.shapeId)
                  } : null
                }))
              );

              setGridState(deserializedGridState);
            }

            if (buildData.data.inventory) {
              logger.debug('Loading inventory from shared build');

              // Handle both array of items and array with slot indices
              let deserializedInventory = Array(8).fill(null);

              if (Array.isArray(buildData.data.inventory)) {
                if (buildData.data.inventory.length > 0 && buildData.data.inventory[0]?.slot !== undefined) {
                  // New format: array of {slot, shapeId, rarity, level}
                  buildData.data.inventory.forEach(item => {
                    if (item && item.slot !== undefined && item.slot < 8) {
                      deserializedInventory[item.slot] = {
                        shapeId: item.shapeId,
                        rarity: item.rarity,
                        level: item.level,
                        shape: engravings.find(e => e.id === item.shapeId)
                      };
                    }
                  });
                } else {
                  // Legacy format: array with nulls
                  deserializedInventory = buildData.data.inventory.map(item => item ? {
                    ...item,
                    shape: engravings.find(e => e.id === item.shapeId)
                  } : null);
                }
              }

              setInventory(deserializedInventory);
            }

            // Find and set the weapon (merge grid data with base weapon data)
            if (buildData.data.weaponId) {
              const baseWeapon = allWeapons.find(w => w.id === buildData.data.weaponId);
              const gridWeapon = weapons.find(w => w.id === buildData.data.weaponId);

              if (gridWeapon && baseWeapon) {
                // Merge grid data with base weapon data
                const mergedWeapon = {
                  ...gridWeapon,
                  image: baseWeapon.image,
                  attack: baseWeapon.attack,
                  requirements: baseWeapon.requirements
                };
                logger.debug('Loaded weapon from shared build (merged grid + base)', {
                  name: mergedWeapon.name,
                  id: mergedWeapon.id,
                  hasImage: !!mergedWeapon.image
                });
                // Mark this weapon as already initialized to prevent re-initialization
                hasInitializedGridForWeapon.current = `${mergedWeapon.id}-${mergedWeapon.name}`;
                setSelectedWeapon(mergedWeapon);
              } else if (gridWeapon) {
                // Has grid data but no base weapon data - use grid weapon (contains all essential data)
                logger.debug('Loaded weapon from shared build (grid data only)', {
                  name: gridWeapon.name,
                  id: gridWeapon.id,
                  hasImage: !!gridWeapon.image,
                  hasGridType: !!gridWeapon.gridType,
                  hasActiveSlots: !!gridWeapon.activeSlots
                });
                // Mark this weapon as already initialized to prevent re-initialization
                hasInitializedGridForWeapon.current = `${gridWeapon.id}-${gridWeapon.name}`;
                setSelectedWeapon(gridWeapon);
              } else if (baseWeapon) {
                // No grid data, use base weapon
                logger.debug('Loaded weapon from shared build (base data only)', {
                  name: baseWeapon.name,
                  id: baseWeapon.id,
                  hasImage: !!baseWeapon.image
                });
                // Mark this weapon as already initialized to prevent re-initialization
                hasInitializedGridForWeapon.current = `${baseWeapon.id}-${baseWeapon.name}`;
                setSelectedWeapon(baseWeapon);
              } else {
                logger.error('Could not find weapon with ID', {
                  weaponId: buildData.data.weaponId,
                  hasBaseWeapon: !!baseWeapon,
                  hasGridWeapon: !!gridWeapon,
                  allWeaponsCount: allWeapons.length,
                  weaponsWithGridCount: weapons.length
                });
              }
            } else {
              logger.warn('No weaponId in shared build data');
            }

            // Force normal mode (not designer mode) when loading shared builds
            setIsGridDesigner(false);
            setForceDesignMode(false);

            setHasUnsavedChanges(true);
            logger.info('Shared build loaded successfully');
          } else {
            logger.error('Invalid build type', { type: buildData.type });
            alert('Invalid build type. This URL is for a different builder.');
          }
        } catch (error) {
          logger.error('Failed to load shared build', { error });
          alert(`Failed to load shared build: ${error.message}`);
        } finally {
          setLoading(false);
          setLoadingSharedBuild(false); // Allow grid initialization again
        }
      };
      loadFromSharedUrl();
    }
  }, [weapons, engravings, allWeapons, wikiConfig]);

  // Load all weapons with submissions after config and weapons load
  useEffect(() => {
    if (wikiConfig && allWeapons.length > 0) {
      loadAllWeaponsWithSubmissions();
    }
  }, [wikiConfig, allWeapons]);

  // Load highest unlocked weapon from localStorage
  useEffect(() => {
    const key = configName('soul_weapon_highest');
    const saved = getItem(key);
    if (saved && typeof saved === 'number') {
      if (saved >= 1 && saved <= 57) {
        setHighestUnlockedWeapon(saved);
      }
    }
  }, []);

  // Save highest unlocked weapon to localStorage
  useEffect(() => {
    const key = configName('soul_weapon_highest');
    setItem(key, highestUnlockedWeapon);
  }, [highestUnlockedWeapon]);

  // Calculate natural cell size from piece images
  useEffect(() => {
    if (engravings.length > 0) {
      calculateNaturalCellSize();
    }
  }, [engravings]);

  // Initialize grid when weapon changes (skip if loading shared build or already initialized for this weapon)
  useEffect(() => {
    if (selectedWeapon && !loadingSharedBuild) {
      // Check if we've already initialized the grid for this weapon
      const weaponKey = `${selectedWeapon.id}-${selectedWeapon.name}`;

      // Check if grid is already populated (from shared build or draft)
      const hasPlacedPieces = gridState.some(row =>
        row.some(cell => cell.piece !== null && cell.piece !== undefined)
      );

      logger.trace('Weapon change effect triggered', {
        weapon: selectedWeapon.name,
        weaponKey,
        lastInitialized: hasInitializedGridForWeapon.current,
        loadingSharedBuild,
        gridStateLength: gridState.length,
        hasPlacedPieces
      });

      // If weapon actually changed (different weapon key)
      if (hasInitializedGridForWeapon.current !== weaponKey) {
        // If there are placed pieces, unsocket them all first
        if (hasPlacedPieces) {
          logger.debug('Weapon changed - unsocketing all pieces');
          unsocketAllPieces();
        }

        logger.debug('Initializing grid for weapon change');
        hasInitializedGridForWeapon.current = weaponKey;
        initializeGrid();
      } else {
        logger.trace('Skipping grid initialization - already initialized for this weapon');
      }
    }
  }, [selectedWeapon, loadingSharedBuild]);

  // Handle mode switching when submissions load
  useEffect(() => {
    // Check if grid is already populated (from shared build or draft)
    const hasPlacedPieces = gridState.some(row =>
      row.some(cell => cell.piece !== null && cell.piece !== undefined)
    );

    logger.trace('Mode switching effect triggered', {
      hasWeapon: !!selectedWeapon,
      hasGridData: weaponHasGridData(),
      hasSubmissionMeta: !!currentSubmissionMeta,
      submissionsCount: existingSubmissions.length,
      forceDesignMode,
      loadingSharedBuild,
      hasPlacedPieces,
      loadingSubmissions
    });

    // Skip if loading shared build, no weapon, weapon has official grid data, or grid already populated
    if (loadingSharedBuild || !selectedWeapon || weaponHasGridData() || hasPlacedPieces) {
      logger.trace('Skipping mode switch - loading shared build, has official data, or grid already populated');
      return;
    }

    // If we have a weapon with no grid data, and we're not currently loading submissions,
    // and we have no submissions yet, and we haven't already tried loading for this weapon, trigger a load
    const weaponKey = `${selectedWeapon.id}-${selectedWeapon.name}`;
    if (!loadingSubmissions && existingSubmissions.length === 0 && wikiConfig && hasLoadedSubmissionsForWeapon.current !== weaponKey) {
      logger.debug('No submissions loaded yet for weapon without grid data - triggering load');
      hasLoadedSubmissionsForWeapon.current = weaponKey;
      loadExistingSubmissions();
      return; // Exit early, will re-run when submissions load
    }

    // Weapon has no official grid data - check for submissions
    if (existingSubmissions.length > 0 && !forceDesignMode) {
      // Submissions exist and not forcing design mode - show normal grid mode with submission
      logger.debug('Switching to normal mode with submission');
      setIsGridDesigner(false);
      loadSubmissionIntoNormalGrid(existingSubmissions[0]);
    } else {
      // No submissions or forcing design mode - show designer mode
      logger.debug('Switching to designer mode');
      setIsGridDesigner(true);
      if (existingSubmissions.length > 0) {
        // Load submission into designer for editing
        logger.debug('Loading submission into designer');
        loadSubmissionIntoDesigner(existingSubmissions[0]);
      } else {
        // No submissions - start with empty grid
        logger.debug('Initializing empty designer grid');
        initializeDesignerGrid();
      }
    }
  }, [existingSubmissions, forceDesignMode, loadingSharedBuild, selectedWeapon, wikiConfig, loadingSubmissions]);

  // Update locked inventory indices when grid changes
  useEffect(() => {
    updateLockedInventoryIndices();
  }, [gridState, inventory]);

  // Calculate auto-scale based on container size
  useEffect(() => {
    if (!autoScale || !selectedWeapon || !gridContainerRef.current) return;

    const calculateAutoScale = () => {
      const container = gridContainerRef.current;
      if (!container) return;

      // Get container dimensions (accounting for padding)
      const containerRect = container.getBoundingClientRect();
      const containerWidth = container.clientWidth;

      // Calculate padding based on viewport width (p-3 on mobile, sm:p-6 on desktop)
      const isMobile = window.innerWidth < 640; // sm breakpoint
      const containerPadding = isMobile ? 24 : 48; // 12px * 2 for mobile, 24px * 2 for desktop

      // For height, use the available width to maintain square aspect ratio
      // This ensures the grid fills the container width completely
      const availableWidth = containerWidth - containerPadding;

      // Calculate grid natural size
      // Use submission gridType if available (community submissions), otherwise use weapon gridType
      const effectiveGridType = currentSubmissionMeta?.gridType || selectedWeapon.gridType || '5x5';
      const gridSize = effectiveGridType === '4x4' ? 4 : 5;
      const adjustedCellSize = cellSize;
      const gridNaturalWidth = gridSize * adjustedCellSize + (gridSize - 1) * GAP_SIZE + GRID_PADDING * 2;

      // Calculate scale to fill available width with minimal padding
      const newScale = availableWidth / gridNaturalWidth;

      // Clamp to min/max
      const clampedScale = Math.max(GRID_SCALE_MIN, Math.min(GRID_SCALE_MAX, newScale));

      gridLogger.trace('Auto-scale calculation', {
        containerWidth,
        availableWidth,
        gridNaturalWidth,
        calculatedScale: newScale,
        clampedScale
      });

      setCalculatedScale(clampedScale);
    };

    calculateAutoScale();

    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(calculateAutoScale);
    resizeObserver.observe(gridContainerRef.current);

    return () => resizeObserver.disconnect();
  }, [autoScale, selectedWeapon, cellSize, GAP_SIZE, GRID_PADDING, GRID_SCALE_MIN, GRID_SCALE_MAX]);

  // Attach touch event handlers directly to DOM (bypassing React synthetic events)
  // CRITICAL: Attach immediately when refs become available
  useEffect(() => {
    const inventoryContainer = inventoryContainerRef.current;
    const grid = gridRef.current;

    touchLogger.trace('Setting up NATIVE touch event listeners', {
      hasInventory: !!inventoryContainer,
      hasGrid: !!grid,
      hasEngravings: engravings.length > 0
    });

    if (!inventoryContainer || !grid || engravings.length === 0) {
      touchLogger.trace('Refs not ready yet, skipping listener setup');
      return;
    }

    // Handle touchstart on inventory pieces
    const handleInventoryTouchStart = (e) => {
      const slot = e.target.closest('[data-draggable-piece][data-inventory-index]');
      if (!slot) return;

      const index = parseInt(slot.getAttribute('data-inventory-index'));
      const piece = inventory[index];

      touchLogger.trace('NATIVE touchstart on inventory slot', index, 'piece:', piece?.shape?.name);

      if (piece && !lockedInventoryIndices.includes(index)) {
        handleTouchStart(e, piece, index);
      }
    };

    // Handle touchmove - prevent scrolling
    const handleTouchMovePrevent = (e) => {
      if (touchDragging) {
        touchLogger.trace('NATIVE touchmove - preventing default');
        e.preventDefault();
        handleTouchMove(e);
      }
    };

    // Handle touchend
    const handleTouchEndNative = (e) => {
      if (touchDragging) {
        touchLogger.trace('NATIVE touchend');
        handleTouchEnd(e);
      }
    };

    touchLogger.trace('Attaching NATIVE touch listeners');

    // Use { passive: false } to allow preventDefault
    inventoryContainer.addEventListener('touchstart', handleInventoryTouchStart, { passive: false });
    inventoryContainer.addEventListener('touchmove', handleTouchMovePrevent, { passive: false });
    inventoryContainer.addEventListener('touchend', handleTouchEndNative, { passive: false });

    grid.addEventListener('touchmove', handleTouchMovePrevent, { passive: false });
    grid.addEventListener('touchend', handleTouchEndNative, { passive: false });

    return () => {
      touchLogger.trace('Cleaning up NATIVE touch event listeners');
      inventoryContainer.removeEventListener('touchstart', handleInventoryTouchStart);
      inventoryContainer.removeEventListener('touchmove', handleTouchMovePrevent);
      inventoryContainer.removeEventListener('touchend', handleTouchEndNative);
      grid.removeEventListener('touchmove', handleTouchMovePrevent);
      grid.removeEventListener('touchend', handleTouchEndNative);
    };
  }, [selectedWeapon, inventory, lockedInventoryIndices, touchDragging, engravings]); // Re-run when these change

  // Prevent body scrolling during touch drag
  useEffect(() => {
    if (touchDragging) {
      // Prevent scrolling on the entire page during touch drag
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      // Restore scrolling
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [touchDragging]);

  // Debug: Track gridState changes to investigate socketing issue
  useEffect(() => {
    gridLogger.trace('GridState Changed');
    gridLogger.trace('Grid dimensions', { rows: gridState.length, cols: gridState[0]?.length });

    // Find all placed pieces
    const placedPieces = [];
    gridState.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell.piece && cell.piece.anchorRow === rowIndex && cell.piece.anchorCol === colIndex) {
          placedPieces.push({
            anchor: [rowIndex, colIndex],
            shapeId: cell.piece.shapeId,
            rarity: cell.piece.rarity,
            rotation: cell.piece.rotation || 0,
            pattern: cell.piece.shape?.pattern
          });
        }
      });
    });

    gridLogger.trace('Placed pieces found', { count: placedPieces.length });
    placedPieces.forEach((piece, idx) => {
      gridLogger.trace(`Piece ${idx + 1}`, { piece });
    });
    
  }, [gridState]);

  // Cleanup document touch listeners on unmount
  useEffect(() => {
    return () => {
      // Clean up any remaining document listeners when component unmounts
      if (touchCleanupRef.current) {
        touchCleanupRef.current();
        touchCleanupRef.current = null;
      }
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load wiki config
      const configResponse = await fetch('/wiki-config.json');
      const configData = await configResponse.json();
      setWikiConfig(configData);

      // Load ALL weapons (from soul-weapons.json)
      const allWeaponsResponse = await fetch('/data/soul-weapons.json');
      const allWeaponsData = await allWeaponsResponse.json();

      // Load weapon grids (only weapons with grid data)
      const weaponsResponse = await fetch('/data/soul-weapon-grids.json');
      const weaponsData = await weaponsResponse.json();

      // Load engraving pieces
      const engravingsResponse = await fetch('/data/soul-weapon-engravings.json');
      const engravingsData = await engravingsResponse.json();

      // Filter allWeapons to only include weapons from first grid weapon onward
      // Weapons before first grid entry don't have grid layouts (can't use engravings)
      let filteredAllWeapons = allWeaponsData || [];
      if (weaponsData.weapons && weaponsData.weapons.length > 0) {
        const minWeaponId = weaponsData.weapons[0].id;

        logger.trace('Filtering weapons', {
          totalWeapons: allWeaponsData.length,
          minWeaponId: minWeaponId,
          firstGridWeapon: weaponsData.weapons[0].name
        });

        // Only include weapons with id >= first grid weapon id
        filteredAllWeapons = allWeaponsData.filter(w => w.id >= minWeaponId);

        logger.trace('Filtered weapons', {
          filtered: filteredAllWeapons.length,
          showing: `${weaponsData.weapons[0].name} (ID ${minWeaponId}) and onwards`
        });
      }

      setAllWeapons(filteredAllWeapons);
      setWeapons(weaponsData.weapons || []);
      setEngravings(engravingsData.shapes || []);

      // Set first weapon as default if none selected
      // Prefer weapons WITH grid data, but show ALL weapons (after filtering)
      if (!selectedWeapon && filteredAllWeapons?.length > 0) {
        // Try to find first weapon with grid data
        const firstWeaponWithGrid = filteredAllWeapons.find(w =>
          weaponsData.weapons.some(gw => gw.name === w.name)
        );

        if (firstWeaponWithGrid) {
          // Use the grid data version of this weapon, merged with base weapon data
          const gridWeapon = weaponsData.weapons.find(gw => gw.name === firstWeaponWithGrid.name);
          setSelectedWeapon({
            ...gridWeapon,
            image: firstWeaponWithGrid.image,
            attack: firstWeaponWithGrid.attack,
            requirements: firstWeaponWithGrid.requirements
          });
        } else {
          // No weapons have grid data yet, select first weapon (will show designer)
          setSelectedWeapon(filteredAllWeapons[0]);
        }
      }

      // Try to load draft
      const draft = loadDraft();
      if (draft && !initialBuild) {
        logger.debug('Loading draft from localStorage');

        setBuildName(draft.buildName || '');

        if (draft.selectedWeapon) {
          // Mark this weapon as already initialized BEFORE setting it
          // This prevents the weapon change effect from re-initializing the grid
          const weaponKey = `${draft.selectedWeapon.id}-${draft.selectedWeapon.name}`;
          hasInitializedGridForWeapon.current = weaponKey;
          setSelectedWeapon(draft.selectedWeapon);
        }

        // Deserialize gridState: Reconstruct pieces with full shape data
        if (draft.gridState) {
          const deserializedGridState = draft.gridState.map(row =>
            row.map(cell => ({
              active: cell.active,
              piece: cell.piece ? {
                ...cell.piece,
                shape: engravingsData.shapes.find(e => e.id === cell.piece.shapeId)
              } : null
            }))
          );
          setGridState(deserializedGridState);
        }

        // Deserialize inventory: Reconstruct pieces with full shape data
        if (draft.inventory) {
          const deserializedInventory = draft.inventory.map(item => item ? {
            ...item,
            shape: engravingsData.shapes.find(e => e.id === item.shapeId)
          } : null);
          setInventory(deserializedInventory);
        }

        // Load highest unlocked weapon
        if (draft.highestUnlockedWeapon !== undefined) {
          setHighestUnlockedWeapon(draft.highestUnlockedWeapon);
        }

        // Restore designer mode states
        if (draft.isGridDesigner !== undefined) {
          setIsGridDesigner(draft.isGridDesigner);
        }
        if (draft.forceDesignMode !== undefined) {
          setForceDesignMode(draft.forceDesignMode);
        }
        if (draft.designerGrid) {
          setDesignerGrid(draft.designerGrid);
        }
        if (draft.gridType) {
          logger.debug('Draft loading - Setting gridType from draft', { gridType: draft.gridType });
          setGridType(draft.gridType);
        }
        if (draft.completionAtk !== undefined) {
          setCompletionAtk(draft.completionAtk);
        }
        if (draft.completionHp !== undefined) {
          setCompletionHp(draft.completionHp);
        }

        logger.debug('Draft loaded and deserialized - Designer state', {
          isGridDesigner: draft.isGridDesigner,
          gridType: draft.gridType,
          designerGridSize: draft.designerGrid ? `${draft.designerGrid.length}x${draft.designerGrid[0]?.length || 0}` : 'none'
        });
      }

    } catch (error) {
      logger.error('Failed to load soul weapon engraving data', { error });
    } finally {
      setLoading(false);
    }
  };

  // Check if selectedWeapon has grid data
  const weaponHasGridData = () => {
    if (!selectedWeapon) return false;
    // Check if weapon has activeSlots array (indicates it has grid data)
    return selectedWeapon.activeSlots && Array.isArray(selectedWeapon.activeSlots);
  };

  // Get grid data for any weapon (from official data or community submissions)
  // Returns: { gridType, activeSlots, hasData, source, submittedBy } or null if no data available
  const getWeaponGridData = async (weapon) => {
    // First check if weapon has official grid data
    if (weapon.activeSlots && Array.isArray(weapon.activeSlots)) {
      return {
        gridType: weapon.gridType,
        activeSlots: weapon.activeSlots,
        completionEffect: weapon.completionEffect,
        hasData: true,
        source: 'official'
      };
    }

    // If not, check for community submissions (read from comments)
    if (!wikiConfig) return null;

    try {
      const owner = wikiConfig.wiki.repository.owner;
      const repo = wikiConfig.wiki.repository.repo;

      // Get authenticated Octokit instance (uses user token if logged in)
      const octokit = getOctokit();

      // Search for OPEN issue with this weapon's label - closed issues are considered deleted
      const weaponLabel = createWeaponLabel(weapon.name);
      const { data } = await retryGitHubAPI(
        async () => await octokit.rest.search.issuesAndPullRequests({
          q: `repo:${owner}/${repo} label:soul-weapon-grids label:"${weaponLabel}" is:open`,
          per_page: 1,
        })
      );

      const issues = data.items || [];

      if (issues.length > 0) {
        const issue = issues[0];

        // Fetch first comment (primary submission) using authenticated Octokit with retry
        const { data: comments } = await retryGitHubAPI(
          async () => await octokit.rest.issues.listComments({
            owner,
            repo,
            issue_number: issue.number,
            per_page: 1,
          })
        );

        if (comments.length > 0) {
          // Parse JSON from first comment
          const jsonMatch = comments[0].body.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            const submission = JSON.parse(jsonMatch[1]);
            return {
              gridType: submission.gridType,
              activeSlots: submission.activeSlots,
              completionEffect: submission.completionEffect,
              hasData: true,
              source: 'community',
              submittedBy: submission.submittedBy
            };
          }
        }
      }

      return null; // No data found
    } catch (error) {
      logger.error(`Failed to fetch community data for ${weapon.name}`, { error });
      return null;
    }
  };


  // Initialize grid (either normal grid or designer grid)
  const initializeGrid = async () => {
    if (!selectedWeapon) return;

    const hasGridData = weaponHasGridData();

    // Clear submission metadata and errors when weapon changes
    setCurrentSubmissionMeta(null);
    setSubmissionLoadError(null);

    if (!hasGridData) {
      // Reset design mode state when weapon changes
      setForceDesignMode(false);

      // Weapon doesn't have grid data - check for submissions
      await loadExistingSubmissions();

      // This will be updated after submissions load
      // The effect hook will handle showing normal vs design mode
    } else {
      // Weapon has grid data - normal builder mode
      setIsGridDesigner(false);
      setForceDesignMode(false);

      const gridSize = selectedWeapon.gridType === '4x4' ? 4 : 5;
      const grid = Array(gridSize).fill(null).map(() =>
        Array(gridSize).fill(null).map(() => ({
          active: false,
          piece: null
        }))
      );

      // Mark active slots from weapon data
      selectedWeapon.activeSlots.forEach(slot => {
        if (slot.row < gridSize && slot.col < gridSize) {
          grid[slot.row][slot.col].active = true;
        }
      });

      setGridState(grid);
      setPlacingPiece(null);
      setPlacingPosition(null);
    }
  };

  // Initialize designer grid with all cells inactive
  const initializeDesignerGrid = (newGridType) => {
    // Use provided gridType or fall back to state
    const typeToUse = newGridType || gridType;
    const size = typeToUse === '4x4' ? 4 : 5;
    const grid = Array(size).fill(null).map(() =>
      Array(size).fill(null).map(() => ({ active: false }))
    );
    setDesignerGrid(grid);
  };

  // Load all weapons with submissions (for dropdown display)
  const loadAllWeaponsWithSubmissions = async () => {
    if (!wikiConfig) return;

    const owner = wikiConfig.wiki.repository.owner;
    const repo = wikiConfig.wiki.repository.repo;

    try {
      // Search for OPEN issues only - closed issues are considered deleted
      const issues = await searchGitHubIssues(owner, repo, 'label:soul-weapon-grids is:open');

      const weaponNames = new Set();

      // Each issue represents a weapon with submissions
      // Extract weapon ID from the weapon-id:X label and map to weapon name
      // Only track weapons that DON'T have official grid data
      for (const issue of issues) {
        // Find the weapon-id: label
        const weaponLabel = issue.labels.find(label => {
          const labelName = typeof label === 'string' ? label : label.name;
          return labelName && labelName.startsWith('weapon-id:');
        });

        if (weaponLabel) {
          const labelName = typeof weaponLabel === 'string' ? weaponLabel : weaponLabel.name;
          const weaponId = parseInt(labelName.replace('weapon-id:', ''), 10);

          // Find the weapon by ID to get its name
          const weapon = allWeapons.find(w => w.id === weaponId);
          if (weapon) {
            // Only include if weapon doesn't have official grid data
            const hasOfficialData = weapons.find(gw => gw.name === weapon.name);
            if (!hasOfficialData) {
              weaponNames.add(weapon.name);
              gridLogger.trace(`📋 Found community submission for weapon ID ${weaponId}: ${weapon.name} (no official data)`);
            } else {
              gridLogger.trace(`📋 Skipping weapon ID ${weaponId}: ${weapon.name} (has official data)`);
            }
          }
        }
      }

      setWeaponsWithSubmissions(weaponNames);
      logger.debug(`Found community submissions for ${weaponNames.size} weapons without official data`, { weapons: Array.from(weaponNames) });
    } catch (error) {
      logger.error('Failed to load weapons with submissions', { error });
    }
  };

  // Load existing submissions from GitHub issues (reads from comments)
  const loadExistingSubmissions = async (forceRefresh = false) => {
    logger.debug('loadExistingSubmissions called', {
      forceRefresh,
      hasSelectedWeapon: !!selectedWeapon,
      selectedWeaponId: selectedWeapon?.id,
      hasWikiConfig: !!wikiConfig
    });

    if (!selectedWeapon || !wikiConfig) {
      logger.warn('Early return - missing selectedWeapon or wikiConfig');
      return [];
    }

    const owner = wikiConfig.wiki.repository.owner;
    const repo = wikiConfig.wiki.repository.repo;
    const weaponName = selectedWeapon.name;

    // Clean expired cache entries
    cleanExpiredCache();

    // Check cache first (10 minute TTL)
    // BUT: If cache has 0 submissions, always re-check (maybe a new submission was added)
    if (!forceRefresh) {
      const cache = getSubmissionCache();
      const cached = cache[weaponName];
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        if (cached.submissions.length > 0) {
          gridLogger.trace(`[SoulWeaponEngravingBuilder] Using cached submissions for ${weaponName} (expires in ${Math.round((CACHE_TTL - (Date.now() - cached.timestamp)) / 1000 / 60)} minutes)`);
          setExistingSubmissions(cached.submissions);
          return cached.submissions;
        } else {
          gridLogger.trace(`[SoulWeaponEngravingBuilder] Cache has 0 submissions for ${weaponName} - bypassing cache to check for new submissions`);
        }
      }
    }

    setLoadingSubmissions(true);
    setSubmissionLoadError(null); // Clear any previous errors

    try {
      // Get authenticated Octokit instance (uses user token if logged in)
      const octokit = getOctokit();

      // Search for OPEN issues only - closed issues are considered deleted
      const weaponLabel = createWeaponIdLabel(selectedWeapon.id);
      const searchQuery = `repo:${owner}/${repo} label:soul-weapon-grids label:"${weaponLabel}" is:open`;

      gridLogger.trace(`[SoulWeaponEngravingBuilder] Searching for grid submissions with query:`, searchQuery);

      let issues = [];

      try {
        // Search using authenticated Octokit with retry on rate limit
        const { data } = await retryGitHubAPI(
          async () => await octokit.rest.search.issuesAndPullRequests({
            q: searchQuery,
            per_page: 10,
          }),
          (attempt, delay) => {
            gridLogger.trace(`[SoulWeaponEngravingBuilder] Search retry ${attempt}/3 - waiting ${Math.round(delay / 1000)}s due to rate limit`);
          }
        );

        gridLogger.trace(`[SoulWeaponEngravingBuilder] Raw search response:`, {
          total_count: data.total_count,
          incomplete_results: data.incomplete_results,
          items: data.items || []
        });

        issues = data.items || [];

        if (issues.length === 0) {
          logger.warn(`Search returned 0 results. Checking if GitHub search index is stale`);

          // Try listing all grid issues to see if it exists but isn't indexed
          try {
            const { data: allIssues } = await octokit.rest.issues.listForRepo({
              owner,
              repo,
              labels: 'soul-weapon-grids',
              state: 'open',
              per_page: 100,
            });

            logger.debug(`Found ${allIssues.length} total grid issues via list API`,
              allIssues.map(i => ({
                number: i.number,
                title: i.title,
                labels: i.labels.map(l => l.name),
                hasWeaponId: i.labels.some(l => l.name === weaponLabel)
              }))
            );

            // Check if our issue exists but wasn't found by search
            const foundViaList = allIssues.find(i =>
              i.labels.some(l => l.name === weaponLabel)
            );

            if (foundViaList) {
              logger.warn(`Issue found via list API but NOT via search API. GitHub search index is stale`);
              issues = [foundViaList];
            }
          } catch (listErr) {
            logger.error('Fallback list failed:', listErr);
          }
        } else {
          logger.debug(`Search found ${issues.length} issue(s)`, { issues: issues.map(i => ({ number: i.number, title: i.title, labels: i.labels.map(l => l.name) })) });
        }
      } catch (searchError) {
        logger.error('Search failed after retries:', searchError);
        const errorMsg = searchError.status === 403
          ? 'GitHub API rate limit exceeded. Please try again later or sign in for higher rate limits.'
          : `Failed to search for submissions: ${searchError.message}`;
        setSubmissionLoadError(errorMsg);
        setExistingSubmissions([]);
        setLoadingSubmissions(false);
        return [];
      }

      const weaponSubmissions = [];

      // Should only be one issue per weapon
      if (issues.length > 0) {
        const issue = issues[0];

        // Fetch comments on this issue using authenticated Octokit with retry
        let comments = [];

        try {
          const { data } = await retryGitHubAPI(
            async () => await octokit.rest.issues.listComments({
              owner,
              repo,
              issue_number: issue.number,
              per_page: 100,
            }),
            (attempt, delay) => {
              gridLogger.trace(`[SoulWeaponEngravingBuilder] Comments retry ${attempt}/3 - waiting ${Math.round(delay / 1000)}s due to rate limit`);
            }
          );

          comments = data;
        } catch (commentsError) {
          logger.error('Comments fetch failed after retries:', commentsError);
          const errorMsg = commentsError.status === 403
            ? 'GitHub API rate limit exceeded. Please try again later or sign in for higher rate limits.'
            : `Failed to load submission data: ${commentsError.message}`;
          setSubmissionLoadError(errorMsg);
          setExistingSubmissions([]);
          setLoadingSubmissions(false);
          return [];
        }

        if (comments.length > 0) {

          // Parse each comment for JSON submission data
          for (const comment of comments) {
            try {
              // Try to parse comment body as JSON directly (GitHubStorage stores plain JSON)
              const submission = JSON.parse(comment.body);
              weaponSubmissions.push({
                ...submission,
                issueNumber: issue.number,
                commentId: comment.id,
                // Submission already has submittedBy and submittedAt from JSON
              });
            } catch (err) {
              logger.warn('Failed to parse submission from comment', { commentId: comment.id, error: err });
            }
          }
        }
      }

      setExistingSubmissions(weaponSubmissions);

      // Cache the submissions in localStorage
      setSubmissionCache(weaponName, weaponSubmissions);

      gridLogger.trace(`[SoulWeaponEngravingBuilder] Loaded ${weaponSubmissions.length} submission(s) for ${weaponName}`);

      // Note: Don't load submissions here - the useEffect hook will handle it
      // based on forceDesignMode state

      return weaponSubmissions;
    } catch (error) {
      logger.error('Failed to load existing submissions', { error });
      setSubmissionLoadError(`Failed to load submissions: ${error.message}`);
      setExistingSubmissions([]);
      return [];
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Load a submission into the designer grid
  const loadSubmissionIntoDesigner = (submission) => {
    if (!submission) return;

    logger.debug('loadSubmissionIntoDesigner - Loading submission', {
      gridType: submission.gridType,
      activeSlots: submission.totalActiveSlots,
      completionEffect: submission.completionEffect
    });

    setGridType(submission.gridType);
    // Convert float values to strings with % for display in input fields
    setCompletionAtk(typeof submission.completionEffect.atk === 'number' ? `${submission.completionEffect.atk}%` : submission.completionEffect.atk);
    setCompletionHp(typeof submission.completionEffect.hp === 'number' ? `${submission.completionEffect.hp}%` : submission.completionEffect.hp);

    // Initialize grid from submission
    const size = submission.gridType === '4x4' ? 4 : 5;
    const grid = Array(size).fill(null).map(() =>
      Array(size).fill(null).map(() => ({ active: false }))
    );

    // Mark active slots
    submission.activeSlots.forEach(slot => {
      if (slot.row < size && slot.col < size) {
        grid[slot.row][slot.col].active = true;
      }
    });

    setDesignerGrid(grid);
  };

  // Load a submission into normal grid mode (as if it were official weapon data)
  const loadSubmissionIntoNormalGrid = (submission) => {
    if (!submission) return;

    logger.debug('Loading submission into normal grid', {
      gridType: submission.gridType,
      totalActiveSlots: submission.totalActiveSlots,
      activeSlots: submission.activeSlots,
      completionEffect: submission.completionEffect,
      fullSubmission: submission
    });

    // Store submission metadata separately (don't update selectedWeapon to prevent loop)
    const submissionMeta = {
      gridType: submission.gridType,
      activeSlots: submission.activeSlots,
      completionEffect: submission.completionEffect,
      submittedBy: submission.submittedBy || 'Anonymous',
      submittedAt: submission.submittedAt
    };
    logger.debug('Setting currentSubmissionMeta', { submissionMeta });
    setCurrentSubmissionMeta(submissionMeta);

    // Initialize normal grid from submission
    const gridSize = submission.gridType === '4x4' ? 4 : 5;
    const grid = Array(gridSize).fill(null).map(() =>
      Array(gridSize).fill(null).map(() => ({
        active: false,
        piece: null
      }))
    );

    // Mark active slots
    submission.activeSlots.forEach(slot => {
      if (slot.row < gridSize && slot.col < gridSize) {
        grid[slot.row][slot.col].active = true;
      }
    });

    logger.debug('Grid initialized', { size: `${gridSize}x${gridSize}` });
    logger.debug('Active cells marked', { count: submission.activeSlots.length });

    // Log the grid state to verify active cells are in correct positions
    const activePositions = [];
    grid.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell.active) {
          activePositions.push(`(${rIdx},${cIdx})`);
        }
      });
    });
    logger.debug('Active cell positions in grid', { positions: activePositions.join(', ') });

    setGridState(grid);
    setPlacingPiece(null);
    setPlacingPosition(null);
  };

  // Toggle a cell in the designer grid
  const toggleDesignerCell = (row, col) => {
    const newGrid = designerGrid.map((r, rIdx) =>
      r.map((cell, cIdx) => {
        if (rIdx === row && cIdx === col) {
          return { ...cell, active: !cell.active };
        }
        return cell;
      })
    );
    setDesignerGrid(newGrid);
  };

  // Submit grid layout to GitHub via Netlify function
  const submitGridLayout = async (replace = false) => {
    if (!selectedWeapon || !wikiConfig) {
      alert('Cannot submit grid layout: missing configuration.');
      return;
    }

    // Validate inputs
    const atkValidation = validateCompletionEffect(completionAtk, 'ATK completion effect');
    const hpValidation = validateCompletionEffect(completionHp, 'HP completion effect');

    if (!atkValidation.valid) {
      alert(`Invalid ATK value: ${atkValidation.error}`);
      return;
    }

    if (!hpValidation.valid) {
      alert(`Invalid HP value: ${hpValidation.error}`);
      return;
    }

    // Count active slots
    const activeSlots = [];
    designerGrid.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell.active) {
          activeSlots.push({ row: rIdx, col: cIdx });
        }
      });
    });

    if (activeSlots.length === 0) {
      alert('Please select at least one active cell.');
      return;
    }

    setSubmitting(true);
    try {
      // Log state values at submission time
      logger.debug('submitGridLayout - State values at submission', {
        gridType: gridType,
        completionAtk: completionAtk,
        completionHp: completionHp,
        activeSlots: activeSlots.length,
        designerGridSize: `${designerGrid.length}x${designerGrid[0]?.length || 0}`
      });

      // Create submission data using validated values
      const submission = {
        weaponId: String(selectedWeapon.id), // Ensure ID is a string
        weaponName: selectedWeapon.name,
        gridType: gridType,
        completionEffect: {
          atk: atkValidation.sanitized, // Use validated numeric value
          hp: hpValidation.sanitized    // Use validated numeric value
        },
        activeSlots: activeSlots,
        totalActiveSlots: activeSlots.length
      };

      logger.debug('submitGridLayout - Final submission object', { submission });

      // Call save-data function with type 'grid-submission'
      // Authenticated users will have their username attached, otherwise anonymous
      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'grid-submission',
          username: isAuthenticated ? user.login : null,
          userId: isAuthenticated ? user.id : 0,
          data: submission,
          replace,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit grid layout');
      }

      // Show success message based on action
      if (result.action === 'replaced') {
        alert('Grid layout updated! Your submission is now the primary layout.');
      } else if (result.action === 'added') {
        alert('Grid layout submitted! Note: A layout already exists for this weapon.');
      } else {
        alert('Grid layout submitted successfully!');
      }

      logger.info('Grid submission successful');

      // Exit designer mode immediately
      setIsGridDesigner(false);
      setForceDesignMode(false);

      // Immediately load the submitted grid data (without waiting for GitHub to index)
      const immediateSubmissionData = {
        gridType: submission.gridType,
        activeSlots: submission.activeSlots,
        totalActiveSlots: submission.totalActiveSlots,
        completionEffect: submission.completionEffect,
        submittedBy: isAuthenticated ? user.login : 'Anonymous',
        submittedAt: new Date().toISOString()
      };
      logger.debug('Loading submitted grid immediately', { immediateSubmissionData });
      loadSubmissionIntoNormalGrid(immediateSubmissionData);

      // Invalidate cache for background refresh
      invalidateSubmissionCache(selectedWeapon.name);

      // Wait 1.5 seconds, then refresh from GitHub to get the actual stored version
      setTimeout(async () => {
        try {
          logger.debug('Refreshing submission data from GitHub');

          // Reload all weapons with submissions to update dropdown
          await loadAllWeaponsWithSubmissions();

          // Force refresh submissions from GitHub
          const updatedSubmissions = await loadExistingSubmissions(true);
          logger.debug('Refreshed submissions from GitHub', { count: updatedSubmissions.length });

          // If we got fresh data, reload it into the grid
          if (updatedSubmissions.length > 0) {
            logger.debug('Reloading first submission with fresh data from GitHub');
            loadSubmissionIntoNormalGrid(updatedSubmissions[0]);
          }
        } catch (error) {
          logger.error('Failed to refresh from GitHub', { error });
          // Not fatal - user already has the submitted grid loaded
        }
      }, 1500);
    } catch (error) {
      logger.error('Failed to submit grid layout', { error });
      alert(`Failed to submit grid layout: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate natural cell size by loading a piece image
  const calculateNaturalCellSize = async () => {
    try {
      // Use the square piece (id: 4) which is 2x2 pattern - easiest to calculate from
      const squareShape = engravings.find(s => s.id === 4);
      if (!squareShape) return;

      // Load the image to get its natural dimensions
      const img = new Image();
      const imageUrl = `/images/equipment/soul-weapons/SoulGem_0_4.png`; // Common rarity square

      await new Promise((resolve, reject) => {
        img.onload = () => {
          // Square piece is 2x2, so divide image width by 2 to get cell size
          const naturalCellSize = Math.floor(img.naturalWidth / squareShape.pattern[0].length);
          setCellSize(naturalCellSize);
          gridLogger.debug(`Calculated natural cell size: ${naturalCellSize}px from image ${img.naturalWidth}x${img.naturalHeight}`);
          resolve();
        };
        img.onerror = reject;
        img.src = imageUrl;
      });
    } catch (error) {
      gridLogger.error('Failed to calculate natural cell size, using default 45px', { error });
      setCellSize(45);
    }
  };

  // Get natural size of a piece image (loads and caches)
  const getImageNaturalSize = async (rarity, shapeId, pattern) => {
    const cacheKey = `${rarity}_${shapeId}`;

    if (imageSizesCache[cacheKey]) {
      return imageSizesCache[cacheKey];
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const size = {
          width: img.naturalWidth,
          height: img.naturalHeight
        };

        // Cache the result
        setImageSizesCache(prev => ({
          ...prev,
          [cacheKey]: size
        }));

        resolve(size);
      };
      img.onerror = () => {
        // Fallback: calculate based on pattern and cell size
        const fallbackSize = getPieceImageSizeFallback(pattern);
        resolve(fallbackSize);
      };
      img.src = `/images/equipment/soul-weapons/SoulGem_${rarity}_${shapeId}.png`;
    });
  };

  // Update which inventory pieces are locked (placed on grid)
  const updateLockedInventoryIndices = () => {
    const locked = [];

    // Check each inventory slot
    inventory.forEach((invPiece, invIndex) => {
      if (!invPiece) return;

      // Check if this piece is placed on the grid by looking for inventoryIndex match
      const isPlaced = gridState.some(row =>
        row.some(cell =>
          cell.piece &&
          cell.piece.inventoryIndex === invIndex
        )
      );

      if (isPlaced) {
        locked.push(invIndex);
      }
    });

    gridLogger.trace('Locked inventory indices', { locked, inventory: inventory.map((p, i) => p ? `${i}: ${p.shapeId}` : `${i}: empty`) });
    setLockedInventoryIndices(locked);
  };

  // ===== SAVED BUILDS FUNCTIONS =====

  /**
   * Serialize build for storage (reduce size by storing only IDs)
   */
  const serializeBuild = (buildToSerialize) => {
    return {
      name: buildToSerialize.name || buildName,
      weaponId: buildToSerialize.weaponId !== undefined ? buildToSerialize.weaponId : selectedWeapon?.id,
      weaponName: buildToSerialize.weaponName !== undefined ? buildToSerialize.weaponName : selectedWeapon?.name,
      gridState: buildToSerialize.gridState ? buildToSerialize.gridState.map(row =>
        row.map(cell => ({
          active: cell.active,
          piece: cell.piece ? {
            shapeId: cell.piece.shapeId !== undefined ? cell.piece.shapeId : cell.piece.shape?.id,
            rarity: cell.piece.rarity,
            level: cell.piece.level,
            rotation: cell.piece.rotation
          } : null
        }))
      ) : gridState.map(row =>
        row.map(cell => ({
          active: cell.active,
          piece: cell.piece ? {
            shapeId: cell.piece.shapeId !== undefined ? cell.piece.shapeId : cell.piece.shape?.id,
            rarity: cell.piece.rarity,
            level: cell.piece.level,
            rotation: cell.piece.rotation
          } : null
        }))
      ),
      inventory: buildToSerialize.inventory ? buildToSerialize.inventory.map(piece =>
        piece ? {
          shapeId: piece.shapeId !== undefined ? piece.shapeId : piece.shape?.id,
          rarity: piece.rarity,
          level: piece.level
        } : null
      ) : inventory.map(piece =>
        piece ? {
          shapeId: piece.shapeId !== undefined ? piece.shapeId : piece.shape?.id,
          rarity: piece.rarity,
          level: piece.level
        } : null
      )
    };
  };

  /**
   * Deserialize build after loading (restore full shape objects from IDs)
   */
  const deserializeBuild = (serializedBuild) => {
    return {
      weaponId: serializedBuild.weaponId,
      weaponName: serializedBuild.weaponName,
      gridState: serializedBuild.gridState.map(row =>
        row.map(cell => ({
          active: cell.active,
          piece: cell.piece ? {
            shape: engravings.find(e => e.id === cell.piece.shapeId),
            shapeId: cell.piece.shapeId,
            rarity: cell.piece.rarity,
            level: cell.piece.level,
            rotation: cell.piece.rotation
          } : null
        }))
      ),
      inventory: serializedBuild.inventory.map(piece =>
        piece ? {
          shape: engravings.find(e => e.id === piece.shapeId),
          shapeId: piece.shapeId,
          rarity: piece.rarity,
          level: piece.level
        } : null
      )
    };
  };

  /**
   * Check if current build matches a saved build
   */
  const buildsMatch = (savedBuild) => {
    if (!savedBuild) return false;

    // Check name and weapon
    if (savedBuild.name !== buildName) return false;
    if (savedBuild.weaponId !== selectedWeapon?.id) return false;

    // Serialize both for consistent comparison
    const currentSerialized = serializeBuild({ name: buildName });
    const savedSerialized = serializeBuild(savedBuild);

    // Compare grid states
    if (JSON.stringify(currentSerialized.gridState) !== JSON.stringify(savedSerialized.gridState)) return false;
    if (JSON.stringify(currentSerialized.inventory) !== JSON.stringify(savedSerialized.inventory)) return false;

    return true;
  };

  /**
   * Load a saved build
   */
  const handleLoadBuild = (savedBuild) => {
    // Check if there are actual meaningful changes
    const hasActualChanges = hasUnsavedChanges && (
      buildName.trim() !== '' ||
      gridState.some(row => row.some(cell => cell.piece !== null)) ||
      inventory.some(piece => piece !== null)
    );

    // Check for unsaved changes before loading
    if (hasActualChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Loading this build will discard your current changes. Continue?'
      );
      if (!confirmed) return;
    }

    // Find the weapon
    const weapon = allWeapons.find(w => w.id === savedBuild.weaponId);
    if (!weapon) {
      alert('Weapon not found for this build');
      return;
    }

    // Deserialize build
    const deserialized = deserializeBuild(savedBuild);

    // Mark this weapon as already initialized BEFORE setting it
    const weaponKey = `${weapon.id}-${weapon.name}`;
    hasInitializedGridForWeapon.current = weaponKey;

    // Set build data
    setBuildName(savedBuild.name);
    setSelectedWeapon(weapon);
    setGridState(deserialized.gridState);
    setInventory(deserialized.inventory);
    setHasUnsavedChanges(false);
    setCurrentLoadedBuildId(savedBuild.id);

    // Update locked inventory indices
    updateLockedInventoryIndices(deserialized.inventory, deserialized.gridState);

    // Trigger donation prompt on successful load
    window.triggerDonationPrompt?.({
      messages: [
        "Loading up the classics! 🗃️",
        "This engraving was fire! 🔥",
        "Back to a proven winner! 🏆",
        "Ah yes, that perfect fit! 🧩",
      ]
    });
  };

  /**
   * Save current build to backend
   */
  const saveBuild = async () => {
    if (!user || !isAuthenticated) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Serialize build to only store IDs
      const serializedBuild = serializeBuild({ name: buildName });
      const buildData = {
        name: serializedBuild.name,
        weaponId: serializedBuild.weaponId,
        weaponName: serializedBuild.weaponName,
        gridState: serializedBuild.gridState,
        inventory: serializedBuild.inventory
      };

      const response = await fetch(getSaveDataEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'engraving-builds',
          username: user.login,
          userId: user.id,
          data: buildData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save build');
      }

      const data = await response.json();
      const sortedBuilds = data.builds.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setSavedBuilds(sortedBuilds);

      // Find the saved build ID
      const savedBuild = sortedBuilds.find(b => b.name === buildName);
      if (savedBuild) {
        setCurrentLoadedBuildId(savedBuild.id);
      }

      setSaveSuccess(true);
      setHasUnsavedChanges(false);

      // Cache the updated builds
      setCache('engraving_builds', user.id, sortedBuilds);

      // Clear localStorage draft after successful save
      clearDraft();

      // Hide success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      logger.error('Failed to save build', { error: err });
      setSaveError(err.message || 'Failed to save build');
    } finally {
      setSaving(false);
    }
  };

  const handleWeaponChange = (weaponId) => {
    logger.debug('Switching weapon', { weaponId });

    // First, find the weapon in allWeapons (basic weapon data with image)
    const baseWeapon = allWeapons.find(w => w.id === parseInt(weaponId));
    if (!baseWeapon) return;

    // Check if this weapon has grid data
    const gridWeapon = weapons.find(w => w.name === baseWeapon.name);

    if (gridWeapon) {
      // Weapon has grid data - normal mode
      logger.debug('Weapon has grid data, using normal mode');

      // Unsocket all pieces from current weapon (try to return to inventory)
      unsocketAllPieces();
      logger.debug('Unsocketed all pieces from previous weapon');

      // Merge grid data with base weapon data (to get image field)
      setSelectedWeapon({
        ...gridWeapon,
        image: baseWeapon.image,
        attack: baseWeapon.attack,
        requirements: baseWeapon.requirements
      });
      setForceDesignMode(false); // Ensure we exit design mode
    } else {
      // No grid data - Grid Designer Mode
      logger.debug('Weapon has NO grid data, will enter Grid Designer Mode');
      logger.debug('Force clearing grid and inventory for fresh start');

      // Force clear everything for Grid Designer Mode
      // Clear inventory completely (don't try to save pieces)
      setInventory(Array(INVENTORY_SIZE).fill(null));

      // Force clear grid state (this will be handled by the useEffect that initializes the grid)
      // But we need to ensure the weapon change triggers a fresh grid initialization

      setSelectedWeapon(baseWeapon);
      // Grid Designer Mode will be triggered by isGridDesigner computed value
    }

    setHasUnsavedChanges(true);
  };

  const handleLoadPreset = (presetId) => {
    const preset = INVENTORY_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    // Unsocket all pieces from grid (without returning to inventory)
    unsocketAllPieces();

    const newInventory = preset.pieces.map(pieceConfig => {
      const shape = engravings.find(e => e.id === pieceConfig.shapeId);
      if (!shape) return null;

      return {
        shapeId: shape.id,
        shape: shape,
        rarity: pieceConfig.rarity,
        level: pieceConfig.level
      };
    });

    setInventory(newInventory);
    setHasUnsavedChanges(true);
  };

  const handleChangePieceLevel = (slotIndex, newLevel) => {
    const clampedLevel = Math.max(MIN_PIECE_LEVEL, Math.min(MAX_PIECE_LEVEL, newLevel));
    const newInventory = [...inventory];
    if (newInventory[slotIndex]) {
      newInventory[slotIndex] = {
        ...newInventory[slotIndex],
        level: clampedLevel
      };
      setInventory(newInventory);
      setHasUnsavedChanges(true);
    }
  };

  const handleOpenLevelEditor = (slotIndex, currentLevel) => {
    setEditingLevelSlot(slotIndex);
    setLevelInputValue(currentLevel.toString());
  };

  const handleCloseLevelEditor = () => {
    setEditingLevelSlot(null);
    setLevelInputValue('');
  };

  const handleApplyLevel = () => {
    const newLevel = parseInt(levelInputValue);
    if (!isNaN(newLevel) && editingLevelSlot !== null) {
      handleChangePieceLevel(editingLevelSlot, newLevel);
    }
    handleCloseLevelEditor();
  };

  const handleOpenPieceSelector = (slotIndex) => {
    setSelectedSlotIndex(slotIndex);
    setSelectedShape(engravings[0]);
    setSelectedRarity(0);
    setSelectedLevel(1);
    setShowPieceSelector(true);
  };

  const handleCreateCustomPiece = () => {
    if (!selectedShape || selectedSlotIndex === null) return;

    const newInventory = [...inventory];
    newInventory[selectedSlotIndex] = {
      shapeId: selectedShape.id,
      shape: selectedShape,
      rarity: selectedRarity,
      level: selectedLevel
    };

    setInventory(newInventory);
    setShowPieceSelector(false);
    setHasUnsavedChanges(true);
  };

  const handleRemoveFromInventory = (slotIndex) => {
    gridLogger.trace('handleRemoveFromInventory called', { slotIndex });
    console.trace('Stack trace for remove call');

    const newInventory = [...inventory];
    newInventory[slotIndex] = null;
    setInventory(newInventory);
    setHasUnsavedChanges(true);

    // Only clear drag state if this piece was being dragged
    if (draggingIndex === slotIndex) {
      touchDraggingRef.current = false;
      draggingPieceRef.current = null;
      setTouchDragging(false);
      setDraggingPiece(null);
      setDraggingIndex(null);
      setTouchStartPos(null);
      setTouchCurrentPos(null);
      setPreviewPosition(null);
      setDragPreviewCells([]);

      // Clean up document touch listeners if they exist
      if (touchCleanupRef.current) {
        touchCleanupRef.current();
        touchCleanupRef.current = null;
      }
    }
  };

  // Drag handlers
  const handleDragStart = (e, piece, index) => {
    // Prevent dragging locked pieces
    if (lockedInventoryIndices.includes(index)) {
      e.preventDefault();
      return;
    }

    setDraggingPiece(piece);
    setDraggingIndex(index);
    setCurrentDragRotation(0); // Start at 0 rotation
    e.dataTransfer.effectAllowed = 'move';

    // Calculate which pattern cell was clicked (for inventory pieces, assume center)
    // For inventory pieces, we'll use the center of the first filled cell
    const pattern = piece.shape.pattern;
    let firstFilledRow = 0;
    let firstFilledCol = 0;

    // Find first filled cell in pattern
    outerLoop: for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        if (pattern[r][c] === 1) {
          firstFilledRow = r;
          firstFilledCol = c;
          break outerLoop;
        }
      }
    }

    setDragPatternOffset({ row: firstFilledRow, col: firstFilledCol });

    // Create custom drag image (just the piece image, no box)
    const img = new Image();
    img.src = `/images/equipment/soul-weapons/SoulGem_${piece.rarity}_${piece.shapeId}.png`;
    img.style.opacity = '0.7';

    // Set drag image at the center of the first filled cell
    const size = getPieceImageSizeFallback(pattern);
    const offsetX = (firstFilledCol + 0.5) * cellSize;
    const offsetY = (firstFilledRow + 0.5) * cellSize;

    e.dataTransfer.setDragImage(img, offsetX, offsetY);
  };

  const handleDragEnd = () => {
    gridLogger.trace('Drag ended - cleaning up (piece stays in inventory)');

    // IMPORTANT: When drag ends without being dropped on grid, the piece stays in inventory
    // We only clear visual drag state, we do NOT remove the piece from inventory

    // Clear all drag states
    setDraggingPiece(null);
    setDraggingIndex(null);
    setDraggingFromGrid(null);
    setPreviewPosition(null);
    setDragPreviewCells([]);
    setCurrentDragRotation(0);
    setDragPatternOffset({ row: 0, col: 0 });
  };

  const handleDragOver = (e, row, col) => {
    e.preventDefault();
    if (!draggingPiece) {
      gridLogger.trace('DragOver but no draggingPiece');
      return;
    }

    // Calculate anchor position: cursor cell - pattern offset
    // This makes the piece appear exactly where the user is dragging it
    const anchorRow = row - dragPatternOffset.row;
    const anchorCol = col - dragPatternOffset.col;
    gridLogger.trace(`DragOver [${row}][${col}] -> anchor [${anchorRow}][${anchorCol}]`);

    // Calculate which cells this piece would occupy from the anchor point
    const pattern = getRotatedPattern(draggingPiece.shape.pattern, currentDragRotation);
    const previewCells = [];

    for (let pRow = 0; pRow < pattern.length; pRow++) {
      for (let pCol = 0; pCol < pattern[pRow].length; pCol++) {
        if (pattern[pRow][pCol] === 1) {
          const gridRow = anchorRow + pRow;
          const gridCol = anchorCol + pCol;

          // Check if this cell is valid
          let valid = true;

          // Check bounds
          if (gridRow < 0 || gridCol < 0 || gridRow >= gridState.length || gridCol >= gridState[0].length) {
            valid = false;
          } else {
            // Check if slot is active
            if (!gridState[gridRow][gridCol].active) {
              valid = false;
            }
            // Check if slot is already occupied
            if (gridState[gridRow][gridCol].piece) {
              // Allow if this cell is occupied by the piece we're currently dragging
              if (draggingFromGrid &&
                  gridState[gridRow][gridCol].piece.anchorRow === draggingFromGrid.anchorRow &&
                  gridState[gridRow][gridCol].piece.anchorCol === draggingFromGrid.anchorCol) {
                // This cell belongs to the piece we're dragging, so it's okay
                valid = true;
              } else {
                valid = false;
              }
            }
          }

          previewCells.push({
            row: gridRow,
            col: gridCol,
            valid: valid
          });
        }
      }
    }

    setPreviewPosition({ row: anchorRow, col: anchorCol });
    setDragPreviewCells(previewCells);
  };

  const handleDrop = (e, row, col) => {
    e.preventDefault();
    if (!draggingPiece) return;

    // Calculate anchor position (same as dragOver)
    const anchorRow = row - dragPatternOffset.row;
    const anchorCol = col - dragPatternOffset.col;

    // Preserve the inventory index for later confirmation
    setPlacingInventoryIndex(draggingIndex);

    // Calculate initial button position based on CURRENT rotation (will stay fixed during further rotations)
    const currentPattern = getRotatedPattern(draggingPiece.shape.pattern, currentDragRotation);
    const buttonLeft = GRID_PADDING + anchorCol * (adjustedCellSize + GAP_SIZE);
    const buttonTop = GRID_PADDING + (anchorRow + currentPattern.length) * (adjustedCellSize + GAP_SIZE) + GRID_PADDING;
    setPlacingButtonPosition({ left: buttonLeft, top: buttonTop });

    // Always enter placement mode (even if invalid) - confirmation button will be disabled if invalid
    setPlacingPiece(draggingPiece);
    setPlacingPosition({ row: anchorRow, col: anchorCol });
    setPlacingRotation(currentDragRotation);

    setDraggingPiece(null);
    setDraggingIndex(null);
    setPreviewPosition(null);
    setDragPreviewCells([]);
    setCurrentDragRotation(0);
    setDragPatternOffset({ row: 0, col: 0 });
  };

  // ===== TOUCH EVENT HANDLERS FOR MOBILE =====

  // Helper function to get grid cell from touch coordinates
  const getTouchGridCell = (touch) => {
    if (!gridRef.current) return null;

    const gridRect = gridRef.current.getBoundingClientRect();
    const currentScale = autoScale ? calculatedScale : gridScale;

    touchLogger.trace('getTouchGridCell:', {
      touchX: touch.clientX,
      touchY: touch.clientY,
      gridLeft: gridRect.left,
      gridTop: gridRect.top,
      gridWidth: gridRect.width,
      gridHeight: gridRect.height,
      currentScale
    });

    // Calculate relative position within grid (accounting for scale)
    const relativeX = (touch.clientX - gridRect.left) / currentScale;
    const relativeY = (touch.clientY - gridRect.top) / currentScale;

    touchLogger.trace('Relative position:', { relativeX, relativeY, GRID_PADDING });

    // Account for grid padding
    const gridX = relativeX - GRID_PADDING;
    const gridY = relativeY - GRID_PADDING;

    // Calculate cell indices
    const cellTotalSize = adjustedCellSize + GAP_SIZE;
    const col = Math.floor(gridX / cellTotalSize);
    const row = Math.floor(gridY / cellTotalSize);

    touchLogger.trace('Cell calculation:', { gridX, gridY, cellTotalSize, row, col });

    // Check if within bounds
    // Use submission gridType if available (community submissions), otherwise use weapon gridType
    const effectiveGridType = currentSubmissionMeta?.gridType || selectedWeapon?.gridType || '5x5';
    const gridSize = effectiveGridType === '4x4' ? 4 : 5;
    if (row < 0 || col < 0 || row >= gridSize || col >= gridSize) {
      touchLogger.trace('Out of bounds:', { row, col, gridSize });
      return null;
    }

    touchLogger.trace('Valid cell:', { row, col });
    return { row, col };
  };

  const handleTouchStart = (e, piece, index) => {
    touchLogger.trace('📱📱 handleTouchStart CALLED', { piece: piece?.shape?.name, index, event: e.type });

    // Don't interfere with level editor clicks (check target only, no preventDefault yet)
    if (e.target.closest('[data-level-editor]')) {
      touchLogger.trace('Touch on level editor, ignoring');
      return;
    }

    // Prevent dragging locked pieces
    if (lockedInventoryIndices.includes(index)) {
      touchLogger.trace('Piece is locked, ignoring');
      return;
    }

    // CRITICAL: Prevent default to stop scrolling
    touchLogger.trace('Calling preventDefault and stopPropagation');
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    touchLogger.trace('Touch Start:', touch.clientX, touch.clientY);
    touchLogger.trace('Setting state: touchDragging=true, draggingPiece=', piece.shape.name);

    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setTouchCurrentPos({ x: touch.clientX, y: touch.clientY });
    draggingPieceRef.current = piece; // Set ref immediately
    setDraggingPiece(piece);
    setDraggingIndex(index);
    setCurrentDragRotation(0);
    touchDraggingRef.current = true; // Set ref immediately
    setTouchDragging(true);

    // Calculate pattern offset (same as mouse drag)
    const pattern = piece.shape.pattern;
    let firstFilledRow = 0;
    let firstFilledCol = 0;

    outerLoop: for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        if (pattern[r][c] === 1) {
          firstFilledRow = r;
          firstFilledCol = c;
          break outerLoop;
        }
      }
    }

    touchLogger.trace('Pattern offset set to:', { row: firstFilledRow, col: firstFilledCol });
    setDragPatternOffset({ row: firstFilledRow, col: firstFilledCol });
  };

  const handleTouchMove = (e) => {
    if (!touchDraggingRef.current || !draggingPieceRef.current) {
      gridLogger.trace('❌ Touch move ignored:', { touchDragging: touchDraggingRef.current, draggingPiece: !!draggingPieceRef.current });
      return;
    }

    e.preventDefault(); // Prevent scrolling during drag
    e.stopPropagation();

    const touch = e.touches[0];
    touchLogger.trace('Touch Move:', touch.clientX, touch.clientY);

    // Always update current position for floating preview
    setTouchCurrentPos({ x: touch.clientX, y: touch.clientY });

    const cell = getTouchGridCell(touch);
    touchLogger.trace('Touch Grid Cell:', cell);

    if (cell) {
      // Use same logic as handleDragOver
      const anchorRow = cell.row - dragPatternOffset.row;
      const anchorCol = cell.col - dragPatternOffset.col;
      touchLogger.trace('Anchor position:', anchorRow, anchorCol);

      const pattern = getRotatedPattern(draggingPieceRef.current.shape.pattern, currentDragRotation);
      const previewCells = [];

      for (let pRow = 0; pRow < pattern.length; pRow++) {
        for (let pCol = 0; pCol < pattern[pRow].length; pCol++) {
          if (pattern[pRow][pCol] === 1) {
            const gridRow = anchorRow + pRow;
            const gridCol = anchorCol + pCol;

            let valid = true;

            if (gridRow < 0 || gridCol < 0 || gridRow >= gridState.length || gridCol >= gridState[0].length) {
              valid = false;
            } else {
              if (!gridState[gridRow][gridCol].active) {
                valid = false;
              }
              if (gridState[gridRow][gridCol].piece) {
                if (draggingFromGrid &&
                    gridState[gridRow][gridCol].piece.anchorRow === draggingFromGrid.anchorRow &&
                    gridState[gridRow][gridCol].piece.anchorCol === draggingFromGrid.anchorCol) {
                  valid = true;
                } else {
                  valid = false;
                }
              }
            }

            previewCells.push({
              row: gridRow,
              col: gridCol,
              valid: valid
            });
          }
        }
      }

      touchLogger.trace('Setting preview:', { anchorRow, anchorCol, previewCells: previewCells.length });
      setPreviewPosition({ row: anchorRow, col: anchorCol });
      setDragPreviewCells(previewCells);
    } else {
      // Clear grid preview when not over grid
      setPreviewPosition(null);
      setDragPreviewCells([]);
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchDraggingRef.current || !draggingPieceRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    const touch = e.changedTouches[0];
    touchLogger.trace('Touch End:', touch.clientX, touch.clientY);
    const cell = getTouchGridCell(touch);
    touchLogger.trace('Touch End Cell:', cell);

    if (cell) {
      // Use same logic as handleDrop
      const anchorRow = cell.row - dragPatternOffset.row;
      const anchorCol = cell.col - dragPatternOffset.col;

      touchLogger.trace('Dropping at:', anchorRow, anchorCol);
      setPlacingInventoryIndex(draggingIndex);

      // Calculate initial button position based on CURRENT rotation (will stay fixed during further rotations)
      const currentPattern = getRotatedPattern(draggingPieceRef.current.shape.pattern, currentDragRotation);
      const buttonLeft = GRID_PADDING + anchorCol * (adjustedCellSize + GAP_SIZE);
      const buttonTop = GRID_PADDING + (anchorRow + currentPattern.length) * (adjustedCellSize + GAP_SIZE) + GRID_PADDING;
      setPlacingButtonPosition({ left: buttonLeft, top: buttonTop });

      setPlacingPiece(draggingPieceRef.current);
      setPlacingPosition({ row: anchorRow, col: anchorCol });
      setPlacingRotation(currentDragRotation);
    } else {
      touchLogger.trace('Not over grid, canceling drop - piece stays in inventory');
      // IMPORTANT: When dropped outside grid, the piece stays in inventory
      // We only clear visual drag state, we do NOT remove the piece from inventory
    }

    // Clear drag state (both refs and React state)
    touchDraggingRef.current = false; // Clear ref immediately
    draggingPieceRef.current = null; // Clear ref immediately

    // Clear touch position FIRST to make preview disappear immediately
    setTouchCurrentPos(null);
    setTouchDragging(false);

    // Clean up document touch listeners if they exist
    if (touchCleanupRef.current) {
      touchCleanupRef.current();
      touchCleanupRef.current = null;
    }

    // Clear remaining drag state
    setDraggingPiece(null);
    setDraggingIndex(null);
    setPreviewPosition(null);
    setDragPreviewCells([]);
    setCurrentDragRotation(0);
    setDragPatternOffset({ row: 0, col: 0 });
    setTouchStartPos(null);
  };

  const handleTouchStartPlacedPiece = (e, piece, clickedPatternRow, clickedPatternCol) => {
    touchLogger.trace('Touch start on placed piece:', piece, 'clicked cell:', clickedPatternRow, clickedPatternCol);

    // CRITICAL: Prevent default to stop scrolling
    e.preventDefault();

    const touch = e.touches[0];
    touchLogger.trace('Touch Start Placed:', touch.clientX, touch.clientY);

    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setTouchCurrentPos({ x: touch.clientX, y: touch.clientY });

    // Use the pattern cell that was clicked
    setDragPatternOffset({ row: clickedPatternRow, col: clickedPatternCol });

    // Start dragging with the piece's current rotation
    const dragPieceData = {
      shapeId: piece.shapeId,
      shape: piece.shape,
      rarity: piece.rarity,
      level: piece.level
    };

    draggingPieceRef.current = dragPieceData; // Set ref immediately
    setDraggingPiece(dragPieceData);
    setDraggingIndex(piece.inventoryIndex !== undefined ? piece.inventoryIndex : null);
    setCurrentDragRotation(piece.rotation || 0); // Preserve rotation
    setDraggingFromGrid({ anchorRow: piece.anchorRow, anchorCol: piece.anchorCol });
    touchDraggingRef.current = true; // Set ref immediately
    setTouchDragging(true);

    // Add document-level touch listeners IMMEDIATELY (not via useEffect)
    // This ensures the first touchmove is captured
    touchLogger.trace('Adding document touch listeners immediately');

    const handleDocumentTouchMove = (e) => {
      if (touchDraggingRef.current && draggingPieceRef.current) {
        handleTouchMove(e);
      }
    };

    const handleDocumentTouchEnd = (e) => {
      if (touchDraggingRef.current && draggingPieceRef.current) {
        handleTouchEnd(e);
      }
    };

    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });
    document.addEventListener('touchend', handleDocumentTouchEnd, { passive: false });

    // Store cleanup function
    touchCleanupRef.current = () => {
      touchLogger.trace('Cleaning up document touch listeners');
      document.removeEventListener('touchmove', handleDocumentTouchMove);
      document.removeEventListener('touchend', handleDocumentTouchEnd);
    };

    touchLogger.trace('Touch dragging placed piece, draggingFromGrid:', { anchorRow: piece.anchorRow, anchorCol: piece.anchorCol });
  };

  // Placement confirmation handlers
  const handleConfirmPlacement = () => {
    if (!placingPiece || !placingPosition) return;

    // Validate placement
    if (!isCurrentPlacementValid()) {
      // This shouldn't happen since button is disabled, but just in case
      return;
    }

    const pattern = getRotatedPattern(placingPiece.shape.pattern, placingRotation);

    // Place piece on grid
    const newGrid = JSON.parse(JSON.stringify(gridState));
    const inventoryIndex = placingInventoryIndex !== null ? placingInventoryIndex : undefined;

    gridLogger.trace('Placing piece:', placingPiece);
    gridLogger.trace('Pattern:', pattern);
    gridLogger.trace('Position:', placingPosition);

    // If we're moving a piece from the grid, remove it from its old position first
    if (draggingFromGrid) {
      gridLogger.trace('Removing piece from old position:', draggingFromGrid);
      for (let r = 0; r < newGrid.length; r++) {
        for (let c = 0; c < newGrid[r].length; c++) {
          if (newGrid[r][c].piece &&
              newGrid[r][c].piece.anchorRow === draggingFromGrid.anchorRow &&
              newGrid[r][c].piece.anchorCol === draggingFromGrid.anchorCol) {
            newGrid[r][c].piece = null;
          }
        }
      }
    }

    pattern.forEach((patternRow, pRow) => {
      patternRow.forEach((cell, pCol) => {
        if (cell === 1) {
          const gridRow = placingPosition.row + pRow;
          const gridCol = placingPosition.col + pCol;
          if (gridRow < newGrid.length && gridCol < newGrid[0].length) {
            const pieceData = {
              ...placingPiece,
              rotation: placingRotation,
              anchorRow: placingPosition.row,
              anchorCol: placingPosition.col,
              inventoryIndex: inventoryIndex // Track source inventory slot
            };
            gridLogger.trace(`Setting piece at [${gridRow}][${gridCol}]:`, pieceData);
            newGrid[gridRow][gridCol].piece = pieceData;
          }
        }
      });
    });

    gridLogger.trace('New grid state after placement:', newGrid);
    setGridState(newGrid);

    // DON'T remove piece from inventory - keep it there but locked
    // The piece will show as locked/greyed out via lockedInventoryIndices

    // Clear placement state
    setPlacingPiece(null);
    setPlacingPosition(null);
    setPlacingRotation(0);
    setPlacingInventoryIndex(null);
    setPlacingButtonPosition(null);

    // Also clear any remaining drag states
    setDraggingPiece(null);
    setDraggingIndex(null);
    setDraggingFromGrid(null);
    setPreviewPosition(null);
    setDragPreviewCells([]);
    setCurrentDragRotation(0);
    setDragPatternOffset({ row: 0, col: 0 });

    setHasUnsavedChanges(true);
  };

  const handleRotatePlacing = () => {
    // Always allow rotation, even if it makes placement invalid
    const newRotation = (placingRotation + 90) % 360;
    setPlacingRotation(newRotation);
  };

  const handleCancelPlacement = () => {
    gridLogger.trace('❌ Canceling placement - removing piece from grid');

    // ALWAYS remove piece from grid when canceling
    // If we were dragging from grid, remove it from the grid
    if (draggingFromGrid) {
      gridLogger.trace('❌ Removing piece from grid at:', draggingFromGrid);
      const newGrid = JSON.parse(JSON.stringify(gridState));
      for (let r = 0; r < newGrid.length; r++) {
        for (let c = 0; c < newGrid[r].length; c++) {
          if (newGrid[r][c].piece &&
              newGrid[r][c].piece.anchorRow === draggingFromGrid.anchorRow &&
              newGrid[r][c].piece.anchorCol === draggingFromGrid.anchorCol) {
            newGrid[r][c].piece = null;
          }
        }
      }
      setGridState(newGrid);
    }

    // Return piece to inventory if it came from there
    if (placingPiece && placingInventoryIndex !== null) {
      // Piece came from inventory, unlock it
      const newLockedIndices = lockedInventoryIndices.filter(idx => idx !== placingInventoryIndex);
      setLockedInventoryIndices(newLockedIndices);
      gridLogger.trace('❌ Piece returned to inventory slot', placingInventoryIndex);
    } else if (placingPiece && placingInventoryIndex === null) {
      // Piece was unsocketed from grid, find empty inventory slot
      const emptySlot = inventory.findIndex(slot => slot === null);
      if (emptySlot !== -1) {
        const newInventory = [...inventory];
        newInventory[emptySlot] = {
          shapeId: placingPiece.shapeId,
          shape: placingPiece.shape,
          rarity: placingPiece.rarity,
          level: placingPiece.level
        };
        setInventory(newInventory);
        gridLogger.trace('❌ Piece returned to inventory slot', emptySlot);
      }
    }

    // Clear all placement and drag states
    setPlacingPiece(null);
    setPlacingPosition(null);
    setPlacingRotation(0);
    setPlacingInventoryIndex(null);
    setPlacingButtonPosition(null);
    setDraggingFromGrid(null);
    setDraggingPiece(null);
    setDraggingIndex(null);
    setHasUnsavedChanges(true);
  };

  const handleClickPlacedPiece = (e, piece) => {
    gridLogger.trace('👆 Clicked placed piece, entering placing mode:', piece);

    // Validate piece data
    if (!piece || !piece.shape || !piece.shape.pattern) {
      gridLogger.error('Invalid piece data', { piece });
      return;
    }

    // Put piece into placing mode WITHOUT removing from grid yet
    // This lets user rotate, reposition, or cancel
    setPlacingPiece({
      shapeId: piece.shapeId,
      shape: piece.shape,
      rarity: piece.rarity,
      level: piece.level
    });
    setPlacingPosition({ row: piece.anchorRow, col: piece.anchorCol });
    setPlacingRotation(piece.rotation || 0);
    setPlacingInventoryIndex(piece.inventoryIndex !== undefined ? piece.inventoryIndex : null);
    // Mark that we're editing a piece already on the grid
    setDraggingFromGrid({ anchorRow: piece.anchorRow, anchorCol: piece.anchorCol });
  };

  const handleUnsocketPiece = (row, col) => {
    const piece = gridState[row][col].piece;
    if (!piece) return;

    // Clear all cells that belong to this piece
    const newGrid = JSON.parse(JSON.stringify(gridState));
    const anchorRow = piece.anchorRow;
    const anchorCol = piece.anchorCol;

    for (let r = 0; r < newGrid.length; r++) {
      for (let c = 0; c < newGrid[r].length; c++) {
        if (newGrid[r][c].piece &&
            newGrid[r][c].piece.anchorRow === anchorRow &&
            newGrid[r][c].piece.anchorCol === anchorCol) {
          newGrid[r][c].piece = null;
        }
      }
    }

    setGridState(newGrid);

    // Put piece into placing mode (allows repositioning/rotating)
    setPlacingPiece({
      shapeId: piece.shapeId,
      shape: piece.shape,
      rarity: piece.rarity,
      level: piece.level
    });
    setPlacingPosition({ row: anchorRow, col: anchorCol });
    setPlacingRotation(piece.rotation || 0);
    setDraggingIndex(null); // No inventory index since it's already placed

    setHasUnsavedChanges(true);
  };

  const handleDragPlacedPiece = (e, piece, clickedPatternRow, clickedPatternCol) => {
    gridLogger.trace('🔥 Starting drag of placed piece:', piece, 'clicked cell:', clickedPatternRow, clickedPatternCol);

    // DON'T remove the piece from grid yet - keep it visible during drag
    // We'll remove it when dropping in a new location or on drag end

    // Use the pattern cell that was clicked
    setDragPatternOffset({ row: clickedPatternRow, col: clickedPatternCol });

    // Start dragging with the piece's current rotation
    const dragPieceData = {
      shapeId: piece.shapeId,
      shape: piece.shape,
      rarity: piece.rarity,
      level: piece.level
    };
    gridLogger.trace('🔥 Setting dragging piece:', dragPieceData);

    // Set effectAllowed before changing state
    e.dataTransfer.effectAllowed = 'move';

    // IMPORTANT: Set dragging state AFTER drag has started
    // This prevents React from unmounting the drag source before drag begins
    setTimeout(() => {
      setDraggingPiece(dragPieceData);
      // Preserve the inventory index if it had one
      setDraggingIndex(piece.inventoryIndex !== undefined ? piece.inventoryIndex : null);
      setCurrentDragRotation(piece.rotation || 0); // Preserve rotation
      // Mark that we're dragging from grid so we can remove it on drop
      setDraggingFromGrid({ anchorRow: piece.anchorRow, anchorCol: piece.anchorCol });
      gridLogger.trace('🔥 Dragging state set after delay - rotation:', piece.rotation || 0, 'from grid:', piece.anchorRow, piece.anchorCol);
    }, 0);
  };

  const handleRemovePiece = (row, col) => {
    const piece = gridState[row][col].piece;
    if (!piece) return;

    // Find all cells with this piece (based on anchor)
    const newGrid = JSON.parse(JSON.stringify(gridState));
    const anchorRow = piece.anchorRow;
    const anchorCol = piece.anchorCol;

    // Clear all cells that belong to this piece
    for (let r = 0; r < newGrid.length; r++) {
      for (let c = 0; c < newGrid[r].length; c++) {
        if (newGrid[r][c].piece &&
            newGrid[r][c].piece.anchorRow === anchorRow &&
            newGrid[r][c].piece.anchorCol === anchorCol) {
          newGrid[r][c].piece = null;
        }
      }
    }

    setGridState(newGrid);

    // Don't return piece to inventory - it's already there, just locked
    // updateLockedInventoryIndices will automatically unlock it when grid updates

    setHasUnsavedChanges(true);
  };

  // Handle unsocketing from inventory slot
  const handleUnsocketFromInventory = (inventoryIndex) => {
    // Find and remove the piece from grid that has this inventoryIndex
    const newGrid = JSON.parse(JSON.stringify(gridState));

    for (let r = 0; r < newGrid.length; r++) {
      for (let c = 0; c < newGrid[r].length; c++) {
        if (newGrid[r][c].piece && newGrid[r][c].piece.inventoryIndex === inventoryIndex) {
          // Clear this piece from the entire grid
          const anchorRow = newGrid[r][c].piece.anchorRow;
          const anchorCol = newGrid[r][c].piece.anchorCol;

          for (let r2 = 0; r2 < newGrid.length; r2++) {
            for (let c2 = 0; c2 < newGrid[r2].length; c2++) {
              if (newGrid[r2][c2].piece &&
                  newGrid[r2][c2].piece.anchorRow === anchorRow &&
                  newGrid[r2][c2].piece.anchorCol === anchorCol) {
                newGrid[r2][c2].piece = null;
              }
            }
          }

          setGridState(newGrid);
          setHasUnsavedChanges(true);
          return; // Exit early
        }
      }
    }
  };

  const canPlacePiece = (row, col, pattern) => {
    for (let pRow = 0; pRow < pattern.length; pRow++) {
      for (let pCol = 0; pCol < pattern[pRow].length; pCol++) {
        if (pattern[pRow][pCol] === 1) {
          const gridRow = row + pRow;
          const gridCol = col + pCol;

          // Check bounds
          if (gridRow < 0 || gridCol < 0 || gridRow >= gridState.length || gridCol >= gridState[0].length) {
            return false;
          }

          // Check if slot is active
          if (!gridState[gridRow][gridCol].active) {
            return false;
          }

          // Check if slot is already occupied
          if (gridState[gridRow][gridCol].piece) {
            // Allow if this cell is occupied by the piece we're currently dragging
            if (draggingFromGrid &&
                gridState[gridRow][gridCol].piece.anchorRow === draggingFromGrid.anchorRow &&
                gridState[gridRow][gridCol].piece.anchorCol === draggingFromGrid.anchorCol) {
              // This cell belongs to the piece we're dragging, so it's okay
              continue;
            }
            return false;
          }
        }
      }
    }
    return true;
  };

  const isCurrentPlacementValid = () => {
    if (!placingPiece || !placingPosition || !placingPiece.shape || !placingPiece.shape.pattern) return false;
    const pattern = getRotatedPattern(placingPiece.shape.pattern, placingRotation);
    return canPlacePiece(placingPosition.row, placingPosition.col, pattern);
  };

  const getRotatedPattern = (pattern, rotation) => {
    if (rotation === 0) return pattern;

    let rotated = pattern;
    const times = rotation / 90;

    for (let i = 0; i < times; i++) {
      rotated = rotatePattern90(rotated);
    }

    return rotated;
  };

  const rotatePattern90 = (pattern) => {
    const rows = pattern.length;
    const cols = pattern[0].length;
    const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        rotated[c][rows - 1 - r] = pattern[r][c];
      }
    }

    return rotated;
  };

  // Fallback calculation when image fails to load
  const getPieceImageSizeFallback = (pattern) => {
    // Calculate the actual bounding box of filled cells (1s), not the entire array
    let minRow = pattern.length;
    let maxRow = -1;
    let minCol = pattern[0].length;
    let maxCol = -1;

    for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        if (pattern[r][c] === 1) {
          minRow = Math.min(minRow, r);
          maxRow = Math.max(maxRow, r);
          minCol = Math.min(minCol, c);
          maxCol = Math.max(maxCol, c);
        }
      }
    }

    // If no filled cells found, fallback to full dimensions
    if (maxRow === -1) {
      return {
        width: pattern[0].length * cellSize,
        height: pattern.length * cellSize
      };
    }

    const actualRows = maxRow - minRow + 1;
    const actualCols = maxCol - minCol + 1;

    return {
      width: actualCols * cellSize,
      height: actualRows * cellSize
    };
  };

  // Calculate container size based on pattern dimensions (for positioning)
  const getPatternContainerSize = (pattern) => {
    return {
      width: pattern[0].length * cellSize,
      height: pattern.length * cellSize
    };
  };

  const handleClearGrid = () => {
    gridLogger.debug('Clear grid button clicked');
    gridLogger.debug('Grid state has pieces', { hasPieces: gridState.some(row => row.some(cell => cell.piece)) });

    if (confirm('Clear all placed pieces? They will be returned to inventory if space available.')) {
      gridLogger.debug('User confirmed, clearing grid');

      // Return pieces to inventory where possible
      const piecesToReturn = [];
      gridState.forEach(row => {
        row.forEach(cell => {
          if (cell.piece) {
            const exists = piecesToReturn.some(p =>
              p.anchorRow === cell.piece.anchorRow &&
              p.anchorCol === cell.piece.anchorCol
            );
            if (!exists) {
              piecesToReturn.push(cell.piece);
            }
          }
        });
      });

      gridLogger.debug('Pieces to return', { count: piecesToReturn.length });

      const newInventory = [...inventory];
      piecesToReturn.forEach(piece => {
        const emptySlot = newInventory.findIndex(slot => slot === null);
        if (emptySlot !== -1) {
          newInventory[emptySlot] = {
            shapeId: piece.shapeId,
            shape: piece.shape,
            rarity: piece.rarity,
            level: piece.level
          };
        }
      });

      gridLogger.debug('Updated inventory, initializing grid');
      setInventory(newInventory);
      initializeGrid();
      setHasUnsavedChanges(true);
      gridLogger.info('Grid cleared successfully');
    } else {
      gridLogger.debug('User cancelled clear grid');
    }
  };

  // Unsocket all pieces from grid (called when changing weapons)
  const unsocketAllPieces = () => {
    // Return all placed pieces to inventory where possible
    const piecesToReturn = [];
    gridState.forEach(row => {
      row.forEach(cell => {
        if (cell.piece) {
          const exists = piecesToReturn.some(p =>
            p.anchorRow === cell.piece.anchorRow &&
            p.anchorCol === cell.piece.anchorCol
          );
          if (!exists) {
            piecesToReturn.push(cell.piece);
          }
        }
      });
    });

    gridLogger.debug('Unsocketing pieces', { count: piecesToReturn.length });

    const newInventory = [...inventory];
    piecesToReturn.forEach(piece => {
      const emptySlot = newInventory.findIndex(slot => slot === null);
      if (emptySlot !== -1) {
        newInventory[emptySlot] = {
          shapeId: piece.shapeId,
          shape: piece.shape,
          rarity: piece.rarity,
          level: piece.level
        };
      } else {
        gridLogger.warn('No inventory space for piece', { shapeId: piece.shapeId });
      }
    });

    // CRITICAL: Clear the grid state after collecting pieces
    // This ensures the grid is completely empty after unsocketing
    const clearedGrid = gridState.map(row =>
      row.map(cell => ({
        ...cell,
        piece: null
      }))
    );
    gridLogger.debug('Grid state cleared after unsocketing');

    setGridState(clearedGrid);
    setInventory(newInventory);
    setHasUnsavedChanges(true);
  };

  const handleClearBuild = () => {
    if (confirm('Clear entire build including inventory?')) {
      setBuildName('');
      setInventory(Array(8).fill(null));
      initializeGrid();
      clearDraft();
      setHasUnsavedChanges(false);
    }
  };

  const isGridComplete = () => {
    if (!gridState.length) return false;

    return gridState.every(row =>
      row.every(cell => !cell.active || cell.piece)
    );
  };

  const getCompletionBonus = () => {
    if (!selectedWeapon || !isGridComplete()) return null;
    return selectedWeapon.completionEffect;
  };

  // ===== AUTO-SOLVE ALGORITHM =====

  const canPlacePieceAtPosition = (grid, piece, rotation, anchorRow, anchorCol) => {
    const pattern = getRotatedPattern(piece.shape.pattern, rotation);

    for (let pRow = 0; pRow < pattern.length; pRow++) {
      for (let pCol = 0; pCol < pattern[pRow].length; pCol++) {
        if (pattern[pRow][pCol] === 1) {
          const gridRow = anchorRow + pRow;
          const gridCol = anchorCol + pCol;

          // Check bounds
          if (gridRow < 0 || gridCol < 0 || gridRow >= grid.length || gridCol >= grid[0].length) {
            return false;
          }

          // Check if slot is active
          if (!grid[gridRow][gridCol].active) {
            return false;
          }

          // Check if slot is already occupied
          if (grid[gridRow][gridCol].piece) {
            return false;
          }
        }
      }
    }

    return true;
  };

  const placePieceOnGrid = (grid, piece, rotation, anchorRow, anchorCol) => {
    const newGrid = JSON.parse(JSON.stringify(grid));
    const pattern = getRotatedPattern(piece.shape.pattern, rotation);

    for (let pRow = 0; pRow < pattern.length; pRow++) {
      for (let pCol = 0; pCol < pattern[pRow].length; pCol++) {
        if (pattern[pRow][pCol] === 1) {
          const gridRow = anchorRow + pRow;
          const gridCol = anchorCol + pCol;

          newGrid[gridRow][gridCol].piece = {
            shapeId: piece.shapeId,
            shape: piece.shape,
            rarity: piece.rarity,
            level: piece.level,
            rotation: rotation,
            anchorRow: anchorRow,
            anchorCol: anchorCol,
            inventoryIndex: piece.inventoryIndex
          };
        }
      }
    }

    return newGrid;
  };

  const isGridFullyCovered = (grid) => {
    return grid.every(row =>
      row.every(cell => !cell.active || cell.piece)
    );
  };

  // Generate all combinations of k items from array
  const getCombinations = (array, k) => {
    if (k === 0) return [[]];
    if (array.length === 0) return [];

    const [first, ...rest] = array;
    const combsWithFirst = getCombinations(rest, k - 1).map(comb => [first, ...comb]);
    const combsWithoutFirst = getCombinations(rest, k);

    return [...combsWithFirst, ...combsWithoutFirst];
  };

  // Try to place a specific set of pieces on the grid - return first successful placement
  const tryPlacePieceCombination = (grid, pieces) => {
    const gridSize = grid.length;

    // Find first empty active cell to guide placement (optimization)
    const findFirstEmptyActiveCell = (grid) => {
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          if (grid[row][col].active && !grid[row][col].piece) {
            return { row, col };
          }
        }
      }
      return null;
    };

    const tryPlace = (grid, remainingPieces, currentSolution) => {
      // Base case: all pieces placed successfully
      if (remainingPieces.length === 0) {
        // Check if grid is fully covered
        if (isGridFullyCovered(grid)) {
          return currentSolution;
        }
        return null; // Pieces placed but grid not covered
      }

      // Find the first empty active cell to try placing pieces there (optimization)
      const emptyCell = findFirstEmptyActiveCell(grid);
      if (!emptyCell) {
        return null; // No empty cells, shouldn't happen
      }

      // Try placing each remaining piece at or near the empty cell
      for (let i = 0; i < remainingPieces.length; i++) {
        const piece = remainingPieces[i];

        // Try all 4 rotations
        for (const rotation of [0, 90, 180, 270]) {
          // Try positions near the empty cell first (optimization)
          // This dramatically reduces search space
          const pattern = getRotatedPattern(piece.shape.pattern, rotation);
          const patternRows = pattern.length;
          const patternCols = pattern[0].length;

          // Calculate anchor position that would cover the empty cell
          for (let pRow = 0; pRow < patternRows; pRow++) {
            for (let pCol = 0; pCol < patternCols; pCol++) {
              if (pattern[pRow][pCol] === 1) {
                // This filled cell could cover the empty cell
                const anchorRow = emptyCell.row - pRow;
                const anchorCol = emptyCell.col - pCol;

                // Check if this anchor is valid
                if (anchorRow >= 0 && anchorCol >= 0 &&
                    anchorRow < gridSize && anchorCol < gridSize &&
                    canPlacePieceAtPosition(grid, piece, rotation, anchorRow, anchorCol)) {

                  // Place piece
                  const newGrid = placePieceOnGrid(grid, piece, rotation, anchorRow, anchorCol);

                  // Remove this piece from remaining
                  const newRemaining = remainingPieces.filter((_, idx) => idx !== i);

                  // Record placement
                  const placement = {
                    piece: piece,
                    rotation: rotation,
                    anchorRow: anchorRow,
                    anchorCol: anchorCol
                  };

                  // Recurse - try to place remaining pieces
                  const result = tryPlace(newGrid, newRemaining, [...currentSolution, placement]);

                  // If successful, return immediately
                  if (result) {
                    return result;
                  }
                }
              }
            }
          }
        }
      }

      return null; // No valid placement found
    };

    return tryPlace(grid, pieces, []);
  };

  const getSolutionSignature = (solution) => {
    // Create a signature based on which pieces are used (inventory indices sorted)
    // This identifies solutions that use the same pieces, regardless of rotation/position
    return solution
      .map(placement => placement.piece.inventoryIndex)
      .sort((a, b) => a - b)
      .join(',');
  };

  const deduplicateSolutions = (solutions) => {
    const seen = new Set();
    const unique = [];

    for (const solution of solutions) {
      const signature = getSolutionSignature(solution);
      if (!seen.has(signature)) {
        seen.add(signature);
        unique.push(solution);
      }
    }

    gridLogger.trace(`🔍 Deduplicated: ${solutions.length} → ${unique.length} unique solutions`);
    return unique;
  };

  // Generate cache key for weapon + inventory combination
  const getCacheKey = (weaponId, pieces) => {
    // Sort pieces by shape ID, then rarity, then level for consistent key
    const sortedPieces = [...pieces].sort((a, b) => {
      if (a.shapeId !== b.shapeId) return a.shapeId - b.shapeId;
      if (a.rarity !== b.rarity) return a.rarity - b.rarity;
      return a.level - b.level;
    });

    // Create signature: weaponId-shapeId:rarity:level,shapeId:rarity:level,...
    const inventorySignature = sortedPieces
      .map(p => `${p.shapeId}:${p.rarity}:${p.level}`)
      .join(',');

    return `${weaponId}-${inventorySignature}`;
  };

  const handleAutoSolve = () => {
    if (!selectedWeapon) {
      alert('Please select a weapon first');
      return;
    }

    const validPieces = inventory.filter(p => p !== null).map((piece, idx) => ({
      ...piece,
      inventoryIndex: idx
    }));

    if (validPieces.length === 0) {
      alert('No pieces in inventory to solve with');
      return;
    }

    // Check cache first
    const cacheKey = getCacheKey(selectedWeapon.id, validPieces);
    if (solutionCache[cacheKey]) {
      gridLogger.trace('💾 Using cached solutions for', selectedWeapon.name);
      setAutoSolveSolutions(solutionCache[cacheKey]);
      setShowSolutionPicker(true);

      // Trigger donation prompt on successful solve
      window.triggerDonationPrompt?.({
        messages: [
          "Let the AI do the work! 🤖",
          "Work smarter, not harder! 🧠",
          "Puzzle solved instantly! ⚡",
          "That's using your brain... or mine! 🎯",
        ]
      });

      return;
    }

    autoSolveLogger.debug('Starting auto-solve with', validPieces.length, 'pieces');
    autoSolveLogger.debug('Pieces', { pieces: validPieces.map(p => `[${p.inventoryIndex}] ${p.shape.name}`).join(', ') });
    setIsSolving(true);
    setAutoSolveSolutions([]);

    // Run solver in a timeout to allow UI to update
    setTimeout(() => {
      const solutions = [];
      const emptyGrid = JSON.parse(JSON.stringify(gridState));

      // Clear all pieces from grid for solving
      emptyGrid.forEach(row => {
        row.forEach(cell => {
          cell.piece = null;
        });
      });

      try {
        // Calculate minimum pieces needed based on grid size
        const totalActiveSlots = emptyGrid.flat().filter(cell => cell.active).length;
        gridLogger.trace(`📊 Grid has ${totalActiveSlots} active slots to cover`);

        // Calculate average cells per piece
        const avgCellsPerPiece = validPieces.reduce((sum, p) => {
          const pattern = p.shape.pattern;
          const cells = pattern.flat().filter(c => c === 1).length;
          return sum + cells;
        }, 0) / validPieces.length;

        // Start from minimum possible pieces (optimized!)
        const minPieces = Math.max(1, Math.floor(totalActiveSlots / avgCellsPerPiece));
        const maxPiecesToTry = Math.min(validPieces.length, 8);

        gridLogger.trace(`⚡ Optimization: Starting from ${minPieces} pieces (skipping impossible sizes)`);

        // Track which shape type combinations we've already found
        const foundShapeTypeSignatures = new Set();

        // Helper to get shape type signature (e.g., "Line:4" or "L-Shape:2,Line:2")
        const getShapeTypeSignature = (combination) => {
          const shapeCounts = {};
          combination.forEach(piece => {
            const shapeName = piece.shape.name;
            shapeCounts[shapeName] = (shapeCounts[shapeName] || 0) + 1;
          });

          // Sort by shape name for consistency
          return Object.keys(shapeCounts)
            .sort()
            .map(name => `${name}:${shapeCounts[name]}`)
            .join(',');
        };

        for (let numPieces = minPieces; numPieces <= maxPiecesToTry; numPieces++) {
          gridLogger.trace(`\n🔍 Trying combinations of ${numPieces} piece(s)...`);

          // Generate ALL unique combinations of this size
          const combinations = getCombinations(validPieces, numPieces);
          gridLogger.trace(`   Generated ${combinations.length} piece combinations`);

          let foundInThisSize = 0;
          let skippedDuplicates = 0;

          // For each unique combination, check if we've seen this shape type combo before
          for (let i = 0; i < combinations.length; i++) {
            const combination = combinations[i];

            // Get the shape type signature
            const shapeTypeSignature = getShapeTypeSignature(combination);

            // Skip if we've already found a solution with this shape type combination
            if (foundShapeTypeSignatures.has(shapeTypeSignature)) {
              skippedDuplicates++;
              continue;
            }

            // Try to place this specific combination on the grid
            const solution = tryPlacePieceCombination(emptyGrid, combination);

            if (solution) {
              // Mark this shape type combination as found
              foundShapeTypeSignatures.add(shapeTypeSignature);
              solutions.push(solution);
              foundInThisSize++;

              const pieceIndices = combination.map(p => p.inventoryIndex).join(',');
              gridLogger.trace(`   ✅ Solution ${solutions.length}: [${pieceIndices}] = ${shapeTypeSignature}`);
            }
          }

          gridLogger.trace(`   Found ${foundInThisSize} unique shape combinations (skipped ${skippedDuplicates} duplicates)`);

          // Continue to next size to find all possible shape type combinations
        }

        gridLogger.trace(`\n✅ Total: ${solutions.length} unique solution(s) found`);
        gridLogger.trace('💡 Each solution uses a different combination of pieces');

        if (solutions.length === 0) {
          alert('No complete solutions found. Try different pieces or fewer pieces that can cover the grid.');
        } else {
          // Cache the solutions for this weapon + inventory combination
          const cacheKey = getCacheKey(selectedWeapon.id, validPieces);
          setSolutionCache(prev => ({
            ...prev,
            [cacheKey]: solutions
          }));
          gridLogger.trace('💾 Cached solutions for future use');

          setAutoSolveSolutions(solutions);
          setShowSolutionPicker(true);

          // Trigger donation prompt on successful solve
          window.triggerDonationPrompt?.({
            messages: [
              "Let the AI do the work! 🤖",
              "Work smarter, not harder! 🧠",
              "Puzzle solved instantly! ⚡",
              "That's using your brain... or mine! 🎯",
            ]
          });
        }
      } catch (error) {
        autoSolveLogger.error('Auto-solve error', { error });
        alert('An error occurred while solving. Please try again.');
      } finally {
        setIsSolving(false);
      }
    }, 100);
  };

  const handleApplySolution = (solution) => {
    autoSolveLogger.info('Applying solution', solution);

    // Start with empty grid
    const newGrid = JSON.parse(JSON.stringify(gridState));
    newGrid.forEach(row => {
      row.forEach(cell => {
        cell.piece = null;
      });
    });

    // Place each piece from solution
    solution.forEach(placement => {
      const pattern = getRotatedPattern(placement.piece.shape.pattern, placement.rotation);

      for (let pRow = 0; pRow < pattern.length; pRow++) {
        for (let pCol = 0; pCol < pattern[pRow].length; pCol++) {
          if (pattern[pRow][pCol] === 1) {
            const gridRow = placement.anchorRow + pRow;
            const gridCol = placement.anchorCol + pCol;

            newGrid[gridRow][gridCol].piece = {
              shapeId: placement.piece.shapeId,
              shape: placement.piece.shape,
              rarity: placement.piece.rarity,
              level: placement.piece.level,
              rotation: placement.rotation,
              anchorRow: placement.anchorRow,
              anchorCol: placement.anchorCol,
              inventoryIndex: placement.piece.inventoryIndex
            };
          }
        }
      }
    });

    setGridState(newGrid);
    setShowSolutionPicker(false);
    setHasUnsavedChanges(true);
  };

  const handleFindBestWeapon = async () => {
    const validPieces = inventory.filter(p => p !== null).map((piece, idx) => ({
      ...piece,
      inventoryIndex: idx
    }));

    if (validPieces.length === 0) {
      alert('No pieces in inventory to test with');
      return;
    }

    // Check for valid cache first
    const cachedResults = getBestWeaponCache();
    if (cachedResults) {
      autoSolveLogger.debug('Using cached best weapon results');
      setBestWeaponResults(cachedResults);
      setShowBestWeaponModal(true);

      // Trigger donation prompt on successful find
      window.triggerDonationPrompt?.({
        messages: [
          "Finding the meta! Nice! 📊",
          "Optimizing like a pro! 🏆",
          "Min-maxing at its finest! 🎯",
          "That's some big brain energy! 🧠",
        ]
      });

      return;
    }

    // Filter weapons from allWeapons (which has correct IDs) up to highestUnlockedWeapon
    const unlockedAllWeapons = allWeapons.filter(w => w.id <= highestUnlockedWeapon);

    // Merge weapon data: use allWeapons for ID and image, merge with official grid data if available
    // This ensures we test ALL weapons, including those with only community submissions
    const unlockedWeapons = unlockedAllWeapons.map(aw => {
      const officialData = weapons.find(w => w.name === aw.name);
      if (officialData) {
        // Weapon has official grid data - merge it with data from allWeapons (image, attack, etc.)
        return {
          ...officialData,
          id: aw.id,
          image: aw.image,
          attack: aw.attack,
          requirements: aw.requirements
        };
      } else {
        // Weapon has no official data - will check for community submissions later
        return aw;
      }
    });

    // Find highest unlocked weapon name for display
    const highestWeaponName = allWeapons.find(w => w.id === highestUnlockedWeapon)?.name || 'Unknown';

    // Confirmation prompt (only shown if no cache)
    const confirmed = window.confirm(
      `Finding the best weapon will test ${unlockedWeapons.length} unlocked weapon${unlockedWeapons.length !== 1 ? 's' : ''} with your current inventory.\n\n` +
      `Highest unlocked: ${highestWeaponName}\n\n` +
      'This may take 10-30 seconds to complete.\n\n' +
      'Note: This will check for both official grid data and community submissions.\n\n' +
      'Continue?'
    );

    if (!confirmed) {
      return;
    }

    autoSolveLogger.debug('Finding best weapon for', validPieces.length, 'pieces');
    setIsFindingBestWeapon(true);
    setBestWeaponResults([]);

    // Run in timeout to allow UI to update
    setTimeout(async () => {
      try {
        const results = [];
        const startTime = Date.now();
        const newCacheEntries = {}; // Batch cache updates

        gridLogger.trace(`🔓 Testing ${unlockedWeapons.length} unlocked weapons (up to ${highestWeaponName})`);

        // Test each unlocked weapon
        for (let weaponIndex = 0; weaponIndex < unlockedWeapons.length; weaponIndex++) {
          const weapon = unlockedWeapons[weaponIndex];
          gridLogger.trace(`\n🗡️ Testing weapon ${weaponIndex + 1}/${unlockedWeapons.length}: ${weapon.name}`);

          // Get grid data for this weapon (official or community)
          const weaponGridData = await getWeaponGridData(weapon);

          if (!weaponGridData || !weaponGridData.hasData) {
            gridLogger.trace(`   ⚠️ No grid data available (skipping)`);
            continue; // Skip weapons without grid data
          }

          if (weaponGridData.source === 'community') {
            gridLogger.trace(`   📝 Using community submission from ${weaponGridData.submittedBy || 'Anonymous'}`);
          }

          // Create empty grid for this weapon using the grid data
          const gridSize = weaponGridData.gridType === '4x4' ? 4 : 5;
          const emptyGrid = Array(gridSize).fill(null).map((_, row) =>
            Array(gridSize).fill(null).map((_, col) => {
              const activeSlot = weaponGridData.activeSlots?.some(
                slot => slot.row === row && slot.col === col
              );
              return {
                active: activeSlot || false,
                piece: null
              };
            })
          );

          // Run auto-solve for this weapon (with caching)
          const solutions = solveForWeapon(emptyGrid, validPieces, weapon.id, newCacheEntries);

          if (solutions.length > 0) {
            // Calculate score
            let score = solutions.length; // Base score: number of solutions

            // Bonus: count solutions with all same piece types
            const samePieceSolutions = solutions.filter(solution => {
              const shapeTypes = new Set();
              solution.forEach(placement => {
                shapeTypes.add(placement.piece.shape.name);
              });
              return shapeTypes.size === 1; // All pieces are same type
            });

            const samePieceBonus = samePieceSolutions.length * 2; // 2x bonus for same-piece solutions
            score += samePieceBonus;

            // Weapon tier bonus: HEAVILY favor higher tier weapons (weapons ordered by progression)
            // This ensures highest level weapons with solutions always rank at the top
            // Multiply by 10 to make weapon level the dominant factor
            const tierBonus = weapon.id * 10; // 10 points per weapon level (weapon 42 gets +420)
            score += tierBonus;

            gridLogger.trace(`   ✅ Found ${solutions.length} solutions (${samePieceSolutions.length} same-piece) - Base: ${solutions.length + samePieceBonus}, Tier: +${tierBonus} = Score: ${score.toFixed(1)}`);

            // Enrich weapon object with grid data if it doesn't have it
            const enrichedWeapon = {
              ...weapon,
              gridType: weapon.gridType || weaponGridData.gridType,
              completionEffect: weapon.completionEffect || weaponGridData.completionEffect
            };

            results.push({
              weapon: enrichedWeapon,
              solutionCount: solutions.length,
              samePieceCount: samePieceSolutions.length,
              score,
              solutions: solutions.slice(0, 5), // Keep top 5 solutions for preview
              totalActiveSlots: emptyGrid.flat().filter(cell => cell.active).length,
              gridDataSource: weaponGridData.source, // 'official' or 'community'
              submittedBy: weaponGridData.submittedBy // For community submissions
            });
          } else {
            gridLogger.trace(`   ❌ No solutions found`);
          }

          // Timeout check (max 30 seconds)
          if (Date.now() - startTime > 30000) {
            gridLogger.trace('⏱️ Timeout reached, stopping search');
            break;
          }
        }

        // Sort results by score (descending) - score already includes weapon tier bonus
        results.sort((a, b) => b.score - a.score);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        gridLogger.trace(`\n🏆 Best weapon search complete in ${elapsed}s`);
        gridLogger.trace(`📊 Found ${results.length} weapons with solutions (tested ${unlockedWeapons.length} unlocked weapons)`);

        // Update cache with all new entries found during search
        if (Object.keys(newCacheEntries).length > 0) {
          setSolutionCache(prev => ({
            ...prev,
            ...newCacheEntries
          }));
          gridLogger.trace(`💾 Cached ${Object.keys(newCacheEntries).length} new weapon solutions`);
        }

        if (results.length === 0) {
          alert('No weapons found that can fit your current inventory pieces');
        } else {
          // Cache the results
          setBestWeaponCache(results);
          setBestWeaponResults(results);
          setShowBestWeaponModal(true);

          // Trigger donation prompt on successful find
          window.triggerDonationPrompt?.({
            messages: [
              "Finding the meta! Nice! 📊",
              "Optimizing like a pro! 🏆",
              "Min-maxing at its finest! 🎯",
              "That's some big brain energy! 🧠",
            ]
          });
        }
      } catch (error) {
        autoSolveLogger.error('Find best weapon error', { error });
        alert('An error occurred while searching. Please try again.');
      } finally {
        setIsFindingBestWeapon(false);
      }
    }, 100);
  };

  // Helper function to solve for a specific weapon grid
  const solveForWeapon = (emptyGrid, validPieces, weaponId, newCacheEntries = null) => {
    // Check cache first (both existing cache and new cache entries from current search)
    const cacheKey = getCacheKey(weaponId, validPieces);
    if (solutionCache[cacheKey]) {
      gridLogger.trace(`   💾 Using cached solutions (existing)`);
      return solutionCache[cacheKey];
    }
    if (newCacheEntries && newCacheEntries[cacheKey]) {
      gridLogger.trace(`   💾 Using cached solutions (current search)`);
      return newCacheEntries[cacheKey];
    }

    const solutions = [];
    const totalActiveSlots = emptyGrid.flat().filter(cell => cell.active).length;

    // Calculate minimum pieces needed
    const avgCellsPerPiece = validPieces.reduce((sum, p) => {
      const pattern = p.shape.pattern;
      const cells = pattern.flat().filter(c => c === 1).length;
      return sum + cells;
    }, 0) / validPieces.length;

    const minPieces = Math.max(1, Math.floor(totalActiveSlots / avgCellsPerPiece));
    const maxPiecesToTry = Math.min(validPieces.length, 8);

    // Track shape type signatures
    const foundShapeTypeSignatures = new Set();

    const getShapeTypeSignature = (combination) => {
      const shapeCounts = {};
      combination.forEach(piece => {
        const shapeName = piece.shape.name;
        shapeCounts[shapeName] = (shapeCounts[shapeName] || 0) + 1;
      });
      return Object.keys(shapeCounts)
        .sort()
        .map(name => `${name}:${shapeCounts[name]}`)
        .join(',');
    };

    // Try different piece counts
    for (let numPieces = minPieces; numPieces <= maxPiecesToTry && solutions.length < 15; numPieces++) {
      const combinations = getCombinations(validPieces, numPieces);

      for (let i = 0; i < combinations.length && solutions.length < 15; i++) {
        const combination = combinations[i];
        const shapeTypeSignature = getShapeTypeSignature(combination);

        if (foundShapeTypeSignatures.has(shapeTypeSignature)) {
          continue;
        }

        const solution = tryPlacePieceCombination(emptyGrid, combination);

        if (solution) {
          foundShapeTypeSignatures.add(shapeTypeSignature);
          solutions.push(solution);
        }
      }
    }

    // Cache the solutions if cache object provided
    if (newCacheEntries !== null) {
      newCacheEntries[cacheKey] = solutions;
    }

    return solutions;
  };

  const handleSelectBestWeapon = (weaponResult) => {
    autoSolveLogger.info('Selecting weapon', weaponResult.weapon.name);
    setSelectedWeapon(weaponResult.weapon);
    setShowBestWeaponModal(false);
    // Grid will be re-initialized by useEffect
  };

  const handleShareBuild = async () => {
    try {
      setSharing(true);
      setShareError(null);

      // Optimized serialization: Only store placed pieces with anchor coordinates
      // This eliminates storing empty cells and redundant data
      const placedPieces = [];
      const seenPieces = new Set(); // Track unique pieces by anchor position

      gridState.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell.piece) {
            const pieceKey = `${cell.piece.anchorRow},${cell.piece.anchorCol}`;

            // Only store each piece once (at its anchor position)
            if (!seenPieces.has(pieceKey)) {
              seenPieces.add(pieceKey);
              placedPieces.push({
                row: cell.piece.anchorRow,
                col: cell.piece.anchorCol,
                shapeId: cell.piece.shapeId,
                rarity: cell.piece.rarity,
                level: cell.piece.level,
                rotation: cell.piece.rotation
              });
            }
          }
        });
      });

      // Optimized inventory: Only store non-null items with their slot index
      const inventoryItems = inventory
        .map((item, index) => item ? {
          slot: index,
          shapeId: item.shapeId,
          rarity: item.rarity,
          level: item.level
        } : null)
        .filter(item => item !== null);

      const buildData = {
        name: buildName || 'Unnamed Build',
        weaponId: selectedWeapon?.id,
        pieces: placedPieces,
        inventory: inventoryItems
      };

      logger.debug('Sharing build', {
        name: buildData.name,
        weaponId: buildData.weaponId,
        placedPieces: gridState.flatMap(row => row.filter(cell => cell.piece !== null)).length,
        inventoryItems: inventory.filter(i => i !== null).length
      });

      const configResponse = await fetch('/wiki-config.json');
      const config = await configResponse.json();
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      // Save build and get checksum (returns string, not object)
      const checksum = await saveSharedBuild(owner, repo, 'soul-weapon-engraving', buildData);

      logger.debug('Generated checksum', { checksum });

      // Generate share URL
      const baseURL = window.location.origin + window.location.pathname;
      const shareURL = generateShareUrl(baseURL, 'soul-weapon-engraving', checksum);

      await navigator.clipboard.writeText(shareURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      logger.info('Share URL copied to clipboard');

      // Trigger donation prompt on successful share
      window.triggerDonationPrompt?.({
        messages: [
          "Sharing your 200 IQ grid! 🧩",
          "That engraving is art! 🎨",
          "Flex that perfect fit! 💪",
          "Your optimization game is strong! 🎯",
        ]
      });

    } catch (error) {
      logger.error('Failed to share build', { error });
      setShareError(`Failed to share: ${error.message}`);
    } finally {
      setSharing(false);
    }
  };

  const handleExportBuild = () => {
    // Optimized serialization (same as share logic)
    const placedPieces = [];
    const seenPieces = new Set();

    gridState.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell.piece) {
          const pieceKey = `${cell.piece.anchorRow},${cell.piece.anchorCol}`;

          if (!seenPieces.has(pieceKey)) {
            seenPieces.add(pieceKey);
            placedPieces.push({
              row: cell.piece.anchorRow,
              col: cell.piece.anchorCol,
              shapeId: cell.piece.shapeId,
              rarity: cell.piece.rarity,
              level: cell.piece.level,
              rotation: cell.piece.rotation
            });
          }
        }
      });
    });

    const inventoryItems = inventory
      .map((item, index) => item ? {
        slot: index,
        shapeId: item.shapeId,
        rarity: item.rarity,
        level: item.level
      } : null)
      .filter(item => item !== null);

    const buildData = {
      name: buildName || 'Unnamed Build',
      weaponId: selectedWeapon?.id,
      weaponName: selectedWeapon?.name,
      pieces: placedPieces,
      inventory: inventoryItems,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(buildData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${buildName || 'soul-weapon-engraving'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Trigger donation prompt on successful export
    window.triggerDonationPrompt?.({
      messages: [
        "Backing up that masterpiece! 💾",
        "Engraving data secured! 🛡️",
        "Puzzle archived for posterity! 📦",
        "Smart move saving that! 💡",
      ]
    });
  };

  const handleImportBuild = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result);

        if (data.weaponId) {
          const baseWeapon = allWeapons.find(w => w.id === data.weaponId);
          const gridWeapon = weapons.find(w => w.id === data.weaponId);

          if (gridWeapon && baseWeapon) {
            // Merge grid data with base weapon data
            const mergedWeapon = {
              ...gridWeapon,
              image: baseWeapon.image,
              attack: baseWeapon.attack,
              requirements: baseWeapon.requirements
            };
            // Mark this weapon as already initialized to prevent re-initialization
            hasInitializedGridForWeapon.current = `${mergedWeapon.id}-${mergedWeapon.name}`;
            setSelectedWeapon(mergedWeapon);
          } else if (baseWeapon) {
            // No grid data, use base weapon
            // Mark this weapon as already initialized to prevent re-initialization
            hasInitializedGridForWeapon.current = `${baseWeapon.id}-${baseWeapon.name}`;
            setSelectedWeapon(baseWeapon);
          }
        }

        if (data.name) setBuildName(data.name);

        // Support both old format (gridState) and new optimized format (pieces)
        if (data.pieces) {
          // New optimized format
          const gridWeapon = weapons.find(w => w.id === data.weaponId);
          if (gridWeapon) {
            const gridSize = gridWeapon.gridType === '4x4' ? 4 : 5;
            const newGrid = Array(gridSize).fill(null).map(() =>
              Array(gridSize).fill(null).map(() => ({
                active: false,
                piece: null
              }))
            );

            gridWeapon.activeSlots.forEach(slot => {
              if (slot.row < gridSize && slot.col < gridSize) {
                newGrid[slot.row][slot.col].active = true;
              }
            });

            data.pieces.forEach(piece => {
              const shape = engravings.find(e => e.id === piece.shapeId);
              if (shape) {
                const pattern = getRotatedPattern(shape.pattern, piece.rotation);

                for (let pRow = 0; pRow < pattern.length; pRow++) {
                  for (let pCol = 0; pCol < pattern[pRow].length; pCol++) {
                    if (pattern[pRow][pCol] === 1) {
                      const gridRow = piece.row + pRow;
                      const gridCol = piece.col + pCol;

                      if (gridRow < gridSize && gridCol < gridSize) {
                        newGrid[gridRow][gridCol].piece = {
                          shapeId: piece.shapeId,
                          shape: shape,
                          rarity: piece.rarity,
                          level: piece.level,
                          rotation: piece.rotation,
                          anchorRow: piece.row,
                          anchorCol: piece.col
                        };
                      }
                    }
                  }
                }
              }
            });

            setGridState(newGrid);
          }
        } else if (data.gridState) {
          // Legacy format (backward compatibility)
          const deserializedGridState = data.gridState.map(row =>
            row.map(cell => ({
              active: cell.active,
              piece: cell.piece ? {
                ...cell.piece,
                shape: engravings.find(e => e.id === cell.piece.shapeId)
              } : null
            }))
          );
          setGridState(deserializedGridState);
        }

        // Handle both array of items and array with slot indices
        if (data.inventory) {
          let deserializedInventory = Array(8).fill(null);

          if (Array.isArray(data.inventory)) {
            if (data.inventory.length > 0 && data.inventory[0]?.slot !== undefined) {
              // New format
              data.inventory.forEach(item => {
                if (item && item.slot !== undefined && item.slot < 8) {
                  deserializedInventory[item.slot] = {
                    shapeId: item.shapeId,
                    rarity: item.rarity,
                    level: item.level,
                    shape: engravings.find(e => e.id === item.shapeId)
                  };
                }
              });
            } else {
              // Legacy format
              deserializedInventory = data.inventory.map(item => item ? {
                ...item,
                shape: engravings.find(e => e.id === item.shapeId)
              } : null);
            }
          }

          setInventory(deserializedInventory);
        }

        setHasUnsavedChanges(true);

        // Trigger donation prompt on successful import
        window.triggerDonationPrompt?.({
          messages: [
            "Importing pro layouts! 📥",
            "Fresh puzzle incoming! 🧩",
            "Time to test this build! ⚡",
            "Let's see this engraving! 👀",
          ]
        });
      } catch (error) {
        alert('Failed to import build: Invalid file format');
        logger.error('Import error', { error });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getRarityColor = (rarity) => {
    const colors = [
      '#9CA3AF', // Common - Gray
      '#10B981', // Great - Green
      '#F59E0B', // Rare - Orange
      '#8B5CF6', // Epic - Purple
      '#EF4444', // Legendary - Red
      '#3B82F6'  // Mythic - Blue
    ];
    return colors[rarity] || colors[0];
  };

  const getRarityName = (rarity) => {
    const names = ['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    return names[rarity] || 'Common';
  };

  const getRarityImageName = (rarity) => {
    const names = ['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    return names[rarity] || 'Common';
  };

  // Helper to check if two cells are adjacent (for drawing lines)
  const areAdjacent = (row1, col1, row2, col2) => {
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  };

  // Get all filled cells for a piece pattern
  const getFilledCells = (pattern, anchorRow, anchorCol) => {
    const cells = [];
    pattern.forEach((patternRow, pRow) => {
      patternRow.forEach((cell, pCol) => {
        if (cell === 1) {
          cells.push({
            row: anchorRow + pRow,
            col: anchorCol + pCol,
            patternRow: pRow,
            patternCol: pCol
          });
        }
      });
    });
    return cells;
  };

  // Calculate adjusted cell size that compensates for gaps
  // Formula: adjustedCellSize = cellSize - ((gridSize - 1) * GAP_SIZE) / gridSize
  // This ensures: gridSize * adjustedCellSize + (gridSize - 1) * GAP_SIZE = gridSize * cellSize
  const getAdjustedCellSize = (gridSize) => {
    return cellSize - ((gridSize - 1) * GAP_SIZE) / gridSize;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  const completionBonus = getCompletionBonus();
  // Use submission gridType if available (community submissions), otherwise use weapon gridType
  const effectiveGridType = currentSubmissionMeta?.gridType || selectedWeapon?.gridType || '5x5';
  const gridSize = effectiveGridType === '4x4' ? 4 : 5;
  const adjustedCellSize = getAdjustedCellSize(gridSize);
  const currentScale = autoScale ? calculatedScale : gridScale; // Use auto or manual scale

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Soul Weapon Engraving
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Drag and drop engraving pieces onto the grid to plan your layout
        </p>
      </div>

      {/* Saved Builds Panel */}
      {!isModal && (
        <SavedBuildsPanel
          currentBuild={{ gridState, inventory }}
          buildName={buildName}
          maxSlots={null}
          onLoadBuild={handleLoadBuild}
          allowSavingBuilds={false}
          currentLoadedBuildId={currentLoadedBuildId}
          onBuildsChange={setSavedBuilds}
          defaultExpanded={false}
          externalBuilds={savedBuilds}
          buildType="engraving-builds"
          buildData={{
            name: buildName,
            weaponId: selectedWeapon?.id,
            weaponName: selectedWeapon?.name,
            gridState: serializeBuild({ name: buildName }).gridState,
            inventory: serializeBuild({ name: buildName }).inventory
          }}
        />
      )}

      {/* Build Name Panel - Controlled by allowSavingBuilds */}
      {allowSavingBuilds && !isModal && (
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap pt-2">Build Name:</label>
            <div className="flex-1">
              <ValidatedInput
                value={buildName}
                onChange={(e) => {
                  setBuildName(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                validator={validateBuildName}
                placeholder="Enter build name..."
                maxLength={STRING_LIMITS.BUILD_NAME_MAX}
                required={isAuthenticated}
                showCounter={true}
                validateOnBlur={false}
                className="w-full"
              />
            </div>
            {isAuthenticated && (
              <button
                onClick={saveBuild}
                disabled={saving || saveSuccess}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Build</span>
                  </>
                )}
              </button>
            )}
          </div>
          {/* Save Error Message */}
          {saveError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
              {saveError}
            </div>
          )}
        </div>
      )}

      {/* Actions Panel */}
      {!isModal && (
        <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleShareBuild}
              disabled={sharing || !selectedWeapon}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {sharing ? (
                <>
                  <Loader className="w-4 h-4 flex-shrink-0 animate-spin text-blue-600 dark:text-blue-400" />
                  <span>Generating...</span>
                </>
              ) : copied ? (
                <>
                  <Check className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Share</span>
                </>
              )}
            </button>

            <button
              onClick={handleExportBuild}
              disabled={!selectedWeapon}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 flex-shrink-0 text-green-600 dark:text-green-400" />
              <span>Export</span>
            </button>

            <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">
              <Upload className="w-4 h-4 flex-shrink-0 text-purple-600 dark:text-purple-400" />
              <span>Import</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBuild}
                className="hidden"
              />
            </label>

            <button
              onClick={handleClearBuild}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
              <span>Clear</span>
            </button>

            {/* Grid Scale Control - Hidden for now (may show again later) */}
            {false && (
              <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                  Grid Scale:
                </label>

                {/* Auto-scale toggle */}
                <button
                  onClick={() => setAutoScale(!autoScale)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    autoScale
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={autoScale ? 'Auto-fit enabled' : 'Manual scale'}
                >
                  {autoScale ? 'Auto' : 'Manual'}
                </button>

                {/* Manual scale slider - only show when auto-scale is off */}
                {!autoScale && (
                  <>
                    <input
                      type="range"
                      min={GRID_SCALE_MIN}
                      max={GRID_SCALE_MAX}
                      step={GRID_SCALE_STEP}
                      value={gridScale}
                      onChange={(e) => setGridScale(parseFloat(e.target.value))}
                      className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      title="Adjust grid size"
                    />
                  </>
                )}

                {/* Display current scale */}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 w-12">
                  {Math.round(currentScale * 100)}%
                </span>
              </div>
            )}

            {/* Debug button - only in development */}
            {import.meta.env.DEV && (
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`flex items-center justify-center gap-2 px-4 py-2 border-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  debugMode
                    ? 'bg-yellow-500 border-yellow-600 text-white'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                }`}
                title="Toggle debug hitbox visualization"
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                <span>Debug {debugMode ? 'ON' : 'OFF'}</span>
              </button>
            )}
          </div>
          {shareError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
              {shareError}
            </div>
          )}
        </div>
      )}

      {/* Weapon Selector */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Soul Weapon Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Soul Weapon
            </label>
            <CustomDropdown
              value={selectedWeapon?.id}
              selectedOptionOverride={selectedWeapon ? (() => {
                const gridData = weapons.find(gw => gw.name === selectedWeapon.name);
                let description = '';
                if (gridData) {
                  description = `${gridData.gridType} Grid • ATK +${gridData.completionEffect.atk}% HP +${gridData.completionEffect.hp}%`;
                } else if (weaponsWithSubmissions.has(selectedWeapon.name)) {
                  description = 'Community Entry (Unverified)';
                } else {
                  description = 'Designer Mode (No Grid Data)';
                }
                return {
                  value: selectedWeapon.id,
                  label: selectedWeapon.name,
                  image: selectedWeapon.image,
                  description: description
                };
              })() : null}
              onChange={(value) => handleWeaponChange(value)}
              placeholder="Select a Soul Weapon"
              options={allWeapons.filter(w => w.id <= highestUnlockedWeapon).map(weapon => {
                // Check if this weapon has grid data
                const gridData = weapons.find(gw => gw.name === weapon.name);
                let description = '';
                if (gridData) {
                  description = `${gridData.gridType} Grid • ATK +${gridData.completionEffect.atk}% HP +${gridData.completionEffect.hp}%`;
                } else if (weaponsWithSubmissions.has(weapon.name)) {
                  description = 'Community Entry (Unverified)';
                } else {
                  description = 'Designer Mode (No Grid Data)';
                }

                return {
                  value: weapon.id,
                  label: weapon.name,
                  image: weapon.image,
                  description: description
                };
              })}
            />
          </div>

          {/* Highest Unlocked Weapon */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Highest Unlocked Weapon
            </label>
            <div className="flex items-center gap-2">
              <CustomDropdown
                value={highestUnlockedWeapon}
                selectedOptionOverride={(() => {
                  const weapon = allWeapons.find(w => w.id === highestUnlockedWeapon);
                  return weapon ? {
                    value: weapon.id,
                    label: weapon.name,
                    image: weapon.image,
                    description: `${weapon.attack?.toLocaleString() || 'N/A'} ATK`
                  } : null;
                })()}
                onChange={(value) => {
                  const newValue = parseInt(value, 10);
                  setHighestUnlockedWeapon(newValue);
                  // If current weapon is now locked, switch to highest unlocked
                  if (selectedWeapon && selectedWeapon.id > newValue) {
                    const highestAvailable = allWeapons.find(w => w.id === newValue);
                    if (highestAvailable) {
                      handleWeaponChange(newValue);
                    }
                  }
                }}
                placeholder="Select Highest Unlocked"
                className="flex-1"
                options={allWeapons.map(weapon => ({
                  value: weapon.id,
                  label: weapon.name,
                  image: weapon.image,
                  description: `${weapon.attack?.toLocaleString() || 'N/A'} ATK`
                }))}
              />
              <button
                onClick={() => setHighestUnlockedWeapon(57)}
                className="px-3 py-3 md:py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm md:text-sm font-medium transition-colors whitespace-nowrap shadow-sm touch-manipulation min-h-[44px]"
                title="Unlock all weapons"
              >
                All
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">{allWeapons.filter(w => w.id <= highestUnlockedWeapon).length} of {allWeapons.length} weapons unlocked</span>
              <span className="mx-1">•</span>
              <span>Filters weapon list and Best Weapon search</span>
            </p>
          </div>
        </div>
      </div>

      {/* Loading Submissions Indicator (shown when loading community submissions) */}
      {loadingSubmissions && !isGridDesigner && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <Loader className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Loading community submission...
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Fetching grid layout data from community contributions
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid Designer Mode (for weapons without grid data) */}
      {isGridDesigner && selectedWeapon && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 rounded-lg p-4 sm:p-6 mb-4 border-2 border-blue-300 dark:border-blue-700 shadow-lg relative">
          {/* Loading Overlay */}
          {loadingSubmissions && (
            <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm rounded-lg z-50 flex items-center justify-center">
              <div className="text-center">
                <Loader className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-3" />
                <p className="text-white font-medium">Loading submissions...</p>
                <p className="text-gray-300 text-sm mt-1">Fetching grid layout data</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Grid Designer Mode
              </h3>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{selectedWeapon.name}</strong> doesn't have grid layout data yet.
              Click cells to toggle active slots, enter completion effects, and submit the layout.
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2 italic">
              Your help is greatly appreciated in building this community resource!
            </p>

            {/* Error Loading Submissions */}
            {submissionLoadError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-200">
                      {submissionLoadError}
                    </p>
                    <button
                      onClick={() => loadExistingSubmissions()}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            )}

            {existingSubmissions.length > 0 && (
              <>
                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ {existingSubmissions.length} submission(s) already exist for this weapon.
                  Showing the primary layout (first submission).
                </div>
                <button
                  onClick={() => setForceDesignMode(false)}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Normal Mode
                </button>
              </>
            )}
          </div>

          {/* Grid Size Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Grid Size
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  gridLogger.debug('Grid type button clicked: 4x4');
                  setGridType('4x4');
                  initializeDesignerGrid('4x4'); // Pass new grid type directly
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  gridType === '4x4'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                4x4
              </button>
              <button
                onClick={() => {
                  gridLogger.debug('Grid type button clicked: 5x5');
                  setGridType('5x5');
                  initializeDesignerGrid('5x5'); // Pass new grid type directly
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  gridType === '5x5'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                5x5
              </button>
            </div>
          </div>

          {/* Designer Grid */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Grid Layout (Click cells to toggle)
            </label>
            <div className="inline-block bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-gray-300 dark:border-gray-600">
              <div className="grid gap-1" style={{
                gridTemplateColumns: `repeat(${gridType === '4x4' ? 4 : 5}, 1fr)`
              }}>
                {designerGrid.map((row, rowIdx) =>
                  row.map((cell, colIdx) => (
                    <button
                      key={`${rowIdx}-${colIdx}`}
                      onClick={() => toggleDesignerCell(rowIdx, colIdx)}
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded border-2 transition-all ${
                        cell.active
                          ? 'bg-blue-500 border-blue-600 hover:bg-blue-600 shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      title={`Row ${rowIdx}, Col ${colIdx}: ${cell.active ? 'Active' : 'Inactive'}`}
                    >
                      {cell.active && <Check className="w-6 h-6 sm:w-8 sm:h-8 text-white mx-auto" />}
                    </button>
                  ))
                )}
              </div>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 text-center">
                Active Slots: {designerGrid.flat().filter(c => c.active).length}
              </div>
            </div>
          </div>

          {/* Completion Effects */}
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <ValidatedInput
                label="ATK Completion Effect (%)"
                value={completionAtk}
                onChange={(e) => setCompletionAtk(e.target.value)}
                validator={(value) => validateCompletionEffect(value, 'ATK completion effect')}
                placeholder="e.g., 2% or 2.5%"
                maxLength={10}
                required={true}
                showCounter={false}
                validateOnBlur={false}
                className="w-full"
              />
            </div>
            <div>
              <ValidatedInput
                label="HP Completion Effect (%)"
                value={completionHp}
                onChange={(e) => setCompletionHp(e.target.value)}
                validator={(value) => validateCompletionEffect(value, 'HP completion effect')}
                placeholder="e.g., 5.6% or 10%"
                maxLength={10}
                required={true}
                showCounter={false}
                validateOnBlur={false}
                className="w-full"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            {/* Clear Grid Button for Designer Mode */}
            <button
              onClick={handleClearGrid}
              disabled={!designerGrid.some(row => row.some(cell => cell.active))}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
              title="Clear all active cells"
            >
              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span>Clear Grid</span>
            </button>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => submitGridLayout(false)}
                disabled={submitting || loadingSubmissions}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Submit Grid Layout</span>
                  </>
                )}
              </button>

              {existingSubmissions.length > 0 && (
                <button
                  onClick={() => submitGridLayout(true)}
                  disabled={submitting || loadingSubmissions}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      <span>Submit and Replace</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {!isAuthenticated && (
            <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded text-sm text-blue-800 dark:text-blue-200">
              ℹ️ You can submit anonymously, or sign in to attach your username
            </div>
          )}

          {loadingSubmissions && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Loader className="w-4 h-4 animate-spin" />
              <span>Loading existing submissions...</span>
            </div>
          )}
        </div>
      )}

      {/* Main Grid Area (hidden in designer mode) */}
      {!isGridDesigner && (
      <>
        {/* Community Submission Warning */}
        {(currentSubmissionMeta || (!weaponHasGridData() && existingSubmissions.length > 0)) && (
          <div className="mb-4 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-orange-900 dark:text-orange-200 mb-1">
                  Community Submission (Unverified)
                </h4>
                <p className="text-sm text-orange-800 dark:text-orange-300 mb-3">
                  This grid layout was submitted by <strong>{currentSubmissionMeta?.submittedBy || existingSubmissions[0]?.submittedBy || 'Anonymous'}</strong> and has not yet been officially verified.
                  It may contain errors or be incomplete.
                </p>
                <button
                  onClick={() => {
                    gridLogger.debug('Enter Design Mode clicked, setting forceDesignMode to true');
                    setForceDesignMode(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Enter Design Mode
                </button>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-2">
                  Design Mode allows you to edit and resubmit the grid layout
                </p>
              </div>
            </div>
          </div>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Grid Display */}
        <div
          ref={gridContainerRef}
          className="bg-white dark:bg-gray-900 rounded-lg p-2 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Engraving Grid
            </h2>
            <div className="flex items-center gap-2">
              {/* Debug badge - only in development */}
              {import.meta.env.DEV && debugMode && (
                <div className="text-xs font-mono bg-yellow-500 text-black px-2 py-1 rounded">
                  DEBUG MODE ACTIVE
                </div>
              )}
              {/* Auto-Solve Button */}
              <button
                onClick={handleAutoSolve}
                disabled={isSolving || inventory.filter(p => p !== null).length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                title="Find all possible complete solutions"
              >
                {isSolving ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{isSolving ? 'Solving...' : 'Auto-Solve'}</span>
              </button>
              {/* Clear Grid Button */}
              <button
                onClick={handleClearGrid}
                disabled={!gridState.some(row => row.some(cell => cell.piece))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
                title="Remove all pieces from grid"
              >
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="hidden sm:inline">Clear Grid</span>
              </button>
            </div>
          </div>

          {/* Debug Info Panel - only in development */}
          {import.meta.env.DEV && debugMode && draggingPiece && (
            <div className="mb-4 p-3 bg-black/90 border-2 border-yellow-400 rounded-lg text-xs font-mono text-yellow-400">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Dragging:</strong> {draggingPiece.shape.name}</div>
                <div><strong>Rotation:</strong> {currentDragRotation}°</div>
                <div><strong>Pattern Offset:</strong> ({dragPatternOffset.row}, {dragPatternOffset.col})</div>
                <div><strong>Anchor Pos:</strong> {previewPosition ? `(${previewPosition.row}, ${previewPosition.col})` : 'None'}</div>
                <div><strong>Pattern Size:</strong> {draggingPiece.shape.pattern.length}x{draggingPiece.shape.pattern[0].length}</div>
                <div><strong>Valid Cells:</strong> {dragPreviewCells.filter(c => c.valid).length}</div>
                <div><strong>Invalid Cells:</strong> {dragPreviewCells.filter(c => !c.valid).length}</div>
              </div>
              <div className="mt-2 pt-2 border-t border-yellow-400/30">
                <strong>Highlighted Cells:</strong> {dragPreviewCells.map(c => `(${c.row},${c.col})`).join(', ') || 'None'}
              </div>
            </div>
          )}

          {/* Grid Container with Scaling */}
          <div className="flex justify-center items-start">
            <div className="relative inline-block" style={{
              transform: `scale(${currentScale})`,
              transformOrigin: 'center top',
              marginBottom: `${(currentScale - 1) * GRID_SCALE_MARGIN_MULTIPLIER}px`
            }}>
            <div
              ref={gridRef}
              className={`grid gap-1 p-2 rounded-lg relative ${isGridComplete() ? 'bg-gradient-to-br from-cyan-400/20 to-blue-500/20 ring-1 ring-cyan-400' : 'bg-gray-900 dark:bg-black'}`}
              style={{
                gridTemplateColumns: `repeat(${gridSize}, ${adjustedCellSize}px)`,
                gridTemplateRows: `repeat(${gridSize}, ${adjustedCellSize}px)`,
                touchAction: touchDragging ? 'none' : 'auto'
              }}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onPointerMove={(e) => {
                if (e.pointerType === 'touch' && touchDragging) {
                  touchLogger.trace('onPointerMove (touch) on grid');
                  const fakeTouch = { clientX: e.clientX, clientY: e.clientY };
                  const fakeTouchEvent = {
                    ...e,
                    touches: [fakeTouch],
                    changedTouches: [fakeTouch],
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                  };
                  handleTouchMove(fakeTouchEvent);
                }
              }}
              onPointerUp={(e) => {
                if (e.pointerType === 'touch' && touchDragging) {
                  touchLogger.trace('onPointerUp (touch) on grid');
                  const fakeTouch = { clientX: e.clientX, clientY: e.clientY };
                  const fakeTouchEvent = {
                    ...e,
                    touches: [],
                    changedTouches: [fakeTouch],
                    preventDefault: () => e.preventDefault(),
                    stopPropagation: () => e.stopPropagation()
                  };
                  handleTouchEnd(fakeTouchEvent);
                }
              }}
            >
              {/* Background Weapon Image */}
              {selectedWeapon?.image && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{
                    opacity: 0.2,
                    zIndex: 5
                  }}
                >
                  <img
                    src={selectedWeapon.image}
                    alt=""
                    className="w-full h-full object-contain p-4"
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.3))',
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                  />
                </div>
              )}

              {/* Grid Cells */}
              {gridState.map((row, rowIndex) => {
                return row.map((cell, colIndex) => {
                  // Check if this cell is in the drag preview
                  const previewCell = dragPreviewCells.find(
                    pc => pc.row === rowIndex && pc.col === colIndex
                  );

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      onDragOver={(e) => {
                        gridLogger.trace(`DragOver fired on cell [${rowIndex}][${colIndex}]`);
                        handleDragOver(e, rowIndex, colIndex);
                      }}
                      onDragEnter={(e) => {
                        gridLogger.trace(`DragEnter on cell [${rowIndex}][${colIndex}]`);
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        gridLogger.trace(`Drop on cell [${rowIndex}][${colIndex}]`);
                        handleDrop(e, rowIndex, colIndex);
                      }}
                      className={`
                        border-2 transition-all relative
                        ${cell.active ? 'bg-gray-700 dark:bg-gray-600 border-gray-600 dark:border-gray-500' : 'bg-gray-900 dark:bg-black border-gray-800 dark:border-gray-900 opacity-30'}
                      `}
                      style={{
                        width: `${adjustedCellSize}px`,
                        height: `${adjustedCellSize}px`,
                        zIndex: 1,
                        backgroundColor: previewCell
                          ? previewCell.valid
                            ? 'rgba(34, 197, 94, 0.4)' // Green if valid
                            : 'rgba(239, 68, 68, 0.4)' // Red if invalid
                          : undefined,
                        borderColor: previewCell
                          ? previewCell.valid
                            ? '#22c55e' // Green border
                            : '#ef4444' // Red border
                          : undefined,
                        boxShadow: previewCell
                          ? previewCell.valid
                            ? '0 0 10px rgba(34, 197, 94, 0.6), inset 0 0 10px rgba(34, 197, 94, 0.3)'
                            : '0 0 10px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(239, 68, 68, 0.3)'
                          : undefined
                      }}
                    >
                      {/* Piece indicator dot if occupied (hidden during drag/place operations) */}
                      {cell.piece && !placingPiece && !draggingPiece && (
                        <div
                          className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-blue-500/20 transition-colors"
                          onClick={() => handleUnsocketPiece(rowIndex, colIndex)}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getRarityColor(cell.piece.rarity) }}
                            title="Click to unsocket and reposition"
                          />
                        </div>
                      )}
                    </div>
                  );
                });
              })}

              {/* Dragging Preview Overlay - Shows piece following cursor during drag */}
              {draggingPiece && previewPosition && !placingPiece && (() => {
                
                const pattern = getRotatedPattern(draggingPiece.shape.pattern, currentDragRotation);
                const filledCells = getFilledCells(pattern, previewPosition.row, previewPosition.col);
                
                const rarityColor = getRarityColor(draggingPiece.rarity);
                const rarityImageName = getRarityImageName(draggingPiece.rarity);
                const isValid = canPlacePiece(previewPosition.row, previewPosition.col, pattern);
                

                return (
                  <>
                    {/* Draw lines between adjacent gems */}
                    {filledCells.map((cell1, idx1) =>
                      filledCells.slice(idx1 + 1).map((cell2, idx2) => {
                        if (areAdjacent(cell1.row, cell1.col, cell2.row, cell2.col)) {
                          const isHorizontal = cell1.row === cell2.row;
                          const lineThickness = LINE_THICKNESS;

                          if (isHorizontal) {
                            const leftCol = Math.min(cell1.col, cell2.col);
                            const x = GRID_PADDING + leftCol * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const y = GRID_PADDING + cell1.row * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const width = adjustedCellSize + GAP_SIZE;

                            return (
                              <div
                                key={`drag-line-h-${cell1.row}-${cell1.col}-${cell2.col}`}
                                className="absolute pointer-events-none"
                                style={{
                                  left: `${x}px`,
                                  top: `${y - lineThickness / 2}px`,
                                  width: `${width}px`,
                                  height: `${lineThickness}px`,
                                  backgroundColor: rarityColor,
                                  opacity: 0.6,
                                  zIndex: 20,
                                  filter: isValid
                                    ? 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))'
                                    : 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))'
                                }}
                              />
                            );
                          } else {
                            const topRow = Math.min(cell1.row, cell2.row);
                            const x = GRID_PADDING + cell1.col * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const y = GRID_PADDING + topRow * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const height = adjustedCellSize + GAP_SIZE;

                            return (
                              <div
                                key={`drag-line-v-${cell1.row}-${cell2.row}-${cell1.col}`}
                                className="absolute pointer-events-none"
                                style={{
                                  left: `${x - lineThickness / 2}px`,
                                  top: `${y}px`,
                                  width: `${lineThickness}px`,
                                  height: `${height}px`,
                                  backgroundColor: rarityColor,
                                  opacity: 0.6,
                                  zIndex: 20,
                                  filter: isValid
                                    ? 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))'
                                    : 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))'
                                }}
                              />
                            );
                          }
                        }
                        return null;
                      })
                    )}

                    {/* Draw gems at each filled cell */}
                    {filledCells.map((filledCell) => {
                      const imgSrc = `/images/equipment/soul-weapons/SoulGem_${rarityImageName}_Base.png`;
                      
                      return (
                        <div
                          key={`drag-gem-${filledCell.row}-${filledCell.col}`}
                          className="absolute pointer-events-none"
                          style={{
                            left: `${GRID_PADDING + filledCell.col * (adjustedCellSize + GAP_SIZE)}px`,
                            top: `${GRID_PADDING + filledCell.row * (adjustedCellSize + GAP_SIZE)}px`,
                            width: `${adjustedCellSize}px`,
                            height: `${adjustedCellSize}px`,
                            zIndex: 21,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            filter: isValid
                              ? 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.8))'
                              : 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))'
                          }}
                        >
                          <img
                            src={imgSrc}
                            alt="gem"
                            className="w-full h-full object-contain opacity-70"
                            onLoad={() => {}}
                            onError={(e) => {
                              gridLogger.error(`Drag preview gem failed to load`, { imgSrc });
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      );
                    })}
                  </>
                );
              })()}

              {/* Placing Piece Overlay - Render as individual gems + lines */}
              {placingPiece && placingPosition && (() => {
                const isValid = isCurrentPlacementValid();
                const pattern = getRotatedPattern(placingPiece.shape.pattern, placingRotation);
                const filledCells = getFilledCells(pattern, placingPosition.row, placingPosition.col);
                const rarityColor = getRarityColor(placingPiece.rarity);
                const rarityImageName = getRarityImageName(placingPiece.rarity);

                return (
                  <>
                    {/* Draw lines between adjacent gems */}
                    {filledCells.map((cell1, idx1) =>
                      filledCells.slice(idx1 + 1).map((cell2, idx2) => {
                        if (areAdjacent(cell1.row, cell1.col, cell2.row, cell2.col)) {
                          const isHorizontal = cell1.row === cell2.row;
                          const lineThickness = LINE_THICKNESS;

                          if (isHorizontal) {
                            const leftCol = Math.min(cell1.col, cell2.col);
                            const x = GRID_PADDING + leftCol * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const y = GRID_PADDING + cell1.row * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const width = adjustedCellSize + GAP_SIZE;

                            return (
                              <div
                                key={`placing-line-h-${cell1.row}-${cell1.col}-${cell2.col}`}
                                className="absolute pointer-events-none"
                                style={{
                                  left: `${x}px`,
                                  top: `${y - lineThickness / 2}px`,
                                  width: `${width}px`,
                                  height: `${lineThickness}px`,
                                  backgroundColor: rarityColor,
                                  opacity: 0.7,
                                  zIndex: 9,
                                  filter: isValid
                                    ? 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))'
                                    : 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))'
                                }}
                              />
                            );
                          } else {
                            const topRow = Math.min(cell1.row, cell2.row);
                            const x = GRID_PADDING + cell1.col * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const y = GRID_PADDING + topRow * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const height = adjustedCellSize + GAP_SIZE;

                            return (
                              <div
                                key={`placing-line-v-${cell1.row}-${cell2.row}-${cell1.col}`}
                                className="absolute pointer-events-none"
                                style={{
                                  left: `${x - lineThickness / 2}px`,
                                  top: `${y}px`,
                                  width: `${lineThickness}px`,
                                  height: `${height}px`,
                                  backgroundColor: rarityColor,
                                  opacity: 0.7,
                                  zIndex: 9,
                                  filter: isValid
                                    ? 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))'
                                    : 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))'
                                }}
                              />
                            );
                          }
                        }
                        return null;
                      })
                    )}

                    {/* Draw gems at each filled cell */}
                    {filledCells.map((filledCell) => (
                      <div
                        key={`placing-gem-${filledCell.row}-${filledCell.col}`}
                        data-draggable-piece="true"
                        draggable={true}
                        onDragStart={(e) => {
                          gridLogger.trace('Starting reposition from placing mode');
                          // Start dragging from placing mode - just set up drag state
                          setDragPatternOffset({ row: filledCell.patternRow, col: filledCell.patternCol });
                          const dragPieceData = {
                            shapeId: placingPiece.shapeId,
                            shape: placingPiece.shape,
                            rarity: placingPiece.rarity,
                            level: placingPiece.level
                          };
                          e.dataTransfer.effectAllowed = 'move';

                          // Clear placing mode and enter dragging mode
                          setTimeout(() => {
                            setDraggingPiece(dragPieceData);
                            setCurrentDragRotation(placingRotation);
                            setDraggingIndex(placingInventoryIndex);
                            setDraggingFromGrid(draggingFromGrid); // Preserve if moving from grid
                            // Clear placing state
                            setPlacingPiece(null);
                            setPlacingPosition(null);
                            gridLogger.trace('Switched from placing to dragging mode');
                          }, 0);
                        }}
                        onDragEnd={handleDragEnd}
                        className="absolute cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity"
                        style={{
                          left: `${GRID_PADDING + filledCell.col * (adjustedCellSize + GAP_SIZE)}px`,
                          top: `${GRID_PADDING + filledCell.row * (adjustedCellSize + GAP_SIZE)}px`,
                          width: `${adjustedCellSize}px`,
                          height: `${adjustedCellSize}px`,
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          filter: isValid
                            ? 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.8))'
                            : 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))'
                        }}
                      >
                        <img
                          src={`/images/equipment/soul-weapons/SoulGem_${rarityImageName}_Base.png`}
                          alt="gem"
                          draggable={false}
                          className="w-full h-full object-contain opacity-80"
                          style={{ pointerEvents: 'none' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </>
                );
              })()}

              {/* Placed Pieces Overlay - Render as individual gems + lines */}
              {/* Always render, but skip the specific piece being dragged (handled inside the loop) */}
              {(() => {
                
                

                // Track which pieces we've already rendered to avoid duplicates
                const renderedPieces = new Set();

                return gridState.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    // If this cell has a piece and we haven't rendered this piece yet
                    if (cell.piece) {
                      const pieceKey = `${cell.piece.anchorRow}-${cell.piece.anchorCol}`;

                      // Skip if we already rendered this piece
                      if (renderedPieces.has(pieceKey)) {
                        return null;
                      }

                      // Skip if this is the piece currently being dragged
                      if (draggingFromGrid &&
                          cell.piece.anchorRow === draggingFromGrid.anchorRow &&
                          cell.piece.anchorCol === draggingFromGrid.anchorCol) {
                        
                        return null;
                      }

                      // Mark as rendered
                      renderedPieces.add(pieceKey);

                      

                      return (
                        <EngravingPiece
                          key={`piece-${cell.piece.anchorRow}-${cell.piece.anchorCol}`}
                          piece={cell.piece}
                          cellSize={adjustedCellSize}
                          gapSize={GAP_SIZE}
                          gridPadding={GRID_PADDING}
                          lineThickness={LINE_THICKNESS}
                          interactive={true}
                          onDragStart={handleDragPlacedPiece}
                          onDragEnd={handleDragEnd}
                          onTouchStart={handleTouchStartPlacedPiece}
                          onClick={handleClickPlacedPiece}
                          zIndexBase={10}
                        />
                      );
                    }
                    return null;
                  })
                );
              })()}

              {/* Debug Hitbox Visualization - only in development */}
              {import.meta.env.DEV && debugMode && draggingPiece && previewPosition && (
                <div
                  className="absolute pointer-events-none z-50"
                  style={{
                    left: `${GRID_PADDING + previewPosition.col * (adjustedCellSize + GAP_SIZE)}px`,
                    top: `${GRID_PADDING + previewPosition.row * (adjustedCellSize + GAP_SIZE)}px`,
                  }}
                >
                  {/* Draw the pattern grid */}
                  {(() => {
                    const pattern = getRotatedPattern(draggingPiece.shape.pattern, currentDragRotation);
                    const patternHeight = pattern.length;
                    const patternWidth = pattern[0].length;

                    return (
                      <div
                        className="relative"
                        style={{
                          width: `${patternWidth * (adjustedCellSize + GAP_SIZE) - GAP_SIZE}px`,
                          height: `${patternHeight * (adjustedCellSize + GAP_SIZE) - GAP_SIZE}px`,
                        }}
                      >
                        {/* Draw grid cells */}
                        {pattern.map((row, pRow) =>
                          row.map((cell, pCol) => (
                            <div
                              key={`debug-${pRow}-${pCol}`}
                              className="absolute border-2 flex items-center justify-center"
                              style={{
                                left: `${pCol * (adjustedCellSize + GAP_SIZE)}px`,
                                top: `${pRow * (adjustedCellSize + GAP_SIZE)}px`,
                                width: `${adjustedCellSize}px`,
                                height: `${adjustedCellSize}px`,
                                borderColor: cell === 1 ? '#fbbf24' : '#6b7280',
                                backgroundColor: cell === 1 ? 'rgba(251, 191, 36, 0.3)' : 'rgba(107, 114, 128, 0.2)',
                                borderStyle: cell === 1 ? 'solid' : 'dashed',
                              }}
                            >
                              {/* Cell coordinate label */}
                              <div className="text-xs font-mono text-yellow-400 font-bold">
                                {cell === 1 ? '1' : '0'}
                              </div>
                            </div>
                          ))
                        )}

                        {/* Pattern info box */}
                        <div
                          className="absolute bg-black/90 text-white px-2 py-1 rounded text-xs font-mono border border-yellow-400"
                          style={{
                            top: '-30px',
                            left: '0',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Pattern: {patternHeight}x{patternWidth} | Rotation: {currentDragRotation}° | Shape: {draggingPiece.shape.name}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Backdrop for auto-socket/remove on outside click */}
            {placingPiece && placingPosition && (
              <div
                className="fixed inset-0 z-[5]"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => {
                  // Check if click is outside the buttons and piece
                  const target = e.target;
                  const clickedOnButtons = target.closest('.placement-buttons');
                  const clickedOnPiece = target.closest('[data-draggable-piece="true"]');

                  if (!clickedOnButtons && !clickedOnPiece) {
                    gridLogger.trace('👆 Clicked outside piece - auto-socketing or removing');
                    const isValid = isCurrentPlacementValid();
                    if (isValid) {
                      gridLogger.trace('✓ Valid placement - auto-confirming');
                      handleConfirmPlacement();
                    } else {
                      gridLogger.trace('❌ Invalid placement - auto-canceling');
                      handleCancelPlacement();
                    }
                  }
                }}
              />
            )}

            {/* Placement Confirmation Buttons */}
            {placingPiece && placingPosition && placingButtonPosition && (() => {
              const isValid = isCurrentPlacementValid();
              return (
                <div
                  className="placement-buttons absolute flex gap-2 z-[100]"
                  style={{
                    left: `${placingButtonPosition.left}px`,
                    top: `${placingButtonPosition.top}px`,
                  }}
                >
                  <button
                    onClick={handleConfirmPlacement}
                    disabled={!isValid}
                    className={`p-2 text-white rounded-lg shadow-lg transition-colors ${
                      isValid
                        ? 'bg-green-600 hover:bg-green-700 cursor-pointer'
                        : 'bg-gray-500 cursor-not-allowed opacity-50'
                    }`}
                    title={isValid ? "Confirm placement" : "Cannot place here - invalid position"}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleRotatePlacing}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-colors"
                    title="Rotate piece (90° clockwise)"
                  >
                    <RotateCw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleCancelPlacement}
                    className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg transition-colors"
                    title="Cancel and return to inventory"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              );
            })()}

            {/* Completion Effect - Inside scaling wrapper */}
            {completionBonus && (
              <div className="mt-2 p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400 rounded-lg" style={{
                maxWidth: `${gridSize * adjustedCellSize + (gridSize - 1) * GAP_SIZE + GRID_PADDING * 2}px`
              }}>
                <p className="text-center text-cyan-400 font-semibold text-[10px] leading-tight">
                  ✓ Completion Effect: ATK +{completionBonus.atk}%, HP +{completionBonus.hp}%
                </p>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-2 sm:p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              Piece Inventory
            </h2>
            <div className="flex items-center gap-2 overflow-x-auto">
              {/* Preset dropdown */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleLoadPreset(e.target.value);
                    e.target.value = ''; // Reset after selection
                  }
                }}
                value=""
                className="px-2 sm:px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 whitespace-nowrap"
                title="Load preset inventory"
              >
                <option value="" disabled>Load Preset</option>
                {INVENTORY_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    {preset.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleFindBestWeapon}
                disabled={isFindingBestWeapon || inventory.filter(p => p !== null).length === 0}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
                title="Find the best weapon for your current inventory"
              >
                {isFindingBestWeapon ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span className="hidden xs:inline sm:inline">{isFindingBestWeapon ? 'Finding...' : 'Best Weapon'}</span>
                <span className="xs:hidden sm:hidden">{isFindingBestWeapon ? '...' : 'Best'}</span>
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Drag pieces onto the grid to place them. Click level to edit or scroll to adjust.
          </p>

          <div ref={inventoryContainerRef} className="grid grid-cols-4 gap-3">
            {inventory.map((piece, index) => {
              const isLocked = piece && lockedInventoryIndices.includes(index);

              return (
                <div
                  key={index}
                  data-draggable-piece={piece && !isLocked ? 'true' : undefined}
                  data-inventory-index={index}
                  draggable={!!piece && !isLocked}
                  onDragStart={(e) => piece && !isLocked && handleDragStart(e, piece, index)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => {
                    // Don't start drag if touching the remove button or level editor
                    const target = e.target;
                    const isButton = target.closest('[data-remove-button]');
                    const isLevelEditor = target.closest('[data-level-editor]');

                    touchLogger.trace('onTouchStart event fired on inventory slot', index, {
                      target: target.tagName,
                      isButton: !!isButton,
                      isLevelEditor: !!isLevelEditor
                    });

                    if (isButton || isLevelEditor) {
                      touchLogger.trace('Touch on button/level editor, ignoring and stopping propagation');
                      e.stopPropagation();
                      return;
                    }
                    if (piece && !isLocked) handleTouchStart(e, piece, index);
                  }}
                  onPointerDown={(e) => {
                    // Fallback for DevTools emulation - treat pointer as touch if it's a touch pointer
                    if (e.pointerType === 'touch' && piece && !isLocked) {
                      // Don't start drag if touching the remove button or level editor
                      const target = e.target;
                      const isButton = target.closest('[data-remove-button]');
                      const isLevelEditor = target.closest('[data-level-editor]');

                      if (isButton || isLevelEditor) {
                        touchLogger.trace('onPointerDown: Touch on button/level editor, ignoring');
                        e.stopPropagation();
                        return;
                      }

                      touchLogger.trace('onPointerDown (touch) event fired on inventory slot', index);
                      // Convert pointer event to touch-like event
                      const fakeTouch = {
                        clientX: e.clientX,
                        clientY: e.clientY
                      };
                      const fakeTouchEvent = {
                        ...e,
                        touches: [fakeTouch],
                        changedTouches: [fakeTouch],
                        target: e.target,
                        currentTarget: e.currentTarget,
                        preventDefault: () => e.preventDefault(),
                        stopPropagation: () => e.stopPropagation()
                      };
                      handleTouchStart(fakeTouchEvent, piece, index);
                    }
                  }}
                  onClick={() => !piece && !isLocked && handleOpenPieceSelector(index)}
                  className={`
                    aspect-square rounded-lg border-2 p-2 transition-all relative overflow-hidden
                    ${piece ? (isLocked ? 'bg-gray-900 dark:bg-gray-800 cursor-not-allowed' : 'bg-gray-800 dark:bg-gray-700 cursor-grab active:cursor-grabbing') : 'bg-gray-900 dark:bg-gray-800 border-gray-700 hover:border-green-500 cursor-pointer'}
                    ${draggingIndex === index ? 'opacity-50' : ''}
                    ${!piece ? 'opacity-50 hover:opacity-70' : ''}
                    ${isLocked ? 'opacity-60' : ''}
                  `}
                  style={piece ? {
                    borderColor: getRarityColor(piece.rarity),
                    boxShadow: isLocked
                      ? `0 0 8px ${getRarityColor(piece.rarity)}40, inset 0 0 6px ${getRarityColor(piece.rarity)}20`
                      : `0 0 12px ${getRarityColor(piece.rarity)}80, inset 0 0 8px ${getRarityColor(piece.rarity)}40`
                  } : {}}
                >
                  {piece ? (
                    <div className="w-full h-full relative flex items-center justify-center">
                      {/* Locked indicator and unsocket button */}
                      {isLocked ? (
                        <>
                          {/* Grey overlay */}
                          <div className="absolute inset-0 bg-black/50 z-10" />
                          {/* Unsocket button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnsocketFromInventory(index);
                            }}
                            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg p-2 z-20 shadow-lg transition-colors"
                            title="Unsocket from grid"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        /* Remove button (only for unlocked pieces) */
                        <div
                          data-remove-button
                          className="absolute -top-2 -right-2 w-8 h-8 flex items-start justify-end z-[100]"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            // Store initial position to detect if this is a drag or tap
                            e.currentTarget.dataset.startX = e.clientX;
                            e.currentTarget.dataset.startY = e.clientY;
                            touchLogger.trace('Pointer down on remove button - stopping all events');
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            // Store initial position to detect if this is a drag or tap
                            const touch = e.touches[0];
                            e.currentTarget.dataset.startX = touch.clientX;
                            e.currentTarget.dataset.startY = touch.clientY;
                            touchLogger.trace('Touch start on remove button - stopping all events');
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            e.preventDefault();

                            // Only remove if finger hasn't moved much (not a drag)
                            const startX = parseFloat(e.currentTarget.dataset.startX || e.clientX);
                            const startY = parseFloat(e.currentTarget.dataset.startY || e.clientY);
                            const deltaX = Math.abs(e.clientX - startX);
                            const deltaY = Math.abs(e.clientY - startY);
                            const DRAG_THRESHOLD = 10; // pixels

                            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                              touchLogger.trace('Remove button: Drag detected, ignoring', { deltaX, deltaY });
                              return;
                            }

                            touchLogger.trace('Remove button pressed, removing piece');
                            handleRemoveFromInventory(index);
                          }}
                          onTouchEnd={(e) => {
                            e.stopPropagation();
                            e.preventDefault();

                            // Only remove if finger hasn't moved much (not a drag)
                            const touch = e.changedTouches[0];
                            const startX = parseFloat(e.currentTarget.dataset.startX || touch.clientX);
                            const startY = parseFloat(e.currentTarget.dataset.startY || touch.clientY);
                            const deltaX = Math.abs(touch.clientX - startX);
                            const deltaY = Math.abs(touch.clientY - startY);
                            const DRAG_THRESHOLD = 10; // pixels

                            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                              touchLogger.trace('Remove button: Drag detected, ignoring', { deltaX, deltaY });
                              return;
                            }

                            touchLogger.trace('Touch end on remove button, removing piece');
                            handleRemoveFromInventory(index);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromInventory(index);
                          }}
                        >
                          <div className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full p-0.5 shadow-lg transition-colors">
                            <X className="w-3 h-3" />
                          </div>
                        </div>
                      )}

                      {/* Piece image - no resizing, natural size */}
                      <img
                        src={`/images/equipment/soul-weapons/SoulGem_${piece.rarity}_${piece.shapeId}.png`}
                        alt={piece.shape?.name || 'piece'}
                        className="max-w-full max-h-full"
                        draggable={false}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23374151"/></svg>';
                        }}
                      />

                      {/* Level - Interactive (positioned at bottom edge on mobile, slightly up on desktop) */}
                      <div
                        data-level-editor
                        className="absolute -bottom-2 sm:bottom-1 left-0 right-0 text-center bg-black/70 hover:bg-black/90 text-white text-xs px-1.5 py-0.5 rounded-t z-10 cursor-pointer select-none transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenLevelEditor(index, piece.level);
                        }}
                        onWheel={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const delta = e.deltaY > 0 ? -1 : 1;
                          handleChangePieceLevel(index, piece.level + delta);
                        }}
                        title="Click to edit level or scroll to adjust"
                      >
                        Lv.{piece.level}
                      </div>

                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 dark:text-gray-500">
                      <Lock className="w-6 h-6 mb-1" />
                      <span className="text-xs text-green-500 text-center">Click to add</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Slot count info */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {inventory.filter(p => p !== null).length} / {INVENTORY_SIZE} Slots Used
            </p>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Touch Drag Preview - Floating piece that follows finger */}
      {touchDragging && draggingPiece && touchCurrentPos && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: `${touchCurrentPos.x}px`,
            top: `${touchCurrentPos.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.8
          }}
        >
          <img
            src={`/images/equipment/soul-weapons/SoulGem_${draggingPiece.rarity}_${draggingPiece.shapeId}.png`}
            alt={draggingPiece.shape?.name || 'piece'}
            className="w-16 h-16"
            style={{
              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5))'
            }}
          />
        </div>
      )}

      {/* Level Editor Widget - Fixed Overlay */}
      {editingLevelSlot !== null && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={handleCloseLevelEditor}
        >
          <div
            className="bg-gray-800 dark:bg-gray-900 border-2 border-blue-500 rounded-lg p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white text-sm font-semibold mb-3 text-center">
              Set Level
            </div>
            <div className="flex items-center gap-2">
              {/* Decrement button */}
              <button
                onClick={() => {
                  const newVal = Math.max(MIN_PIECE_LEVEL, parseInt(levelInputValue) - 1);
                  setLevelInputValue(newVal.toString());
                }}
                className="bg-red-600 hover:bg-red-700 text-white rounded px-3 py-2 text-sm font-bold transition-colors"
              >
                -
              </button>

              {/* Level input */}
              <input
                type="number"
                min={MIN_PIECE_LEVEL}
                max={MAX_PIECE_LEVEL}
                value={levelInputValue}
                onChange={(e) => setLevelInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleApplyLevel();
                  } else if (e.key === 'Escape') {
                    handleCloseLevelEditor();
                  }
                }}
                autoFocus
                className="w-20 bg-gray-700 dark:bg-gray-800 text-white text-center rounded px-3 py-2 text-base border border-gray-600 dark:border-gray-700 focus:border-blue-500 focus:outline-none"
              />

              {/* Increment button */}
              <button
                onClick={() => {
                  const newVal = Math.min(MAX_PIECE_LEVEL, parseInt(levelInputValue) + 1);
                  setLevelInputValue(newVal.toString());
                }}
                className="bg-green-600 hover:bg-green-700 text-white rounded px-3 py-2 text-sm font-bold transition-colors"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              {/* Apply button */}
              <button
                onClick={handleApplyLevel}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium transition-colors"
              >
                Apply
              </button>
              {/* Cancel button */}
              <button
                onClick={handleCloseLevelEditor}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white rounded px-4 py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Piece Selection Modal */}
      {showPieceSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Create Engraving Piece
                </h2>
                <button
                  onClick={() => setShowPieceSelector(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Shape Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shape
                </label>
                <select
                  value={selectedShape?.id || ''}
                  onChange={(e) => {
                    const shape = engravings.find(s => s.id === parseInt(e.target.value));
                    setSelectedShape(shape);
                  }}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {engravings.map(shape => (
                    <option key={shape.id} value={shape.id}>
                      {shape.name} - {shape.stat} ({shape.gridSize})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rarity Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rarity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic'].map((rarity, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedRarity(index)}
                      className={`
                        px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                        ${selectedRarity === index
                          ? 'border-blue-500 ring-2 ring-blue-500/50'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }
                      `}
                      style={{
                        backgroundColor: selectedRarity === index ? getRarityColor(index) + '20' : 'transparent',
                        color: getRarityColor(index)
                      }}
                    >
                      {rarity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Level Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Level ({MIN_PIECE_LEVEL}-{MAX_PIECE_LEVEL})
                </label>
                <input
                  type="number"
                  min={MIN_PIECE_LEVEL}
                  max={MAX_PIECE_LEVEL}
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(Math.max(MIN_PIECE_LEVEL, Math.min(MAX_PIECE_LEVEL, parseInt(e.target.value) || MIN_PIECE_LEVEL)))}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Preview */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview
                </label>
                <div className="bg-gray-800 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-center border border-gray-600">
                  <div className="relative w-32 h-32">
                    {selectedShape && (
                      <>
                        <img
                          src={`/images/equipment/soul-weapons/SoulGem_${selectedRarity}_${selectedShape.id}.png`}
                          alt={selectedShape.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23374151"/></svg>';
                          }}
                        />
                        <div
                          className="absolute top-0 left-0 w-6 h-6 rounded-br-lg"
                          style={{ backgroundColor: getRarityColor(selectedRarity) }}
                        />
                        <div className="absolute bottom-0 right-0 bg-black/70 text-white text-sm px-2 py-1 rounded-tl">
                          Lv.{selectedLevel}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Stat Info */}
              {selectedShape && (
                <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">{selectedShape.stat}:</span> {selectedShape.statName}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {selectedShape.description}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateCustomPiece}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Create Piece
                </button>
                <button
                  onClick={() => setShowPieceSelector(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Solve Solution Picker Modal */}
      {showSolutionPicker && autoSolveSolutions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 md:p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-none md:rounded-lg shadow-2xl w-full h-full md:max-w-6xl md:h-auto md:max-h-[90vh] overflow-hidden border-0 md:border border-gray-300 dark:border-gray-700">
            {/* Header */}
            <div className="bg-purple-600 text-white px-4 md:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <Zap className="w-5 h-5 md:w-6 md:h-6" />
                <div>
                  <h2 className="text-lg md:text-xl font-bold">Auto-Solve Solutions</h2>
                  <p className="text-xs md:text-sm text-purple-100">Found {autoSolveSolutions.length} complete layout{autoSolveSolutions.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSolutionPicker(false)}
                className="p-1 hover:bg-purple-700 rounded transition-colors"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Solution Grid */}
            <div className="p-3 md:p-6 overflow-y-auto h-[calc(100vh-80px)] md:h-auto md:max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {autoSolveSolutions.map((solution, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-gray-300 dark:border-gray-700 rounded-lg p-2 md:p-4 hover:border-purple-500 dark:hover:border-purple-400 transition-colors cursor-pointer"
                    onClick={() => handleApplySolution(solution)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">Solution {idx + 1}</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{solution.length} pieces</span>
                    </div>

                    {/* Mini grid preview */}
                    <div className="aspect-square bg-gray-900 dark:bg-black rounded-lg p-1 mb-2 relative overflow-hidden">
                      {/* Render grid cells */}
                      <div
                        className="grid gap-0.5 w-full h-full"
                        style={{
                          gridTemplateColumns: `repeat(${selectedWeapon?.gridType === '4x4' ? 4 : 5}, 1fr)`,
                          gridTemplateRows: `repeat(${selectedWeapon?.gridType === '4x4' ? 4 : 5}, 1fr)`,
                        }}
                      >
                        {Array(selectedWeapon?.gridType === '4x4' ? 16 : 25).fill(null).map((_, cellIdx) => {
                          const row = Math.floor(cellIdx / (selectedWeapon?.gridType === '4x4' ? 4 : 5));
                          const col = cellIdx % (selectedWeapon?.gridType === '4x4' ? 4 : 5);

                          // Check if this cell is active
                          const isActive = selectedWeapon?.activeSlots.some(slot => slot[0] === row && slot[1] === col);

                          return (
                            <div
                              key={cellIdx}
                              className={`rounded-sm ${
                                isActive ? 'bg-gray-700 dark:bg-gray-600' : 'bg-gray-900 dark:bg-black opacity-30'
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* Render pieces */}
                      {(() => {
                        // Calculate mini grid dimensions dynamically based on viewport
                        const miniGridSize = selectedWeapon?.gridType === '4x4' ? 4 : 5;
                        const miniGapSize = 2; // Gap between cells in pixels (gap-0.5)
                        const miniGridPadding = 0; // No additional padding - container's p-1 provides visual padding
                        const miniLineThickness = 12;
                        const containerPadding = 8; // Container has p-1 which is 4px on each side = 8px total

                        // Estimate container size based on responsive grid layout
                        // Modal is max-w-6xl (1152px) on desktop
                        // Mobile (1 col): fullscreen, Tablet (2 col): ~350-400px, Desktop (3 col): ~330px with max-w-6xl
                        const viewportWidth = window.innerWidth;
                        let containerSize;
                        if (viewportWidth >= 1024) {
                          // lg: 3 columns with max-w-6xl modal (1152px)
                          // Modal padding: 48px (24px each side)
                          // Grid gaps: 32px (16px * 2 gaps for 3 cards)
                          // Available: (1152 - 48 - 32) / 3 = 357px per card
                          // Card padding: 32px (16px each side for md:p-4)
                          // Aspect-square padding: 8px (4px each side for p-1)
                          // Available for grid: 357 - 32 - 8 = 317px
                          containerSize = 330;
                        } else if (viewportWidth >= 768) {
                          // md: 2 columns - medium cards
                          containerSize = Math.min(350, (viewportWidth - 96) / 2 - 32);
                        } else {
                          // mobile: 1 column - largest cards
                          containerSize = Math.min(400, viewportWidth - 96);
                        }

                        // Calculate cell size accounting for container padding AND gaps
                        // Available space inside container = containerSize - containerPadding
                        // Total width = cellSize*gridSize + gap*(gridSize-1)
                        // Solving for cellSize: cellSize = (availableSpace - gap*(gridSize-1)) / gridSize
                        const availableSpace = containerSize - containerPadding;
                        const miniCellSize = (availableSpace - miniGapSize * (miniGridSize - 1)) / miniGridSize;

                        return solution.map((placement, pIdx) => (
                          <EngravingPiece
                            key={`solution-${idx}-piece-${pIdx}`}
                            piece={{
                              ...placement.piece,
                              rotation: placement.rotation,
                              anchorRow: placement.anchorRow,
                              anchorCol: placement.anchorCol
                            }}
                            cellSize={miniCellSize}
                            gapSize={miniGapSize}
                            gridPadding={miniGridPadding}
                            lineThickness={miniLineThickness}
                            interactive={false}
                            zIndexBase={10}
                            scale={1}
                          />
                        ));
                      })()}
                    </div>

                    {/* Piece list and stat summary */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {/* Piece list */}
                      <div className="flex flex-wrap gap-1">
                        {solution.map((placement, pIdx) => (
                          <div
                            key={pIdx}
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor: getRarityColor(placement.piece.rarity),
                              color: 'white'
                            }}
                            title={`${placement.piece.shape.name} (${placement.rotation}°)`}
                          >
                            {placement.piece.shape.name.substring(0, 3)}
                          </div>
                        ))}
                      </div>

                      {/* Dominant stat indicator */}
                      {(() => {
                        // Count stats in this solution
                        const statCounts = {};
                        solution.forEach(placement => {
                          const stat = placement.piece.shape.stat;
                          statCounts[stat] = (statCounts[stat] || 0) + 1;
                        });

                        // Find most common stat
                        let maxCount = 0;
                        let dominantStat = null;
                        let dominantStatName = null;
                        Object.entries(statCounts).forEach(([stat, count]) => {
                          if (count > maxCount) {
                            maxCount = count;
                            dominantStat = stat;
                            // Find the stat name from the shape
                            const shape = solution.find(p => p.piece.shape.stat === stat)?.piece.shape;
                            dominantStatName = shape?.statName || stat;
                          }
                        });

                        return dominantStat ? (
                          <div className="text-xs px-2 py-1 bg-blue-600 text-white rounded font-medium whitespace-nowrap" title={`Primary stat: ${dominantStatName} (${maxCount} pieces)`}>
                            {dominantStat}
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplySolution(solution);
                      }}
                      className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Apply Solution
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Best Weapon Finder Modal */}
      {showBestWeaponModal && bestWeaponResults.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 md:p-4 z-[200]">
          <div className="bg-white dark:bg-gray-900 rounded-none md:rounded-lg shadow-2xl w-full h-full md:max-w-6xl md:h-auto md:max-h-[90vh] overflow-hidden border-0 md:border border-gray-300 dark:border-gray-700">
            {/* Header */}
            <div className="bg-blue-600 text-white px-4 md:px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                <div>
                  <h2 className="text-lg md:text-xl font-bold">Best Weapons for Your Inventory</h2>
                  <p className="text-xs md:text-sm text-blue-100">
                    Found {bestWeaponResults.length} compatible weapon{bestWeaponResults.length !== 1 ? 's' : ''}
                    {highestUnlockedWeapon < 42 && ` (searched ${weapons.filter(w => w.id <= highestUnlockedWeapon).length} unlocked)`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBestWeaponModal(false)}
                className="p-1 hover:bg-blue-700 rounded transition-colors"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Results List */}
            <div className="p-3 md:p-6 overflow-y-auto h-[calc(100vh-80px)] md:h-auto md:max-h-[calc(90vh-120px)]">
              <div className="space-y-3 md:space-y-4">
                {bestWeaponResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="border-2 border-gray-300 dark:border-gray-700 rounded-lg p-3 md:p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                  >
                    {/* Weapon Info Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white">{result.weapon.name}</h3>
                          {idx === 0 && (
                            <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs font-bold rounded">BEST</span>
                          )}
                          {result.gridDataSource === 'community' && (
                            <span
                              className="px-2 py-0.5 bg-purple-500 text-white text-xs font-medium rounded"
                              title={`Community submission by ${result.submittedBy || 'Anonymous'}`}
                            >
                              COMMUNITY
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs md:text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                          <span>{result.weapon.gridType || 'Unknown'} Grid</span>
                          <span>•</span>
                          <span>{result.totalActiveSlots} slots</span>
                          <span>•</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">Score: {result.score.toFixed(1)}</span>
                          {result.gridDataSource === 'community' && result.submittedBy && (
                            <>
                              <span>•</span>
                              <span className="text-purple-600 dark:text-purple-400">by {result.submittedBy}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Statistics */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded px-3 py-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Solutions Found</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">{result.solutionCount}</div>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded px-3 py-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Same-Piece Solutions</div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{result.samePieceCount}</div>
                      </div>
                    </div>

                    {/* Completion Effect */}
                    {result.weapon.completionEffect && (
                      <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded p-2 mb-3">
                        <div className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 mb-1">Completion Bonus:</div>
                        <div className="text-xs text-cyan-900 dark:text-cyan-100">
                          {(() => {
                            const ce = result.weapon.completionEffect;
                            // Handle both official format {atkPercent, hpPercent} and community format {atk, hp}
                            const atk = ce.atkPercent !== undefined ? `${ce.atkPercent}%` : (ce.atk !== undefined ? `${ce.atk}%` : 'N/A');
                            const hp = ce.hpPercent !== undefined ? `${ce.hpPercent}%` : (ce.hp !== undefined ? `${ce.hp}%` : 'N/A');
                            return `ATK +${atk} • HP +${hp}`;
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Solution Previews */}
                    {result.solutions.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Example Solutions (showing {Math.min(3, result.solutions.length)} of {result.solutionCount}):
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {result.solutions.slice(0, 3).map((solution, solIdx) => {
                            // Get shape type signature for this solution
                            const shapeTypes = {};
                            solution.forEach(placement => {
                              const shapeName = placement.piece.shape.name;
                              shapeTypes[shapeName] = (shapeTypes[shapeName] || 0) + 1;
                            });
                            const shapeTypesText = Object.entries(shapeTypes)
                              .sort()
                              .map(([name, count]) => `${name}×${count}`)
                              .join(', ');

                            return (
                              <div key={solIdx} className="bg-gray-100 dark:bg-gray-800 rounded p-2 text-center">
                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{solution.length} pieces</div>
                                <div className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2">{shapeTypesText}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Select Button */}
                    <button
                      onClick={() => handleSelectBestWeapon(result)}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Select This Weapon
                    </button>
                  </div>
                ))}
              </div>

              {/* Info Footer */}
              <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400">
                <strong>Scoring:</strong> Base score = number of solutions found. Bonus: +2 per same-piece solution (all same shape type). <strong>Weapon tier bonus: +10 per weapon level</strong> - this heavily favors higher tier weapons for progression. Cached results are reused for faster repeat searches.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoulWeaponEngravingBuilder;
