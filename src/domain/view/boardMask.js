// Generate SVG path for the playable region mask
import { REGION_SIZE, REGION_COLS, REGION_ROWS, REGION_MASK } from "../../config/boardConfig";

/**
 * Check if a region at (row, col) is playable (not void)
 */
const isPlayable = (row, col) => {
  if (row < 0 || row >= REGION_ROWS || col < 0 || col >= REGION_COLS) {
    return false;
  }
  return REGION_MASK[row]?.[col] !== "N";
};

/**
 * Generate the outline path for the playable regions.
 * Uses a marching squares approach to trace the boundary.
 * Returns an SVG path string with the outline.
 */
export const generatePlayableOutlinePath = (cornerRadius = 8) => {
  // Create a grid of cells (in region units)
  // We'll trace the boundary between playable and non-playable regions
  
  // Find all boundary edges
  const edges = [];
  
  for (let row = 0; row < REGION_ROWS; row++) {
    for (let col = 0; col < REGION_COLS; col++) {
      if (!isPlayable(row, col)) continue;
      
      const x = col * REGION_SIZE;
      const y = row * REGION_SIZE;
      const size = REGION_SIZE;
      
      // Check each edge of this region
      // Top edge
      if (!isPlayable(row - 1, col)) {
        edges.push({ x1: x, y1: y, x2: x + size, y2: y, dir: "right" });
      }
      // Right edge
      if (!isPlayable(row, col + 1)) {
        edges.push({ x1: x + size, y1: y, x2: x + size, y2: y + size, dir: "down" });
      }
      // Bottom edge
      if (!isPlayable(row + 1, col)) {
        edges.push({ x1: x + size, y1: y + size, x2: x, y2: y + size, dir: "left" });
      }
      // Left edge
      if (!isPlayable(row, col - 1)) {
        edges.push({ x1: x, y1: y + size, x2: x, y2: y, dir: "up" });
      }
    }
  }
  
  if (edges.length === 0) return "";
  
  // Chain edges into a continuous path
  const chainedPaths = [];
  const usedEdges = new Set();
  
  while (usedEdges.size < edges.length) {
    // Find an unused edge to start
    let startIdx = -1;
    for (let i = 0; i < edges.length; i++) {
      if (!usedEdges.has(i)) {
        startIdx = i;
        break;
      }
    }
    if (startIdx === -1) break;
    
    const path = [];
    let currentEdge = edges[startIdx];
    usedEdges.add(startIdx);
    path.push({ x: currentEdge.x1, y: currentEdge.y1 });
    path.push({ x: currentEdge.x2, y: currentEdge.y2 });
    
    // Keep finding connected edges
    let searching = true;
    while (searching) {
      searching = false;
      const lastPoint = path[path.length - 1];
      
      for (let i = 0; i < edges.length; i++) {
        if (usedEdges.has(i)) continue;
        const edge = edges[i];
        
        if (edge.x1 === lastPoint.x && edge.y1 === lastPoint.y) {
          usedEdges.add(i);
          path.push({ x: edge.x2, y: edge.y2 });
          searching = true;
          break;
        }
      }
    }
    
    chainedPaths.push(path);
  }
  
  // Convert paths to SVG path string with rounded corners
  const pathStrings = chainedPaths.map(path => {
    if (path.length < 3) return "";
    
    // Remove duplicate end point if it matches start
    if (path[0].x === path[path.length - 1].x && path[0].y === path[path.length - 1].y) {
      path.pop();
    }
    
    const r = cornerRadius;
    let d = "";
    
    for (let i = 0; i < path.length; i++) {
      const prev = path[(i - 1 + path.length) % path.length];
      const curr = path[i];
      const next = path[(i + 1) % path.length];
      
      // Direction from prev to curr
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      
      // Direction from curr to next
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      
      if (len1 === 0 || len2 === 0) continue;
      
      // Normalize
      const ux1 = dx1 / len1;
      const uy1 = dy1 / len1;
      const ux2 = dx2 / len2;
      const uy2 = dy2 / len2;
      
      // Check if this is a corner (direction change)
      const dot = ux1 * ux2 + uy1 * uy2;
      const isCorner = Math.abs(dot) < 0.1; // Nearly perpendicular
      
      if (isCorner && r > 0) {
        // Calculate corner arc
        const actualR = Math.min(r, len1 / 2, len2 / 2);
        const arcStart = {
          x: curr.x - ux1 * actualR,
          y: curr.y - uy1 * actualR
        };
        const arcEnd = {
          x: curr.x + ux2 * actualR,
          y: curr.y + uy2 * actualR
        };
        
        if (i === 0) {
          d += `M ${arcStart.x} ${arcStart.y} `;
        } else {
          d += `L ${arcStart.x} ${arcStart.y} `;
        }
        
        // Determine sweep direction (clockwise or counter-clockwise)
        const cross = ux1 * uy2 - uy1 * ux2;
        const sweep = cross > 0 ? 1 : 0;
        
        d += `A ${actualR} ${actualR} 0 0 ${sweep} ${arcEnd.x} ${arcEnd.y} `;
      } else {
        if (i === 0) {
          d += `M ${curr.x} ${curr.y} `;
        } else {
          d += `L ${curr.x} ${curr.y} `;
        }
      }
    }
    
    d += "Z";
    return d;
  });
  
  return pathStrings.join(" ");
};

/**
 * Generate a clip path polygon (simpler, no rounded corners)
 */
export const generateClipPathPolygon = () => {
  const points = [];
  
  // Trace the outer boundary - simplified approach
  // Start from top-left playable region and go clockwise
  
  for (let row = 0; row < REGION_ROWS; row++) {
    for (let col = 0; col < REGION_COLS; col++) {
      if (!isPlayable(row, col)) continue;
      
      const x = col * REGION_SIZE;
      const y = row * REGION_SIZE;
      const size = REGION_SIZE;
      
      // Add corners that are on the boundary
      if (!isPlayable(row - 1, col) || !isPlayable(row, col - 1)) {
        points.push({ x, y });
      }
      if (!isPlayable(row - 1, col) || !isPlayable(row, col + 1)) {
        points.push({ x: x + size, y });
      }
      if (!isPlayable(row + 1, col) || !isPlayable(row, col + 1)) {
        points.push({ x: x + size, y: y + size });
      }
      if (!isPlayable(row + 1, col) || !isPlayable(row, col - 1)) {
        points.push({ x, y: y + size });
      }
    }
  }
  
  return points;
};

/**
 * Get the bounding box of playable regions (in cells)
 */
export const getPlayableBounds = () => {
  let minCol = REGION_COLS, maxCol = 0;
  let minRow = REGION_ROWS, maxRow = 0;
  
  for (let row = 0; row < REGION_ROWS; row++) {
    for (let col = 0; col < REGION_COLS; col++) {
      if (isPlayable(row, col)) {
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
    }
  }
  
  return {
    minCol: minCol * REGION_SIZE,
    maxCol: (maxCol + 1) * REGION_SIZE,
    minRow: minRow * REGION_SIZE,
    maxRow: (maxRow + 1) * REGION_SIZE,
    width: (maxCol - minCol + 1) * REGION_SIZE,
    height: (maxRow - minRow + 1) * REGION_SIZE,
  };
};
