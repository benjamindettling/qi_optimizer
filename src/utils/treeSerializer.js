// Serialization utilities for the history tree
// Converts between full tree structure and minimal save format

/**
 * Minimal action format - only essential fields for reconstruction
 * 
 * Action format specifications:
 * - build/buildAdmin: { t: "b"|"ba", s: shortId, x, y }
 * - sell/sellFull/sellAdmin: { t: "s"|"sf"|"sa", s: shortId, x, y, h: harvestable, l: locked }
 * - move: { t: "m", p: [[fromX, fromY, toX, toY], ...] } - position pairs, not building IDs
 * - boostUnlock/boostUnlockAdmin: { t: "bu"|"bua", s: shortId, x, y }
 * - boostReady/boostReadyAdmin: { t: "br"|"bra", s: shortId, x, y }
 * - harvest: { t: "h", s: shortId, x, y }
 * - harvestAll: { t: "H" } - always partial harvest (full harvest removed)
 * - finishProductions: { t: "fp" }
 * - goodsPurchase/goodsPurchaseAdmin: { t: "gp"|"gpa", i: goodIndex(1-5), q: {amount:count} }
 * - unitPurchase/unitPurchaseAdmin: { t: "up"|"upa", i: unitIndex(1-3), q: {amount:count} }
 * - regionUnlockGoods: { t: "rug", r: regionIdx, i?: goodIndex(1-5), a?:1 }
 * - regionUnlockShards: { t: "rus", r: regionIdx, a?:1 }
 * - regionUnlockAdmin: { t: "rua", r: regionIdx }
 * - regionLockAdmin: { t: "rla", r: regionIdx, m?:"g"|"s" }
 * - adminAdjust: { t: "aa", g: "r"|"g"|"u", k: index(1-5 or 1-3), d: delta }
 *     - g="r": resources (k: 1=coins, 2=supplies, 3=chronos, 4=shards, 5=quantumActions)
 *     - g="g": goods (k: 1-5 for the 5 goods)
 *     - g="u": units (k: 1-3 for the 3 units)
 * - goodsCostAdmin: { t: "gca", v: nextIndex }
 * - shardsCostAdmin: { t: "sca", v: nextIndex }
 */

// Goods key to index mapping (1-5)
// Must match current in-game goods keys from boardConfig/data.
const GOODS_KEYS = ["Kupfer", "Honig", "Stein", "Seil", "Schießpulver"];
const UNITS_KEYS = ["Soldat", "Reiter", "Schütze"]; // Actual unit keys in German
const RESOURCE_KEYS = ["coins", "supplies", "chronos", "shards", "quantumActions"]; // 1-5

// Compact action type mapping
const ACTION_TYPE_MAP = {
  build: "b",
  buildAdmin: "ba",
  sell: "s",
  sellFull: "sf",
  sellAdmin: "sa",
  move: "m",
  boostUnlock: "bu",
  boostUnlockAdmin: "bua",
  boostReady: "br",
  boostReadyAdmin: "bra",
  harvest: "h",
  harvestAll: "H",
  finishProductions: "fp",
  goodsPurchase: "gp",
  goodsPurchaseAdmin: "gpa",
  unitPurchase: "up",
  unitPurchaseAdmin: "upa",
  regionUnlockGoods: "rug",
  regionUnlockShards: "rus",
  regionUnlockAdmin: "rua",
  regionLockAdmin: "rla",
  adminAdjust: "aa",
  goodsCostAdmin: "gca",
  shardsCostAdmin: "sca",
};

// Reverse mapping
const REVERSE_TYPE_MAP = Object.fromEntries(
  Object.entries(ACTION_TYPE_MAP).map(([k, v]) => [v, k])
);

/**
 * Convert goods key to index (1-5)
 */
function goodsKeyToIndex(key) {
  const idx = GOODS_KEYS.indexOf(key);
  return idx >= 0 ? idx + 1 : 1; // 1-based index
}

/**
 * Convert goods index (1-5) to key
 */
function goodsIndexToKey(index) {
  return GOODS_KEYS[(index ?? 1) - 1] || GOODS_KEYS[0];
}

/**
 * Convert units key to index (1-3)
 */
function unitsKeyToIndex(key) {
  const idx = UNITS_KEYS.indexOf(key);
  return idx >= 0 ? idx + 1 : 1;
}

/**
 * Convert units index (1-3) to key
 */
function unitsIndexToKey(index) {
  return UNITS_KEYS[(index ?? 1) - 1] || UNITS_KEYS[0];
}

/**
 * Convert resource key to index (1-5)
 */
function resourceKeyToIndex(key) {
  const idx = RESOURCE_KEYS.indexOf(key);
  return idx >= 0 ? idx + 1 : 1;
}

