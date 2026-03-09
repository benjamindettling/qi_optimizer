import { QA_BASE_PER_HOUR } from "../config/gameDefaults";

const toFiniteNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const normalizeQaStep = (step) =>
  Math.max(0, Math.floor(toFiniteNumber(step, 0)));

export const getOutsideQaPerHour = (config) => {
  const onlyCountQaFromSetup = config?.onlyCountQaFromSetup !== false;
  if (onlyCountQaFromSetup) return 0;
  return QA_BASE_PER_HOUR + toFiniteNumber(config?.qaBaseBonus, 0);
};

export const getQaHoursPerStep = (config, fallbackHours = 12) => {
  const fallback = toFiniteNumber(fallbackHours, 12);
  const hours = toFiniteNumber(config?.qaHarvestHours, fallback);
  return hours > 0 ? hours : fallback;
};

export const getOutsideQaTotalForStep = ({
  step,
  qaOutsidePerHour = 0,
  qaHoursPerStep = 12,
}) => {
  const safeHours = Math.max(0, toFiniteNumber(qaHoursPerStep, 12));
  const safeOutsidePerHour = toFiniteNumber(qaOutsidePerHour, 0);
  return normalizeQaStep(step) * safeHours * safeOutsidePerHour;
};

export const getOutsideQaDeltaForStepChange = ({
  fromStep,
  toStep,
  qaOutsidePerHour = 0,
  qaHoursPerStep = 12,
}) =>
  getOutsideQaTotalForStep({
    step: toStep,
    qaOutsidePerHour,
    qaHoursPerStep,
  }) -
  getOutsideQaTotalForStep({
    step: fromStep,
    qaOutsidePerHour,
    qaHoursPerStep,
  });
