import React from 'react';
import EngravingPiece from './EngravingPiece';

/**
 * SoulWeaponEngravingGrid Component
 *
 * Reusable grid component for displaying soul weapon engraving layouts.
 * Can be used in both interactive (builder) and read-only (preview) modes.
 *
 * @param {Array} gridState - 2D array of grid cells with piece data
 * @param {Object} selectedWeapon - Selected weapon with image and grid data
 * @param {number} cellSize - Size of each cell in pixels
 * @param {number} gapSize - Gap between cells in pixels (default: 4)
 * @param {number} gridPadding - Padding inside grid container (default: 8)
 * @param {number} lineThickness - Thickness of connecting lines (default: 8)
 * @param {number} scale - Scale multiplier for the entire grid (default: 1)
 * @param {boolean} interactive - Whether pieces can be interacted with (default: false)
 * @param {boolean} isComplete - Whether grid is complete (adds special styling)
 * @param {Function} onDragOver - Handler for drag over cell
 * @param {Function} onDrop - Handler for drop on cell
 * @param {Function} onDragPlacedPiece - Handler for dragging a placed piece
 * @param {Function} onDragEnd - Handler for drag end
 * @param {Function} onTouchStartPlacedPiece - Handler for touch start on placed piece
 * @param {Function} onClickPlacedPiece - Handler for clicking a placed piece
 * @param {Function} onUnsocketPiece - Handler for unsocketing a piece
 * @param {Object} draggingFromGrid - Currently dragging piece from grid {anchorRow, anchorCol}
 * @param {Array} dragPreviewCells - Cells to highlight during drag preview
 * @param {Object} draggingPiece - Currently dragging piece data
 * @param {Object} placingPiece - Piece awaiting placement confirmation
 * @param {string} className - Additional CSS classes
 * @param {Object} containerStyle - Additional container styles
 */
const SoulWeaponEngravingGrid = ({
  gridState,
  selectedWeapon,
  cellSize,
  gapSize = 4,
  gridPadding = 8,
  lineThickness = 8,
  scale = 1,
  interactive = false,
  isComplete = false,
  onDragOver = null,
  onDrop = null,
  onDragPlacedPiece = null,
  onDragEnd = null,
  onTouchStartPlacedPiece = null,
  onClickPlacedPiece = null,
  onUnsocketPiece = null,
  draggingFromGrid = null,
  dragPreviewCells = [],
  draggingPiece = null,
  placingPiece = null,
  onTouchMove = null,
  onTouchEnd = null,
  onPointerMove = null,
  onPointerUp = null,
  className = '',
  containerStyle = {},
  gridRef = null
}) => {
  if (!gridState || gridState.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400 text-sm">
        No grid data available
      </div>
    );
  }

  const gridSize = gridState.length;
  const adjustedCellSize = cellSize;

  // Helper function for rarity colors
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

  return (
    <div
      ref={gridRef}
      className={`grid gap-1 p-2 rounded-lg relative ${
        isComplete
          ? 'bg-gradient-to-br from-cyan-400/20 to-blue-500/20 ring-1 ring-cyan-400'
          : 'bg-gray-900 dark:bg-black'
      } ${className}`}
      style={{
        gridTemplateColumns: `repeat(${gridSize}, ${adjustedCellSize}px)`,
        gridTemplateRows: `repeat(${gridSize}, ${adjustedCellSize}px)`,
        touchAction: interactive ? 'auto' : 'none',
        ...containerStyle
      }}
      onTouchMove={interactive && onTouchMove ? onTouchMove : undefined}
      onTouchEnd={interactive && onTouchEnd ? onTouchEnd : undefined}
      onPointerMove={interactive && onPointerMove ? onPointerMove : undefined}
      onPointerUp={interactive && onPointerUp ? onPointerUp : undefined}
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
              onDragOver={interactive && onDragOver ? (e) => onDragOver(e, rowIndex, colIndex) : undefined}
              onDragEnter={interactive ? (e) => e.preventDefault() : undefined}
              onDrop={interactive && onDrop ? (e) => onDrop(e, rowIndex, colIndex) : undefined}
              className={`
                border-2 transition-all relative
                ${cell.active
                  ? interactive
                    ? 'bg-gray-700 dark:bg-gray-600 border-gray-600 dark:border-gray-500'
                    : 'bg-gray-800 dark:bg-gray-700 border-gray-700 dark:border-gray-600'
                  : 'bg-gray-900 dark:bg-black border-gray-800 dark:border-gray-900 opacity-30'}
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
              {/* Piece indicator dot if occupied (hidden during drag/place operations, only for interactive mode) */}
              {cell.piece && interactive && !placingPiece && !draggingPiece && onUnsocketPiece && (
                <div
                  className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-blue-500/20 transition-colors"
                  onClick={() => onUnsocketPiece(rowIndex, colIndex)}
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

      {/* Placed Pieces Overlay - Render as individual gems + lines using EngravingPiece */}
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

              // Skip if this is the piece currently being dragged (only in interactive mode)
              if (interactive && draggingFromGrid &&
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
                  gapSize={gapSize}
                  gridPadding={gridPadding}
                  lineThickness={lineThickness}
                  interactive={interactive}
                  onDragStart={onDragPlacedPiece}
                  onDragEnd={onDragEnd}
                  onTouchStart={onTouchStartPlacedPiece}
                  onClick={onClickPlacedPiece}
                  zIndexBase={10}
                />
              );
            }
            return null;
          })
        );
      })()}
    </div>
  );
};

export default SoulWeaponEngravingGrid;
