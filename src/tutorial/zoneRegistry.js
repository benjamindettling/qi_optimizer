const getUnionRect = (selectors) => {
  const rects = selectors
    .map((selector) => document.querySelector(selector))
    .filter(Boolean)
    .map((el) => el.getBoundingClientRect());
  if (!rects.length) return null;
  const minTop = Math.min(...rects.map((rect) => rect.top));
  const minLeft = Math.min(...rects.map((rect) => rect.left));
  const maxRight = Math.max(...rects.map((rect) => rect.left + rect.width));
  const maxBottom = Math.max(...rects.map((rect) => rect.top + rect.height));
  return {
    top: minTop,
    left: minLeft,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
  };
};

export const ZONE_REGISTRY = {
  board: () => document.querySelector('.board-content'),
  'shop-panel': () => document.querySelector('.shop-panel'),
  'shop-btn': () => document.querySelector('[data-tutorial-zone="shop-btn"]'),
  'mh-card': () => document.querySelector('[data-tutorial-zone="mh-card"]'),
  'church-card': () => document.querySelector('[data-tutorial-zone="church-card"]'),
  'gutshaus-card': () => document.querySelector('[data-tutorial-zone="gutshaus-card"]'),
  'shop-tab-culture': () => document.querySelector('[data-tutorial-zone="shop-tab-culture"]'),
  'mini-toolbar': () => document.querySelector('.mini-toolbar'),
  'mini-toolbar-modes': () => document.querySelector('.mini-toolbar'),
  'move-btn': () => document.querySelector('[data-tutorial-zone="move-btn"]'),
  'sell-btn': () => document.querySelector('[data-tutorial-zone="sell-btn"]'),
  'boost-btn': () => document.querySelector('[data-tutorial-zone="boost-btn"]'),
  'board-tools-group': () =>
    getUnionRect([
      '[data-tutorial-zone="move-btn"]',
      '[data-tutorial-zone="sell-btn"]',
      '[data-tutorial-zone="boost-btn"]',
    ]),
  'finish-btn': () => document.querySelector('[data-tutorial-zone="finish-btn"]'),
  'harvest-btn': () => document.querySelector('[data-tutorial-zone="harvest-btn"]'),
  topbar: () => document.querySelector('.topbar-pager-container, .topbar'),
  'topbar-stats': () => document.querySelector('.panel--stats'),
  'topbar-steps': () => document.querySelector('.panel--steps'),
  'topbar-buttons': () => document.querySelector('.panel--menu'),
  'step-tracker': () => document.querySelector('.step-tracker-panel'),
  'save-controls': () =>
    document.querySelector('[data-tutorial-zone="save-controls"], .save-controls'),
  'load-btn': () =>
    document.querySelector('[data-tutorial-zone="load-open-btn"]'),
  tree: () => document.querySelector('.tree-visualizer'),
  'tree-zoom-slider': () => document.querySelector('[data-tutorial-zone="tree-zoom-slider"]'),
  'tree-node-focus-btn': () => document.querySelector('[data-tutorial-zone="tree-node-focus-btn"]'),
  'tree-toolbar': () => document.querySelector('.tree-toolbar'),
  'tree-toolbar-focus': () => document.querySelector('[data-tutorial-zone="tree-focus-btn"]'),
  'tree-toolbar-collapse': () =>
    document.querySelector('[data-tutorial-zone="tree-collapse-btn"]'),
  'tree-toolbar-main': () => document.querySelector('[data-tutorial-zone="tree-main-btn"]'),
  'tree-toolbar-delete': () =>
    document.querySelector('[data-tutorial-zone="tree-delete-btn"]'),
  'tree-fix-btn': () => document.querySelector('[data-tutorial-zone="tree-fix-btn"]'),
  'tree-fix-popup': () => document.querySelector('[data-tutorial-zone="tree-fix-popup"]'),
  'tree-delete-confirm-popup': () =>
    document.querySelector('[data-tutorial-zone="tree-delete-confirm-popup"]'),
  notes: () => document.querySelector('.notes-card'),
  'notes-log': () => document.querySelector('.action-log-card'),
  'happiness-current': () => document.querySelector('[data-tutorial-zone="happiness-current"]'),
  'happiness-tiers': () => document.querySelector('[data-tutorial-zone="happiness-tiers"]'),
  'harvest-modal': () => document.querySelector('[data-tutorial-zone="harvest-modal"]'),
  'help-btn': () => document.querySelector('[data-tutorial-zone="help-btn"]'),
  'load-main-btn': () => document.querySelector('[data-tutorial-zone="load-main-btn"]'),
  'load-rename-btn': () => document.querySelector('[data-tutorial-zone="load-rename-btn"]'),
  'load-export-btn': () => document.querySelector('[data-tutorial-zone="load-export-btn"]'),
  'load-delete-btn': () => document.querySelector('[data-tutorial-zone="load-delete-btn"]'),
  'load-modal-close': () => document.querySelector('[data-tutorial-zone="load-modal-close-btn"]'),
};