/**
 * Convert resource index (1-5) to key
 */
function resourceIndexToKey(index) {
  return RESOURCE_KEYS[(index ?? 1) - 1] || RESOURCE_KEYS[0];
}

function normalizeQuantityMap(mapLike) {
  if (!mapLike || typeof mapLike !== "object" || Array.isArray(mapLike)) {
    return null;
  }
  const next = {};
  Object.entries(mapLike).forEach(([amountRaw, countRaw]) => {
    const amount = Number(amountRaw);
    const count = Number(countRaw);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!Number.isFinite(count) || count <= 0) return;
    const amountKey = String(amount);
    next[amountKey] = (next[amountKey] ?? 0) + Math.floor(count);
  });
  return Object.keys(next).length > 0 ? next : null;
}

function sumQuantityMap(mapLike) {
  const q = normalizeQuantityMap(mapLike);
  if (!q) return 0;
  return Object.entries(q).reduce(
    (sum, [amountRaw, count]) => sum + Number(amountRaw) * count,
    0
  );
}

/**
 * Compress an action to minimal format
 */
function compressAction(action) {
  if (!action) return null;
  
  const t = ACTION_TYPE_MAP[action.type] || action.type;
  const result = { t };
  
  switch (action.type) {
    case "build":
    case "buildAdmin":
      // Save shortId and position
      if (action.shortId) result.s = action.shortId;
      if (action.x != null) result.x = action.x;
      if (action.y != null) result.y = action.y;
      break;
      
    case "sell":
    case "sellFull":
    case "sellAdmin":
      // Save shortId, position, harvestable state, locked state
      if (action.shortId) result.s = action.shortId;
      if (action.x != null) result.x = action.x;
      if (action.y != null) result.y = action.y;
      if (action.harvestable) result.h = 1;
      if (action.locked) result.l = 1;
      break;
      
    case "move":
      // Save position pairs: [[fromX, fromY, toX, toY], ...]
      if (action.positions && action.positions.length > 0) {
        result.p = action.positions;
      } else if (Array.isArray(action.x)) {
        // Convert from old array format
        const positions = [];
        for (let i = 0; i < action.x.length; i++) {
          positions.push([action.x[i], action.y[i], action.xn[i], action.yn[i]]);
        }
        result.p = positions;
      }
      break;
      
    case "boostUnlock":
    case "boostUnlockAdmin":
    case "boostReady":
    case "boostReadyAdmin":
    case "harvest":
      // Save shortId and position
      if (action.shortId) result.s = action.shortId;
      if (action.x != null) result.x = action.x;
      if (action.y != null) result.y = action.y;
      break;
      
    case "harvestAll":
      // No extra data needed - always partial harvest
      break;
      
    case "finishProductions":
      // No extra data needed
      break;
      
    case "goodsPurchase":
    case "goodsPurchaseAdmin":
      // Store goods index (1-5) and quantity map {amount:count}
      result.i = goodsKeyToIndex(action.goodsKey ?? action.goodKey ?? action.key);
      {
        const qMap = normalizeQuantityMap(action.q);
        if (qMap) {
          result.q = qMap;
        } else if (action.quantity != null) {
          result.q = action.quantity;
        }
      }
      break;
      
    case "unitPurchase":
    case "unitPurchaseAdmin":
      // Store unit index (1-3) and quantity map {amount:count}
      result.i = unitsKeyToIndex(action.unitKey ?? action.key);
      {
        const qMap = normalizeQuantityMap(action.q);
        if (qMap) {
          result.q = qMap;
        } else if (action.quantity != null) {
          result.q = action.quantity;
        }
      }
      break;
      
    case "regionUnlockGoods":
      // Store region index, optional goods index, and optional admin flag.
      if (action.regionIdx != null) result.r = action.regionIdx;
      if (action.goodKey ?? action.goodsKey ?? action.key) {
        result.i = goodsKeyToIndex(action.goodKey ?? action.goodsKey ?? action.key);
      }
      if (action.admin) result.a = 1;
      break;
      
    case "regionUnlockShards":
      // Just the region index plus optional admin flag.
      if (action.regionIdx != null) result.r = action.regionIdx;
      if (action.admin) result.a = 1;
      break;
      
    case "regionUnlockAdmin":
      // Just the region index
      if (action.regionIdx != null) result.r = action.regionIdx;
      break;
      
    case "regionLockAdmin":
      if (action.regionIdx != null) result.r = action.regionIdx;
      if (action.method === "goods") result.m = "g";
      if (action.method === "shards") result.m = "s";
      break;
      
    case "adminAdjust":
      // Store group (r/g/u), key index (1-5 or 1-3), and delta
      if (action.group === "goods") {
        result.g = "g";
        result.k = goodsKeyToIndex(action.key);
      } else if (action.group === "units") {
        result.g = "u";
        result.k = unitsKeyToIndex(action.key);
      } else {
        // resources group (or legacy format without group)
        result.g = "r";
        result.k = resourceKeyToIndex(action.key);
      }
      if (action.delta != null) result.d = action.delta;
      break;
      
    case "goodsCostAdmin":
      // Store the new index
      if (action.nextIndex != null) result.v = action.nextIndex;
      break;
      
    case "shardsCostAdmin":
      // Store the new index
      if (action.nextIndex != null) result.v = action.nextIndex;
      break;
      
    default:
      // Store full action for unknown types
      return { t: action.type, _raw: action };
  }
  
  // Include skippable flag if set
  if (action.skippable) result.sk = 1;
  
  return result;
}

