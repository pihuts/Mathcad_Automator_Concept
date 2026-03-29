export const UNIT_PRESETS = [
  { value: "", label: "Unitless (no units)" },
  { value: "in", label: "in (inches)" },
  { value: "ft", label: "ft (feet)" },
  { value: "mm", label: "mm (millimeters)" },
  { value: "m", label: "m (meters)" },
  { value: "kip", label: "kip (kilopound force)" },
  { value: "lbf", label: "lbf (pound force)" },
  { value: "N", label: "N (newton)" },
  { value: "kN", label: "kN (kilonewton)" },
  { value: "Pa", label: "Pa (pascal)" },
  { value: "MPa", label: "MPa (megapascal)" },
  { value: "psi", label: "psi (pounds per square inch)" },
  { value: "ksf", label: "ksf (kip per square foot)" },
  { value: "kip/ft", label: "kip/ft (force per length)" },
  { value: "kip-in", label: "kip-in (moment)" },
  { value: "lb-ft", label: "lb-ft (pound-foot moment)" },
] as const;

export type UnitPreset = typeof UNIT_PRESETS[number]['value'];
