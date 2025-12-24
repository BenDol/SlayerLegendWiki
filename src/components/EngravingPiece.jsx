import React from 'react';

/**
 * EngravingPiece Component
 *
 * Renders an engraving piece with gems and connecting lines.
 * Can be used in both interactive grids and static displays.
 *
 * @param {Object} piece - Piece data { shape, rarity, rotation, anchorRow, anchorCol }
 * @param {number} cellSize - Size of each cell in pixels
 * @param {number} gapSize - Gap between cells in pixels
 * @param {number} gridPadding - Padding around the grid
 * @param {number} lineThickness - Thickness of lines between gems
 * @param {boolean} interactive - Whether piece is draggable/clickable
 * @param {Function} onDragStart - Handler for drag start
 * @param {Function} onDragEnd - Handler for drag end
 * @param {Function} onTouchStart - Handler for touch start
 * @param {Function} onClick - Handler for click
 * @param {number} zIndexBase - Base z-index for layering (lines at base, gems at base+1)
 * @param {number} scale - Scale multiplier for mini grids (default 1)
 */
const EngravingPiece = ({
  piece,
  cellSize,
  gapSize = 4,
  gridPadding = 16,
  lineThickness = 8,
  interactive = false,
  onDragStart = null,
  onDragEnd = null,
  onTouchStart = null,
  onClick = null,
  zIndexBase = 4,
  scale = 1
}) => {
  // Track if drag actually started to distinguish clicks from drags
  const dragStartedRef = React.useRef(false);
  const mouseDownTimeRef = React.useRef(0);
  const mouseDownPosRef = React.useRef({ x: 0, y: 0 });
  // Utility functions
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

  const areAdjacent = (row1, col1, row2, col2) => {
    const rowDiff = Math.abs(row1 - row2);
    const colDiff = Math.abs(col1 - col2);
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
  };

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

  const getRarityImageName = (rarity) => {
    const names = ['Common', 'Great', 'Rare', 'Epic', 'Legendary', 'Mythic'];
    return names[rarity] || 'Common';
  };

  // Calculate pattern and cells
  const pattern = getRotatedPattern(piece.shape.pattern, piece.rotation || 0);
  const filledCells = getFilledCells(pattern, piece.anchorRow, piece.anchorCol);
  const rarityColor = getRarityColor(piece.rarity);
  const rarityImageName = getRarityImageName(piece.rarity);

  // Scale dimensions
  const scaledCellSize = cellSize * scale;
  const scaledGapSize = gapSize * scale;
  const scaledGridPadding = gridPadding * scale;
  const scaledLineThickness = lineThickness * scale;

  return (
    <React.Fragment>
      {/* Draw lines between adjacent gems */}
      {filledCells.map((cell1, idx1) =>
        filledCells.slice(idx1 + 1).map((cell2, idx2) => {
          if (areAdjacent(cell1.row, cell1.col, cell2.row, cell2.col)) {
            const isHorizontal = cell1.row === cell2.row;

            if (isHorizontal) {
              // Horizontal line
              const leftCol = Math.min(cell1.col, cell2.col);
              const x = scaledGridPadding + leftCol * (scaledCellSize + scaledGapSize) + scaledCellSize / 2;
              const y = scaledGridPadding + cell1.row * (scaledCellSize + scaledGapSize) + scaledCellSize / 2;
              const width = scaledCellSize + scaledGapSize;

              return (
                <div
                  key={`line-h-${cell1.row}-${cell1.col}-${cell2.col}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${x}px`,
                    top: `${y - scaledLineThickness / 2}px`,
                    width: `${width}px`,
                    height: `${scaledLineThickness}px`,
                    backgroundColor: rarityColor,
                    zIndex: zIndexBase
                  }}
                />
              );
            } else {
              // Vertical line
              const topRow = Math.min(cell1.row, cell2.row);
              const x = scaledGridPadding + cell1.col * (scaledCellSize + scaledGapSize) + scaledCellSize / 2;
              const y = scaledGridPadding + topRow * (scaledCellSize + scaledGapSize) + scaledCellSize / 2;
              const height = scaledCellSize + scaledGapSize;

              return (
                <div
                  key={`line-v-${cell1.row}-${cell2.row}-${cell1.col}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${x - scaledLineThickness / 2}px`,
                    top: `${y}px`,
                    width: `${scaledLineThickness}px`,
                    height: `${height}px`,
                    backgroundColor: rarityColor,
                    zIndex: zIndexBase
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

        return (
          <div
            key={`gem-${filledCell.row}-${filledCell.col}`}
            data-draggable-piece={interactive ? 'true' : undefined}
            draggable={interactive}
            onMouseDown={(e) => {
              if (interactive) {
                dragStartedRef.current = false;
                mouseDownTimeRef.current = Date.now();
                mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
              }
            }}
            onDragStart={(e) => {
              if (interactive && onDragStart) {
                dragStartedRef.current = true;
                onDragStart(e, piece, filledCell.patternRow, filledCell.patternCol);
              }
            }}
            onDragEnd={(e) => interactive && onDragEnd && onDragEnd(e)}
            onTouchStart={(e) => interactive && onTouchStart && onTouchStart(e, piece, filledCell.patternRow, filledCell.patternCol)}
            onMouseUp={(e) => {
              if (interactive && onClick) {
                const timeDiff = Date.now() - mouseDownTimeRef.current;
                const dx = e.clientX - mouseDownPosRef.current.x;
                const dy = e.clientY - mouseDownPosRef.current.y;
                const moveDiff = Math.sqrt(dx * dx + dy * dy);

                // If no drag started, mouse was down briefly, and didn't move much, treat as click
                if (!dragStartedRef.current && timeDiff < 300 && moveDiff < 5) {
                  e.preventDefault();
                  e.stopPropagation();
                  onClick(e, piece);
                }
              }
            }}
            className={`absolute ${interactive ? 'cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity' : 'pointer-events-none'}`}
            style={{
              left: `${scaledGridPadding + filledCell.col * (scaledCellSize + scaledGapSize)}px`,
              top: `${scaledGridPadding + filledCell.row * (scaledCellSize + scaledGapSize)}px`,
              width: `${scaledCellSize}px`,
              height: `${scaledCellSize}px`,
              zIndex: zIndexBase + 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={interactive ? 'Quick click to edit, click and hold to drag' : undefined}
          >
            <img
              src={imageSrc}
              alt="gem"
              draggable={false}
              className="object-contain"
              style={{
                pointerEvents: 'none',
                width: '80%',
                height: '80%'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        );
      })}
    </React.Fragment>
  );
};

export default EngravingPiece;