/**
 * Expand a compressed action back to full format
 */
function expandAction(compressed) {
  if (!compressed) return null;
  if (compressed._raw) return compressed._raw;
  
  const type = REVERSE_TYPE_MAP[compressed.t] || compressed.t;
  const result = { type };
  
  switch (type) {
    case "build":
    case "buildAdmin":
      if (compressed.s) result.shortId = compressed.s;
      if (compressed.x != null) result.x = compressed.x;
      if (compressed.y != null) result.y = compressed.y;
      break;
      
    case "sell":
    case "sellFull":
    case "sellAdmin":
      if (compressed.s) result.shortId = compressed.s;
      if (compressed.x != null) result.x = compressed.x;
      if (compressed.y != null) result.y = compressed.y;
      if (compressed.h) result.harvestable = true;
      if (compressed.l) result.locked = true;
      break;
      
    case "move":
      // Convert from position pairs to arrays for compatibility
      if (compressed.p && compressed.p.length > 0) {
        result.positions = compressed.p;
        // Also provide array format for backward compatibility
        result.x = compressed.p.map(p => p[0]);
        result.y = compressed.p.map(p => p[1]);
        result.xn = compressed.p.map(p => p[2]);
        result.yn = compressed.p.map(p => p[3]);
      }
      break;
      
    case "boostUnlock":
    case "boostUnlockAdmin":
    case "boostReady":
    case "boostReadyAdmin":
    case "harvest":
      if (compressed.s) result.shortId = compressed.s;
      if (compressed.x != null) result.x = compressed.x;
      if (compressed.y != null) result.y = compressed.y;
      break;
      
    case "harvestAll":
      // Always partial harvest (full harvest was removed)
      result.full = false;
      result.title = "Rest einsammeln";
      break;
      
    case "finishProductions":
      break;
      
    case "goodsPurchase":
    case "goodsPurchaseAdmin":
      result.goodsKey = goodsIndexToKey(compressed.i);
      result.key = result.goodsKey;
      if (compressed.q != null && typeof compressed.q === "object" && !Array.isArray(compressed.q)) {
        result.q = compressed.q;
        result.quantity = sumQuantityMap(compressed.q);
      } else if (compressed.q != null) {
        const qty = Number(compressed.q);
        if (Number.isFinite(qty) && qty > 0) {
          result.quantity = qty;
          result.q = { [String(qty)]: 1 };
        }
      }
      break;
      
    case "unitPurchase":
    case "unitPurchaseAdmin":
      result.unitKey = unitsIndexToKey(compressed.i);
      result.key = result.unitKey;
      if (compressed.q != null && typeof compressed.q === "object" && !Array.isArray(compressed.q)) {
        result.q = compressed.q;
        result.quantity = sumQuantityMap(compressed.q);
      } else if (compressed.q != null) {
        const qty = Number(compressed.q);
        if (Number.isFinite(qty) && qty > 0) {
          result.quantity = qty;
          result.q = { [String(qty)]: 1 };
        }
      }
      break;
      
    case "regionUnlockGoods":
      if (compressed.r != null) result.regionIdx = compressed.r;
      if (compressed.i != null) result.goodKey = goodsIndexToKey(compressed.i);
      if (compressed.a) result.admin = true;
      break;
      
    case "regionUnlockShards":
      if (compressed.r != null) result.regionIdx = compressed.r;
      if (compressed.a) result.admin = true;
      break;
      
    case "regionUnlockAdmin":
      if (compressed.r != null) result.regionIdx = compressed.r;
      break;

    case "regionLockAdmin":
      if (compressed.r != null) result.regionIdx = compressed.r;
      if (compressed.m === "g") result.method = "goods";
      if (compressed.m === "s") result.method = "shards";
      break;
      
    case "adminAdjust":
      if (compressed.g === "g") {
        result.group = "goods";
        result.key = goodsIndexToKey(compressed.k);
      } else if (compressed.g === "u") {
        result.group = "units";
        result.key = unitsIndexToKey(compressed.k);
      } else {
        // g === "r" or legacy format
        result.group = "resources";
        result.key = resourceIndexToKey(compressed.k);
      }
      if (compressed.d != null) result.delta = compressed.d;
      break;
      
    case "goodsCostAdmin":
      if (compressed.v != null) result.nextIndex = compressed.v;
      break;
      
    case "shardsCostAdmin":
      if (compressed.v != null) result.nextIndex = compressed.v;
      break;
  }
  
  // Restore skippable flag
  if (compressed.sk) result.skippable = true;
  
  return result;
}

