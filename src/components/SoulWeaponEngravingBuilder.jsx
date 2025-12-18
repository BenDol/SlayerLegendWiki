import React, { useState, useEffect, useRef } from 'react';
import { Share2, Download, Upload, Settings, Trash2, Check, Loader, RefreshCw, RotateCw, Lock, X, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../wiki-framework/src/store/authStore';
import { useDraftStorage } from '../../wiki-framework/src/hooks/useDraftStorage';
import { encodeBuild, decodeBuild } from '../../wiki-framework/src/components/wiki/BuildEncoder';
import { saveBuild as saveSharedBuild, generateShareUrl } from '../../wiki-framework/src/services/github/buildShare';

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
 * - 8 piece inventory slots
 */
const SoulWeaponEngravingBuilder = ({ isModal = false, initialBuild = null, onSave = null, allowSavingBuilds = true }) => {
  const { isAuthenticated, user } = useAuthStore();
  const gridRef = useRef(null);

  // Natural image sizing - calculated from actual piece images
  const [cellSize, setCellSize] = useState(45); // Will be set from image dimensions
  const [imageSizesCache, setImageSizesCache] = useState({}); // Cache of natural image sizes
  const GAP_SIZE = 4; // Gap between grid cells in pixels

  // Data loading states
  const [weapons, setWeapons] = useState([]);
  const [engravings, setEngravings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Builder state
  const [selectedWeapon, setSelectedWeapon] = useState(null);
  const [buildName, setBuildName] = useState('');
  const [gridState, setGridState] = useState([]); // Grid with placed pieces
  const [inventory, setInventory] = useState(Array(8).fill(null)); // 8 piece slots
  const [lockedInventoryIndices, setLockedInventoryIndices] = useState([]); // Tracks which inventory pieces are placed

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

  // Debug mode
  const [debugMode, setDebugMode] = useState(false);

  // Piece selection modal states
  const [showPieceSelector, setShowPieceSelector] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [selectedRarity, setSelectedRarity] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState(1);

  // Draft storage hook
  const { loadDraft, clearDraft } = useDraftStorage(
    'soulWeaponEngraving',
    user,
    isModal,
    { buildName, selectedWeapon, gridState, inventory }
  );

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Calculate natural cell size from piece images
  useEffect(() => {
    if (engravings.length > 0) {
      calculateNaturalCellSize();
    }
  }, [engravings]);

  // Initialize grid when weapon changes
  useEffect(() => {
    if (selectedWeapon) {
      initializeGrid();
    }
  }, [selectedWeapon]);

  // Update locked inventory indices when grid changes
  useEffect(() => {
    updateLockedInventoryIndices();
  }, [gridState, inventory]);

  // Debug: Track gridState changes to investigate socketing issue
  useEffect(() => {
    console.log('=== GridState Changed ===');
    console.log('Grid dimensions:', gridState.length, 'x', gridState[0]?.length);

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

    console.log('Placed pieces found:', placedPieces.length);
    placedPieces.forEach((piece, idx) => {
      console.log(`  Piece ${idx + 1}:`, piece);
    });
    console.log('=========================');
  }, [gridState]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load weapon grids
      const weaponsResponse = await fetch('/data/soul-weapon-grids.json');
      const weaponsData = await weaponsResponse.json();

      // Load engraving pieces
      const engravingsResponse = await fetch('/data/soul-weapon-engravings.json');
      const engravingsData = await engravingsResponse.json();

      setWeapons(weaponsData.weapons || []);
      setEngravings(engravingsData.shapes || []);

      // Set first weapon as default if none selected
      if (!selectedWeapon && weaponsData.weapons?.length > 0) {
        setSelectedWeapon(weaponsData.weapons[0]);
      }

      // Try to load draft
      const draft = loadDraft();
      if (draft && !initialBuild) {
        setBuildName(draft.buildName || '');
        if (draft.selectedWeapon) {
          setSelectedWeapon(draft.selectedWeapon);
        }
        if (draft.gridState) {
          setGridState(draft.gridState);
        }
        if (draft.inventory) {
          setInventory(draft.inventory);
        }
      }

    } catch (error) {
      console.error('Failed to load soul weapon engraving data:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeGrid = () => {
    if (!selectedWeapon) return;

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
          console.log(`Calculated natural cell size: ${naturalCellSize}px from image ${img.naturalWidth}x${img.naturalHeight}`);
          resolve();
        };
        img.onerror = reject;
        img.src = imageUrl;
      });
    } catch (error) {
      console.error('Failed to calculate natural cell size, using default 45px:', error);
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

    console.log('Locked inventory indices:', locked, 'Inventory:', inventory.map((p, i) => p ? `${i}: ${p.shapeId}` : `${i}: empty`));
    setLockedInventoryIndices(locked);
  };

  const handleWeaponChange = (weaponId) => {
    const weapon = weapons.find(w => w.id === parseInt(weaponId));
    setSelectedWeapon(weapon);
    setHasUnsavedChanges(true);
  };

  const handleRandomizeInventory = () => {
    const newInventory = Array(8).fill(null).map(() => {
      const randomShape = engravings[Math.floor(Math.random() * engravings.length)];
      const randomRarity = Math.floor(Math.random() * 6);
      const randomLevel = Math.floor(Math.random() * 50) + 1;

      return {
        shapeId: randomShape.id,
        shape: randomShape,
        rarity: randomRarity,
        level: randomLevel
      };
    });

    setInventory(newInventory);
    setHasUnsavedChanges(true);
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
    const newInventory = [...inventory];
    newInventory[slotIndex] = null;
    setInventory(newInventory);
    setHasUnsavedChanges(true);
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
    console.log('🔥 Drag ended - cleaning up');
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
      console.log('❌ DragOver but no draggingPiece');
      return;
    }

    // Calculate anchor position: cursor cell - pattern offset
    // This makes the piece appear exactly where the user is dragging it
    const anchorRow = row - dragPatternOffset.row;
    const anchorCol = col - dragPatternOffset.col;
    console.log(`📍 DragOver [${row}][${col}] -> anchor [${anchorRow}][${anchorCol}]`);

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

    console.log('Placing piece:', placingPiece);
    console.log('Pattern:', pattern);
    console.log('Position:', placingPosition);

    // If we're moving a piece from the grid, remove it from its old position first
    if (draggingFromGrid) {
      console.log('Removing piece from old position:', draggingFromGrid);
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
            console.log(`Setting piece at [${gridRow}][${gridCol}]:`, pieceData);
            newGrid[gridRow][gridCol].piece = pieceData;
          }
        }
      });
    });

    console.log('New grid state after placement:', newGrid);
    setGridState(newGrid);

    // DON'T remove piece from inventory - keep it there but locked
    // The piece will show as locked/greyed out via lockedInventoryIndices

    // Clear placement state
    setPlacingPiece(null);
    setPlacingPosition(null);
    setPlacingRotation(0);
    setPlacingInventoryIndex(null);

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
    console.log('❌ Canceling placement, draggingFromGrid:', draggingFromGrid);

    // If we were dragging from grid, the piece is still there - just clear states
    if (draggingFromGrid) {
      // Piece stays on grid at original position, just clear all drag/placing states
      console.log('❌ Piece remains on grid at original position');
    } else if (placingPiece && placingInventoryIndex === null) {
      // If canceling an unsocketed piece (no placingInventoryIndex), return it to inventory
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
        console.log('❌ Piece returned to inventory slot', emptySlot);
      }
    }

    // Clear all placement and drag states
    setPlacingPiece(null);
    setPlacingPosition(null);
    setPlacingRotation(0);
    setPlacingInventoryIndex(null);
    setDraggingFromGrid(null); // IMPORTANT: Clear this so piece renders again
    setDraggingPiece(null);
    setDraggingIndex(null);
  };

  const handleClickPlacedPiece = (piece) => {
    console.log('👆 Clicked placed piece, entering placing mode:', piece);

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
    console.log('🔥 Starting drag of placed piece:', piece, 'clicked cell:', clickedPatternRow, clickedPatternCol);

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
    console.log('🔥 Setting dragging piece:', dragPieceData);

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
      console.log('🔥 Dragging state set after delay - rotation:', piece.rotation || 0, 'from grid:', piece.anchorRow, piece.anchorCol);
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
    if (!placingPiece || !placingPosition) return false;
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
    if (confirm('Clear all placed pieces? They will be returned to inventory if space available.')) {
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

      setInventory(newInventory);
      initializeGrid();
      setHasUnsavedChanges(true);
    }
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

  const handleShareBuild = async () => {
    try {
      setSharing(true);
      setShareError(null);

      const buildData = {
        name: buildName || 'Unnamed Build',
        weaponId: selectedWeapon?.id,
        gridState: gridState,
        inventory: inventory
      };

      const configResponse = await fetch('/wiki-config.json');
      const config = await configResponse.json();
      const owner = config.wiki.repository.owner;
      const repo = config.wiki.repository.repo;

      const result = await saveSharedBuild(owner, repo, 'soul-weapon-engraving', buildData);
      const shareUrl = generateShareUrl(result.checksum, 'soul-weapon-engraving');

      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

    } catch (error) {
      console.error('Failed to share build:', error);
      setShareError(`Failed to share: ${error.message}`);
    } finally {
      setSharing(false);
    }
  };

  const handleExportBuild = () => {
    const buildData = {
      name: buildName || 'Unnamed Build',
      weaponId: selectedWeapon?.id,
      weaponName: selectedWeapon?.name,
      gridState: gridState,
      inventory: inventory,
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
  };

  const handleImportBuild = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result);

        if (data.weaponId) {
          const weapon = weapons.find(w => w.id === data.weaponId);
          if (weapon) {
            setSelectedWeapon(weapon);
          }
        }

        if (data.name) setBuildName(data.name);
        if (data.gridState) setGridState(data.gridState);
        if (data.inventory) setInventory(data.inventory);

        setHasUnsavedChanges(true);
      } catch (error) {
        alert('Failed to import build: Invalid file format');
        console.error('Import error:', error);
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
  const gridSize = selectedWeapon?.gridType === '4x4' ? 4 : 5;
  const adjustedCellSize = getAdjustedCellSize(gridSize);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Soul Weapon Engraving Builder
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Drag and drop engraving pieces onto the grid to plan your layout
        </p>
      </div>

      {/* Build Name */}
      {allowSavingBuilds && !isModal && (
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Build Name
          </label>
          <input
            type="text"
            value={buildName}
            onChange={(e) => {
              setBuildName(e.target.value);
              setHasUnsavedChanges(true);
            }}
            placeholder="Enter build name..."
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Actions Panel */}
      {!isModal && (
        <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
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
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-800 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Soul Weapon
        </label>
        <select
          value={selectedWeapon?.id || ''}
          onChange={(e) => handleWeaponChange(e.target.value)}
          className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {weapons.map(weapon => (
            <option key={weapon.id} value={weapon.id}>
              {weapon.name} ({weapon.gridType}) - ATK +{weapon.completionEffect.atk}, HP +{weapon.completionEffect.hp}
            </option>
          ))}
        </select>
      </div>

      {/* Main Grid Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Grid Display */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Engraving Grid
            </h2>
            {/* Debug badge - only in development */}
            {import.meta.env.DEV && debugMode && (
              <div className="text-xs font-mono bg-yellow-500 text-black px-2 py-1 rounded">
                DEBUG MODE ACTIVE
              </div>
            )}
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

          {/* Grid Container */}
          <div className="relative inline-block">
            <div
              ref={gridRef}
              className={`grid gap-1 p-4 rounded-lg relative ${isGridComplete() ? 'bg-gradient-to-br from-cyan-400/20 to-blue-500/20 ring-2 ring-cyan-400' : 'bg-gray-900 dark:bg-black'}`}
              style={{
                gridTemplateColumns: `repeat(${gridSize}, ${adjustedCellSize}px)`,
                gridTemplateRows: `repeat(${gridSize}, ${adjustedCellSize}px)`
              }}
            >
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
                        console.log(`✋ DragOver fired on cell [${rowIndex}][${colIndex}]`);
                        handleDragOver(e, rowIndex, colIndex);
                      }}
                      onDragEnter={(e) => {
                        console.log(`👋 DragEnter on cell [${rowIndex}][${colIndex}]`);
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        console.log(`💧 Drop on cell [${rowIndex}][${colIndex}]`);
                        handleDrop(e, rowIndex, colIndex);
                      }}
                      className={`
                        border-2 transition-all relative
                        ${cell.active ? 'bg-gray-700 dark:bg-gray-600 border-gray-600 dark:border-gray-500' : 'bg-gray-900 dark:bg-black border-gray-800 dark:border-gray-900 opacity-30'}
                      `}
                      style={{
                        width: `${adjustedCellSize}px`,
                        height: `${adjustedCellSize}px`,
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
                console.log('🎨 Rendering dragging preview overlay at:', previewPosition, 'piece:', draggingPiece.shapeId);
                const pattern = getRotatedPattern(draggingPiece.shape.pattern, currentDragRotation);
                const filledCells = getFilledCells(pattern, previewPosition.row, previewPosition.col);
                console.log('🎨 Filled cells for drag preview:', filledCells);
                const rarityColor = getRarityColor(draggingPiece.rarity);
                const rarityImageName = getRarityImageName(draggingPiece.rarity);
                const isValid = canPlacePiece(previewPosition.row, previewPosition.col, pattern);
                console.log('🎨 Is valid placement:', isValid);

                return (
                  <>
                    {/* Draw lines between adjacent gems */}
                    {filledCells.map((cell1, idx1) =>
                      filledCells.slice(idx1 + 1).map((cell2, idx2) => {
                        if (areAdjacent(cell1.row, cell1.col, cell2.row, cell2.col)) {
                          const isHorizontal = cell1.row === cell2.row;
                          const lineThickness = 8;

                          if (isHorizontal) {
                            const leftCol = Math.min(cell1.col, cell2.col);
                            const x = 16 + (leftCol + 0.5) * (adjustedCellSize + GAP_SIZE);
                            const y = 16 + cell1.row * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
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
                            const x = 16 + cell1.col * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const y = 16 + (topRow + 0.5) * (adjustedCellSize + GAP_SIZE);
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
                      console.log(`🎨 Rendering drag preview gem at [${filledCell.row}][${filledCell.col}] src: ${imgSrc}`);
                      return (
                        <div
                          key={`drag-gem-${filledCell.row}-${filledCell.col}`}
                          className="absolute pointer-events-none"
                          style={{
                            left: `${16 + filledCell.col * (adjustedCellSize + GAP_SIZE)}px`,
                            top: `${16 + filledCell.row * (adjustedCellSize + GAP_SIZE)}px`,
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
                            onLoad={() => console.log(`🎨 Drag preview gem loaded: ${imgSrc}`)}
                            onError={(e) => {
                              console.error(`🎨 Drag preview gem FAILED to load: ${imgSrc}`);
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
                          const lineThickness = 8;

                          if (isHorizontal) {
                            const leftCol = Math.min(cell1.col, cell2.col);
                            const x = 16 + (leftCol + 0.5) * (adjustedCellSize + GAP_SIZE);
                            const y = 16 + cell1.row * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
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
                            const x = 16 + cell1.col * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                            const y = 16 + (topRow + 0.5) * (adjustedCellSize + GAP_SIZE);
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
                        draggable={true}
                        onDragStart={(e) => {
                          console.log('🔄 Starting reposition from placing mode');
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
                            console.log('🔄 Switched from placing to dragging mode');
                          }, 0);
                        }}
                        onDragEnd={handleDragEnd}
                        className="absolute cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity"
                        style={{
                          left: `${16 + filledCell.col * (adjustedCellSize + GAP_SIZE)}px`,
                          top: `${16 + filledCell.row * (adjustedCellSize + GAP_SIZE)}px`,
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
                console.log('==== RENDERING PLACED PIECES ====');
                console.log('Scanning grid for placed pieces...');

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
                        console.log(`⏭️ Skipping piece being dragged at [${cell.piece.anchorRow}][${cell.piece.anchorCol}]`);
                        return null;
                      }

                      // Mark as rendered
                      renderedPieces.add(pieceKey);

                      console.log(`✓ Rendering piece at anchor [${cell.piece.anchorRow}][${cell.piece.anchorCol}] from cell [${rowIndex}][${colIndex}]`);
                    const pattern = getRotatedPattern(cell.piece.shape.pattern, cell.piece.rotation || 0);
                    const filledCells = getFilledCells(pattern, cell.piece.anchorRow, cell.piece.anchorCol);
                    console.log('Filled cells for rendering:', filledCells);
                    const rarityColor = getRarityColor(cell.piece.rarity);
                    const rarityImageName = getRarityImageName(cell.piece.rarity);

                    return (
                      <React.Fragment key={`piece-${cell.piece.anchorRow}-${cell.piece.anchorCol}`}>
                        {/* Draw lines between adjacent gems */}
                        {filledCells.map((cell1, idx1) =>
                          filledCells.slice(idx1 + 1).map((cell2, idx2) => {
                            if (areAdjacent(cell1.row, cell1.col, cell2.row, cell2.col)) {
                              // Calculate line position and orientation
                              const isHorizontal = cell1.row === cell2.row;
                              const lineThickness = 8;

                              if (isHorizontal) {
                                // Horizontal line
                                const leftCol = Math.min(cell1.col, cell2.col);
                                const x = 16 + (leftCol + 0.5) * (adjustedCellSize + GAP_SIZE);
                                const y = 16 + cell1.row * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                                const width = adjustedCellSize + GAP_SIZE;

                                return (
                                  <div
                                    key={`line-h-${cell1.row}-${cell1.col}-${cell2.col}`}
                                    className="absolute pointer-events-none"
                                    style={{
                                      left: `${x}px`,
                                      top: `${y - lineThickness / 2}px`,
                                      width: `${width}px`,
                                      height: `${lineThickness}px`,
                                      backgroundColor: rarityColor,
                                      zIndex: 4
                                    }}
                                  />
                                );
                              } else {
                                // Vertical line
                                const topRow = Math.min(cell1.row, cell2.row);
                                const x = 16 + cell1.col * (adjustedCellSize + GAP_SIZE) + adjustedCellSize / 2;
                                const y = 16 + (topRow + 0.5) * (adjustedCellSize + GAP_SIZE);
                                const height = adjustedCellSize + GAP_SIZE;

                                return (
                                  <div
                                    key={`line-v-${cell1.row}-${cell2.row}-${cell1.col}`}
                                    className="absolute pointer-events-none"
                                    style={{
                                      left: `${x - lineThickness / 2}px`,
                                      top: `${y}px`,
                                      width: `${lineThickness}px`,
                                      height: `${height}px`,
                                      backgroundColor: rarityColor,
                                      zIndex: 4
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
                          const imageSrc = `/images/equipment/soul-weapons/SoulGem_${rarityImageName}_Base.png`;
                          console.log(`Rendering gem at [${filledCell.row}][${filledCell.col}] - src: ${imageSrc}`);
                          return (
                            <div
                              key={`gem-${filledCell.row}-${filledCell.col}`}
                              draggable={true}
                              onDragStart={(e) => handleDragPlacedPiece(e, cell.piece, filledCell.patternRow, filledCell.patternCol)}
                              onDragEnd={handleDragEnd}
                              className="absolute cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity"
                              style={{
                                left: `${16 + filledCell.col * (adjustedCellSize + GAP_SIZE)}px`,
                                top: `${16 + filledCell.row * (adjustedCellSize + GAP_SIZE)}px`,
                                width: `${adjustedCellSize}px`,
                                height: `${adjustedCellSize}px`,
                                zIndex: 5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Drag to move"
                            >
                              <img
                                src={imageSrc}
                                alt="gem"
                                draggable={false}
                                className="w-full h-full object-contain"
                                style={{
                                  pointerEvents: 'none'
                                }}
                                onLoad={() => console.log(`Image loaded successfully: ${imageSrc}`)}
                                onError={(e) => {
                                  console.error(`Image failed to load: ${imageSrc}`, e);
                                  e.target.style.display = 'none';
                                }}
                              />
                          </div>
                        );
                        })}
                      </React.Fragment>
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
                    left: `${16 + previewPosition.col * (adjustedCellSize + GAP_SIZE)}px`,
                    top: `${16 + previewPosition.row * (adjustedCellSize + GAP_SIZE)}px`,
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

            {/* Placement Confirmation Buttons */}
            {placingPiece && placingPosition && (() => {
              const isValid = isCurrentPlacementValid();
              return (
                <div
                  className="absolute flex gap-2 z-10"
                  style={{
                    left: `${16 + placingPosition.col * (adjustedCellSize + GAP_SIZE)}px`,
                    top: `${16 + (placingPosition.row + getRotatedPattern(placingPiece.shape.pattern, placingRotation).length) * (adjustedCellSize + GAP_SIZE) + 8}px`,
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
          </div>

          {/* Completion Effect */}
          {completionBonus && (
            <div className="mt-4 p-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400 rounded-lg">
              <p className="text-center text-cyan-400 font-semibold text-lg">
                ✓ Completion Effect: ATK +{completionBonus.atk}, HP +{completionBonus.hp}
              </p>
            </div>
          )}

          {/* Grid Actions */}
          <div className="mt-4">
            <button
              onClick={handleClearGrid}
              disabled={!gridState.some(row => row.some(cell => cell.piece))}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Grid</span>
            </button>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Piece Inventory (8 Slots)
            </h2>
            <button
              onClick={handleRandomizeInventory}
              className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Randomize</span>
            </button>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Drag pieces onto the grid to place them
          </p>

          <div className="grid grid-cols-4 gap-3">
            {inventory.map((piece, index) => {
              const isLocked = piece && lockedInventoryIndices.includes(index);

              return (
                <div
                  key={index}
                  draggable={!!piece && !isLocked}
                  onDragStart={(e) => piece && !isLocked && handleDragStart(e, piece, index)}
                  onDragEnd={handleDragEnd}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromInventory(index);
                          }}
                          className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-0.5 z-20 shadow-lg transition-colors"
                          title="Remove piece"
                        >
                          <X className="w-3 h-3" />
                        </button>
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

                      {/* Level */}
                      <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1 rounded-tl z-10">
                        Lv.{piece.level}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 dark:text-gray-500">
                      <Lock className="w-6 h-6 mb-1" />
                      <span className="text-xs text-green-500">Click to add</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
                  Level (1-50)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
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
    </div>
  );
};

export default SoulWeaponEngravingBuilder;
