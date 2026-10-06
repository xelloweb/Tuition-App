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
  { key: "PRIMARY", label: "KG – 5th (Primary)", offset: -100, floor: 300 },
  { key: "MIDDLE", label: "6th – 7th (Middle)", offset: -75, floor: 350 },
  { key: "SECONDARY", label: "8th – 9th", offset: -50, floor: 350 },
  { key: "TENTH", label: "10th Standard", offset: 0, floor: 0 },
  { key: "PLUS_ONE", label: "Plus One (+1)", offset: 50, floor: 0 },
  { key: "PLUS_TWO", label: "Plus Two (+2) / Entrance", offset: 100, floor: 0 },
];

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
  const def = RATE_TIERS.find((t) => t.key === tier)!;
  return Math.max(def.floor, baseRate + def.offset);
}

/** Classifies a student grade label into a pay tier (null when unrecognised). */
export function tierForGrade(studentGrade: string | null | undefined): RateTierKey | null {
  if (!studentGrade) return null;
  const g = studentGrade.toLowerCase();
  if (g.includes("12th") || g.includes("+2") || g.includes("plus two") || g.includes("neet") || g.includes("jee")) {
    return "PLUS_TWO";
  }
  if (g.includes("11th") || g.includes("+1") || g.includes("plus one")) return "PLUS_ONE";
  if (g.includes("10th") || g.includes("sslc") || g.includes("matric")) return "TENTH";
  if (g.includes("8th") || g.includes("9th")) return "SECONDARY";
  if (g.includes("6th") || g.includes("7th") || g.includes("middle")) return "MIDDLE";
  if (
    g.includes("1st") || g.includes("2nd") || g.includes("3rd") || g.includes("4th") || g.includes("5th") ||
    g.includes("primary") || g.includes("kg") || g.includes("kindergarten")
  ) {
    return "PRIMARY";
  }
  return null;
}

type RateSource = { defaultRate?: number | null; gradeRates?: string | null } | null | undefined;

export function getTierRate(teacher: RateSource, tier: RateTierKey): number {
  const baseRate = Number(teacher?.defaultRate) || 500;
  return parseGradeRates(teacher?.gradeRates)[tier] ?? defaultTierRate(baseRate, tier);
}

/** Hourly rate used for payouts: the tier override if set, otherwise the default formula. */
export function getTeacherRateForGrade(teacher: RateSource, studentGrade?: string | null): number {
  const baseRate = Number(teacher?.defaultRate) || 500;
  if (!teacher) return baseRate;
  const tier = tierForGrade(studentGrade);
  return tier ? getTierRate(teacher, tier) : baseRate;
}
