export interface GradeDefinition {
  value: string;
  label: string;
  category: "Kindergarten" | "Primary School" | "Middle School" | "High School" | "Higher Secondary (+1 & +2)";
  standardNumber?: number;
}

export const ALL_GRADES: GradeDefinition[] = [
  // Kindergarten
  { value: "LKG", label: "LKG (Lower Kindergarten)", category: "Kindergarten", standardNumber: 0 },
  { value: "UKG", label: "UKG (Upper Kindergarten)", category: "Kindergarten", standardNumber: 0 },
  { value: "Kindergarten", label: "Kindergarten (KG)", category: "Kindergarten", standardNumber: 0 },

  // Primary School (1st to 5th)
  { value: "1st Grade", label: "1st Grade (Class 1)", category: "Primary School", standardNumber: 1 },
  { value: "2nd Grade", label: "2nd Grade (Class 2)", category: "Primary School", standardNumber: 2 },
  { value: "3rd Grade", label: "3rd Grade (Class 3)", category: "Primary School", standardNumber: 3 },
  { value: "4th Grade", label: "4th Grade (Class 4)", category: "Primary School", standardNumber: 4 },
  { value: "5th Grade", label: "5th Grade (Class 5)", category: "Primary School", standardNumber: 5 },

  // Middle School (6th to 8th)
  { value: "6th Grade", label: "6th Grade (Class 6)", category: "Middle School", standardNumber: 6 },
  { value: "7th Grade", label: "7th Grade (Class 7)", category: "Middle School", standardNumber: 7 },
  { value: "8th Grade", label: "8th Grade (Class 8)", category: "Middle School", standardNumber: 8 },

  // High School (9th & 10th)
  { value: "9th Grade", label: "9th Grade (Class 9)", category: "High School", standardNumber: 9 },
  { value: "10th Grade", label: "10th Grade (SSLC / CBSE 10th)", category: "High School", standardNumber: 10 },

  // Higher Secondary / Plus Two (+1 & +2)
  { value: "11th Grade", label: "Plus One (+1 / 11th Grade)", category: "Higher Secondary (+1 & +2)", standardNumber: 11 },
  { value: "12th Grade", label: "Plus Two (+2 / 12th Grade)", category: "Higher Secondary (+1 & +2)", standardNumber: 12 },
  { value: "NEET / JEE Prep", label: "Entrance Coaching (NEET / JEE / KEAM)", category: "Higher Secondary (+1 & +2)", standardNumber: 13 },
];

export const GRADE_FILTER_OPTIONS = [
  { value: "ALL", label: "All Grades (KG to Plus Two)" },
  { value: "KG", label: "Kindergarten (LKG / UKG)" },
  { value: "1st", label: "1st Grade" },
  { value: "2nd", label: "2nd Grade" },
  { value: "3rd", label: "3rd Grade" },
  { value: "4th", label: "4th Grade" },
  { value: "5th", label: "5th Grade" },
  { value: "6th", label: "6th Grade" },
  { value: "7th", label: "7th Grade" },
  { value: "8th", label: "8th Grade" },
  { value: "9th", label: "9th Grade" },
  { value: "10th", label: "10th Grade (SSLC / CBSE)" },
  { value: "11th", label: "Plus One (+1 / 11th)" },
  { value: "12th", label: "Plus Two (+2 / 12th)" },
  { value: "NEET", label: "Entrance (NEET / JEE)" },
];

export const TEACHER_PRESET_GRADES = [
  "KG (LKG / UKG)",
  "Primary (1st–5th)",
  "Middle (6th–8th)",
  "High School (9th–10th)",
  "Plus One (+1 / 11th)",
  "Plus Two (+2 / 12th)",
  "NEET Prep",
  "JEE Main",
];
