/**
 * Trainer hourly pay rates by student standard.
 *
 * A trainer has a base rate plus optional per-tier overrides (stored as JSON in
 * Teacher.gradeRates). Tiers without an override use the default formula below,
 * which is unchanged from the original payout calculation.
 */

export type RateTierKey = "PRIMARY" | "MIDDLE" | "SECONDARY" | "TENTH" | "PLUS_ONE" | "PLUS_TWO";

export interface RateTier {
  key: RateTierKey;
  label: string;
  offset: number;
  floor: number;
}

export const RATE_TIERS: RateTier[] = [
  { key: "PRIMARY", label: "KG – 5th Standard", offset: 0, floor: 150 },
  { key: "MIDDLE", label: "6th – 7th Standard", offset: 0, floor: 150 },
  { key: "SECONDARY", label: "8th – 9th Standard", offset: 0, floor: 150 },
  { key: "TENTH", label: "10th Standard", offset: 0, floor: 150 },
  { key: "PLUS_ONE", label: "Plus One (+1)", offset: 50, floor: 200 },
  { key: "PLUS_TWO", label: "Plus Two (+2)", offset: 50, floor: 200 },
];

export const STANDARD_TIER_RATES: Record<RateTierKey, number> = {
  PRIMARY: 150,
  MIDDLE: 150,
  SECONDARY: 150,
  TENTH: 150,
  PLUS_ONE: 200,
  PLUS_TWO: 200,
};

export const RATE_LIMITS = { min: 100, max: 100000 };

/**
 * Keys written by earlier versions of the Add / Edit trainer forms. They are
 * read so existing custom rates keep applying; new saves use RateTierKey.
 */
const LEGACY_KEYS: Record<string, RateTierKey> = {
  "KG / Primary": "PRIMARY",
  "Middle School": "MIDDLE",
  "8th Grade": "SECONDARY",
  "9th Grade": "SECONDARY",
  "10th Grade": "TENTH",
  "11th Grade": "PLUS_ONE",
  "12th Grade": "PLUS_TWO",
  "KG–Primary (1st–4th)": "PRIMARY",
  "Middle School (5th–7th)": "MIDDLE",
  "Secondary (8th–9th)": "SECONDARY",
  "10th Standard (SSLC/CBSE)": "TENTH",
  "Plus One (+1)": "PLUS_ONE",
  "Plus Two (+2)": "PLUS_TWO",
};

export type GradeRateOverrides = Partial<Record<RateTierKey, number>>;

const TIER_KEYS = RATE_TIERS.map((t) => t.key);

export function parseGradeRates(json: string | null | undefined): GradeRateOverrides {
  if (!json) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const result: GradeRateOverrides = {};
  for (const [rawKey, rawValue] of Object.entries(parsed as Record<string, unknown>)) {
    const key = (TIER_KEYS as string[]).includes(rawKey) ? (rawKey as RateTierKey) : LEGACY_KEYS[rawKey];
    const value = Number(rawValue);
    // Canonical keys win over legacy aliases for the same tier.
    if (key && Number.isFinite(value) && value > 0 && (result[key] === undefined || rawKey === key)) {
      result[key] = Math.round(value);
    }
  }
  return result;
}

export function serializeGradeRates(overrides: GradeRateOverrides): string | null {
  const clean: GradeRateOverrides = {};
  for (const key of TIER_KEYS) {
    const value = overrides[key];
    if (typeof value === "number" && value > 0) clean[key] = value;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

export function defaultTierRate(baseRate: number, tier: RateTierKey): number {
  if (baseRate && baseRate !== 150 && baseRate !== 500) {
    if (tier === "PLUS_ONE" || tier === "PLUS_TWO") {
      return baseRate + 50;
    }
    return baseRate;
  }
  return STANDARD_TIER_RATES[tier];
}

/** Classifies a student grade label into a pay tier (null when unrecognised). */
export function tierForGrade(studentGrade: string | null | undefined): RateTierKey | null {
  if (!studentGrade) return null;
  const g = studentGrade.toLowerCase().trim();

  // Plus Two / 12th
  if (
    /\b(12|12th|\+2|plus two|neet|jee)\b/.test(g) ||
    g.includes("12th") || g.includes("+2") || g.includes("plus two") ||
    g.includes("neet") || g.includes("jee")
  ) {
    return "PLUS_TWO";
  }

  // Plus One / 11th
  if (
    /\b(11|11th|\+1|plus one)\b/.test(g) ||
    g.includes("11th") || g.includes("+1") || g.includes("plus one")
  ) {
    return "PLUS_ONE";
  }

  // 10th Standard
  if (
    /\b(10|10th|sslc|matric)\b/.test(g) ||
    g.includes("10th") || g.includes("sslc") || g.includes("matric")
  ) {
    return "TENTH";
  }

  // 8th - 9th Standard
  if (
    /\b(8|8th|9|9th)\b/.test(g) ||
    g.includes("8th") || g.includes("9th")
  ) {
    return "SECONDARY";
  }

  // 6th - 7th Standard
  if (
    /\b(6|6th|7|7th|middle)\b/.test(g) ||
    g.includes("6th") || g.includes("7th") || g.includes("middle")
  ) {
    return "MIDDLE";
  }

  // KG - 5th Standard
  if (
    /\b(kg|lkg|ukg|1|1st|2|2nd|3|3rd|4|4th|5|5th|primary|kindergarten)\b/.test(g) ||
    g.includes("1st") || g.includes("2nd") || g.includes("3rd") || g.includes("4th") || g.includes("5th") ||
    g.includes("primary") || g.includes("kg") || g.includes("kindergarten")
  ) {
    return "PRIMARY";
  }

  return null;
}

type RateSource = { defaultRate?: number | null; gradeRates?: string | null } | null | undefined;

export function getTierRate(teacher: RateSource, tier: RateTierKey): number {
  const overrides = parseGradeRates(teacher?.gradeRates);
  if (overrides[tier] !== undefined) {
    return overrides[tier]!;
  }
  const baseRate = Number(teacher?.defaultRate) || 150;
  return defaultTierRate(baseRate, tier);
}

/** Hourly rate used for payouts: the tier override if set, otherwise the default formula. */
export function getTeacherRateForGrade(teacher: RateSource, studentGrade?: string | null): number {
  const tier = tierForGrade(studentGrade);
  if (tier) return getTierRate(teacher, tier);
  const baseRate = Number(teacher?.defaultRate);
  return baseRate && baseRate !== 500 ? baseRate : 150;
}
