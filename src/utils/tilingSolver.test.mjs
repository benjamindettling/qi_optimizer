import { solveTilingMask, renderSolution } from "./tilingSolver.js";

const maskBig = Array.from({ length: 20 }, () =>
  Array.from({ length: 12 }, () => 1)
);

const cases = [
  {
    name: "Feasible (1,17,10)",
    blocks: [
      { width: 6, height: 7, count: 1 },
      { width: 3, height: 3, count: 17 },
      { width: 2, height: 2, count: 10 },
    ],
    expect: true,
  },
  {
    name: "Infeasible (1,17,11)",
    blocks: [
      { width: 6, height: 7, count: 1 },
      { width: 3, height: 3, count: 17 },
      { width: 2, height: 2, count: 11 },
    ],
    expect: false,
  },
];

cases.forEach((c) => {
  console.log(`\n--- ${c.name} ---`);
  const placements = solveTilingMask(maskBig, c.blocks, { allowGaps: true });
  const ok = !!placements;
  if (ok !== c.expect) {
    console.error(
      `Unexpected result: got ${ok ? "tiling" : "no tiling"}, expected ${
        c.expect ? "tiling" : "no tiling"
      }`
    );
    process.exit(1);
  }
  if (!placements) {
    console.log("No tiling (pruned quickly).");
  } else {
    console.log("Tiling found. Simplified layout:");
    console.log(renderSolution(maskBig, placements, 1));
    console.log("\nPlacements:");
    placements.forEach((p) =>
      console.log(
        `type ${p.typeIndex + 1}${p.isFiller ? " (filler)" : ""} at (${p.x},${
          p.y
        }) size ${p.width}x${p.height}`
      )
    );
  }
});
