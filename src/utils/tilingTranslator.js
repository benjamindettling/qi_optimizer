export const buildTilingMask = (width, height, isCellUnlocked) => {
  const mask = Array.from({ length: height }, () => Array(width).fill(true));
  if (typeof isCellUnlocked !== "function") return mask;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      mask[y][x] = !!isCellUnlocked(x, y);
    }
  }

  return mask;
};

export const buildTilingGroups = (layout, extras = []) => {
  const groups = [];
  const byKey = new Map();

  const ensureGroup = (width, height) => {
    const key = `${width}x${height}`;
    let group = byKey.get(key);
    if (!group) {
      group = {
        width,
        height,
        instances: [],
        extras: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    return group;
  };

  (layout || []).forEach((inst) => {
    if (!inst) return;
    const width = inst.width | 0;
    const height = inst.height | 0;
    if (width <= 0 || height <= 0) return;
    ensureGroup(width, height).instances.push(inst);
  });

  (extras || []).forEach((extra) => {
    if (!extra) return;
    const width = extra.width ?? extra.size?.[0];
    const height = extra.height ?? extra.size?.[1];
    const count = Math.max(1, extra.count ?? 1);
    if (!width || !height) return;
    const group = ensureGroup(width, height);
    for (let i = 0; i < count; i += 1) {
      group.extras.push(extra);
    }
  });

  const blocks = groups.map((group) => ({
    width: group.width,
    height: group.height,
    count: group.instances.length + group.extras.length,
  }));

  return { groups, blocks };
};

export const applyTilingSolution = (placements, groups, nextIdStart) => {
  if (!placements) return null;
  const byType = new Map();
  placements.forEach((p) => {
    if (!p || p.isFiller) return;
    const typeIndex = p.typeIndex ?? null;
    if (typeIndex === null) return;
    if (!byType.has(typeIndex)) byType.set(typeIndex, []);
    byType.get(typeIndex).push(p);
  });

  const nextLayout = [];
  const created = [];
  let nextId = nextIdStart;

  for (let idx = 0; idx < groups.length; idx += 1) {
    const group = groups[idx];
    const placementsForGroup = byType.get(idx) || [];
    const expected = group.instances.length + group.extras.length;
    if (placementsForGroup.length !== expected) return null;
    placementsForGroup.sort((a, b) => a.y - b.y || a.x - b.x);

    let cursor = 0;
    group.instances.forEach((inst) => {
      const p = placementsForGroup[cursor++];
      nextLayout.push({
        ...inst,
        x: p.x,
        y: p.y,
        width: group.width,
        height: group.height,
      });
    });

    group.extras.forEach((extra) => {
      const p = placementsForGroup[cursor++];
      const defId = extra.defId ?? extra.id ?? null;
      if (!defId) return;
      const width = extra.width ?? group.width;
      const height = extra.height ?? group.height;
      const id = nextId++;
      nextLayout.push({ id, defId, x: p.x, y: p.y, width, height });
      created.push({ id, defId, width, height });
    });
  }

  return { layout: nextLayout, nextId, created };
};