/**
 * Serialize a tree to minimal nested array format
 * Format:
 * - A branch is an array of items
 * - An item is either an action object or an array of child branches
 * 
 * Example tree:
 *   R-A-B-C
 *    \-L-N-M
 *       \-Q
 * 
 * Serializes to:
 * [
 *   [A, B, C],                    // First child branch of R
 *   [L, [[N, M], [Q]]]            // Second child branch of R, L has children
 * ]
 */
export function serializeTree(historyTree, config) {
  const { nodes } = historyTree;
  const rootNode = nodes.get(0);
  if (!rootNode) return { config, tree: [] };
  
  function serializeBranch(nodeId) {
    const node = nodes.get(nodeId);
    if (!node) return [];
    
    const branch = [];
    let current = node;
    
    while (current) {
      // Add compressed action to branch (skip root which has no action)
      if (current.action) {
        branch.push(compressAction(current.action));
      }
      
      const children = current.childrenIds;
      
      if (children.length === 0) {
        // End of branch
        break;
      } else if (children.length === 1) {
        // Continue linear branch
        current = nodes.get(children[0]);
      } else {
        // Branch splits - add array of child branches
        const childBranches = children.map(childId => serializeBranch(childId));
        branch.push(childBranches);
        break;
      }
    }
    
    return branch;
  }
  
  // Serialize all children of root
  const tree = rootNode.childrenIds.map(childId => serializeBranch(childId));
  
  return { config, tree };
}

/**
 * Deserialize minimal format back to full tree structure
 */
export function deserializeTree(data) {
  const { config, tree } = data;
  
  const nodes = new Map();
  let nextNodeId = 1;
  
  // Create root node
  nodes.set(0, { id: 0, parentId: null, action: null, childrenIds: [] });
  
  function deserializeBranch(branchData, parentId) {
    let currentParentId = parentId;
    
    for (let i = 0; i < branchData.length; i++) {
      const item = branchData[i];
      
      if (Array.isArray(item)) {
        // This is an array of child branches
        for (const childBranch of item) {
          deserializeBranch(childBranch, currentParentId);
        }
        
        // After processing children, we're done with this branch
        break;
      } else {
        // This is an action - create a node
        const nodeId = nextNodeId++;
        const action = expandAction(item);
        
        nodes.set(nodeId, {
          id: nodeId,
          parentId: currentParentId,
          action,
          childrenIds: [],
        });
        
        // Add to parent's children
        const parent = nodes.get(currentParentId);
        parent.childrenIds.push(nodeId);
        
        // This node becomes the parent for the next item
        currentParentId = nodeId;
      }
    }
    
    return currentParentId;
  }
  
  // Deserialize all branches from root
  for (const branch of tree) {
    deserializeBranch(branch, 0);
  }
  
  return {
    config,
    historyTree: {
      nodes,
      nextNodeId,
    },
  };
}

/**
 * Get a minimal representation for display/debugging
 */
export function getTreeStats(historyTree) {
  const { nodes } = historyTree;
  let actionCount = 0;
  let branchPoints = 0;
  let maxDepth = 0;
  
  function traverse(nodeId, depth) {
    const node = nodes.get(nodeId);
    if (!node) return;
    
    if (node.action) actionCount++;
    if (node.childrenIds.length > 1) branchPoints++;
    maxDepth = Math.max(maxDepth, depth);
    
    for (const childId of node.childrenIds) {
      traverse(childId, depth + 1);
    }
  }
  
  traverse(0, 0);
  
  return { actionCount, branchPoints, maxDepth, nodeCount: nodes.size };
}

/**
 * Find the last node of the main branch (first child at each split)
 * Returns the node ID of the last action in the main branch
 */
export function getMainBranchEndNodeId(historyTree) {
  const { nodes } = historyTree;
  let currentId = 0;
  
  while (true) {
    const node = nodes.get(currentId);
    if (!node || node.childrenIds.length === 0) {
      return currentId;
    }
    // Main branch is always the first child
    currentId = node.childrenIds[0];
  }
}

// Export helper functions for use elsewhere
export { goodsKeyToIndex, goodsIndexToKey, unitsKeyToIndex, unitsIndexToKey, GOODS_KEYS, UNITS_KEYS };
