/**
 * Unit label mappings for Jade Ribbon UI
 * Used to display short unit symbols with their full names in ribbon badges
 */
export const UNIT_LABELS: Record<string, string> = {
  "in": "inches",
  "mm": "millimeters",
  "ft": "feet",
  "m": "meters",
  "cm": "centimeters",
  "ksi": "kip/in²",
  "kip": "kilopound",
  "lb": "pounds",
  "lbf": "pound force",
  "kN": "kilonewtons",
  "N": "newton",
  "MPa": "megapascals",
  "Pa": "pascal",
  "psi": "lb/in²",
  "ksf": "kip/ft²",
  "kip/ft": "kip/ft",
  "kip-in": "moment",
  "lb-ft": "lb-ft",
  "-": "unitless",
  "": "none",
};

/**
 * Get display values for a unit
 * @param unit - The unit string (e.g., "in", "mm", "-")
 * @returns Object with short and full display strings
 */
export const getUnitDisplay = (unit: string | undefined): { short: string; full: string } => {
  if (!unit || unit === "") {
    return { short: "—", full: "none" };
  }
  if (unit === "-") {
    return { short: "∅", full: "unitless" };
  }
  return {
    short: unit,
    full: UNIT_LABELS[unit] || unit,
  };
};
