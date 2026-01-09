export const HAPPINESS_TIERS = [
  {
    cap: 21,
    mult: 0.2,
    icon: "/happiness/Rebellisch.webp",
    label: "Rebellisch",
  },
  {
    cap: 61,
    mult: 0.6,
    icon: "/happiness/Widerspenstig.webp",
    label: "Widerspenstig",
  },
  {
    cap: 81,
    mult: 0.8,
    icon: "/happiness/QIZufriedenheit-Unzufrieden.webp",
    label: "Unzufrieden",
  },
  { cap: 121, mult: 1, icon: "/happiness/Neutral.webp", label: "Neutral" },
  {
    cap: 141,
    mult: 1.1,
    icon: "/happiness/Gehalten.webp",
    label: "Gehalten",
  },
  {
    cap: 200,
    mult: 1.2,
    icon: "/happiness/Zufrieden.webp",
    label: "Zufrieden",
  },
  {
    cap: Infinity,
    mult: 1.5,
    icon: "/happiness/Enthusiastisch.webp",
    label: "Enthusiastisch",
  },
];

export const happinessTier = (provided, required) => {
  if (required <= 0) {
    return {
      ratio: 0,
      icon: "/happiness/Enthusiastisch.webp",
      nextDelta: 0,
      label: "Enthusiastisch",
      percent: 200,
    };
  }
  const percent = (provided / required) * 100;
  const current =
    HAPPINESS_TIERS.find((t) => percent < t.cap) ||
    HAPPINESS_TIERS[HAPPINESS_TIERS.length - 1];
  const currentIdx = HAPPINESS_TIERS.indexOf(current);
  const nextTier = HAPPINESS_TIERS[currentIdx + 1];
  const nextDelta =
    !nextTier || nextTier.cap === Infinity
      ? -Math.max(0, provided - (required * current.cap) / 100)
      : Math.ceil((nextTier.cap * required) / 100 - provided);
  return {
    ratio: current.mult,
    icon: current.icon,
    nextDelta,
    label: current.label,
    percent,
  };
};

export const computeRefund = (def) => {
  const coins = Math.floor((def.cost?.coins ?? 0) * 0.25);
  const supplies = Math.floor((def.cost?.supplies ?? 0) * 0.25);
  const chronos = Math.floor((def.cost?.chronos ?? 0) * 0.25);
  return { coins, supplies, chronos };
};

export const formatGoods = (goodsBag, goodsTypes) =>
  goodsTypes.map((k) => `${k}: ${goodsBag[k] ?? 0}`).join(" | ");

const sumCost = (cost) => (cost?.coins ?? 0) + (cost?.supplies ?? 0);

export const computePurchasePlans = (def, need) => {
  if (!def?.goodsCost || need <= 0) return [];
  const entries = Object.entries(def.goodsCost)
    .map(([amount, cost]) => ({ amount: Number(amount), cost }))
    .sort((a, b) => a.amount - b.amount);
  const maxAmount = entries[entries.length - 1].amount;
  const target = need + maxAmount;
  const dp = Array(target + 1).fill(null);
  dp[0] = { cost: 0, plan: [] };
  for (let i = 1; i <= target; i += 1) {
    entries.forEach(({ amount, cost }) => {
      if (i - amount >= 0 && dp[i - amount]) {
        const prev = dp[i - amount];
        const c = prev.cost + sumCost(cost);
        if (!dp[i] || c < dp[i].cost) {
          dp[i] = {
            cost: c,
            plan: [...prev.plan, { amount, cost }],
          };
        }
      }
    });
  }
  let best = null;
  for (let i = need; i <= target; i += 1) {
    if (dp[i] && (!best || dp[i].cost < best.cost))
      best = { ...dp[i], totalAmount: i };
  }
  const mass = entries[entries.length - 1];
  const massCount = Math.ceil(need / mass.amount);
  const massPlan = Array.from({ length: massCount }, () => ({
    amount: mass.amount,
    cost: mass.cost,
  }));
  return [
    best && {
      label: "Cheapest way",
      plan: best.plan,
      totalAmount: best.totalAmount,
      totalCost: best.cost,
    },
    {
      label: "Mass buy",
      plan: massPlan,
      totalAmount: massCount * mass.amount,
      totalCost: massCount * sumCost(mass.cost),
    },
  ].filter(Boolean);
};
