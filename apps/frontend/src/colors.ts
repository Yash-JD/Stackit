export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #a78bfa, #7c3aed)", // Violet
  "linear-gradient(135deg, #60a5fa, #2563eb)", // Blue
  "linear-gradient(135deg, #34d399, #059669)", // Emerald
  "linear-gradient(135deg, #fb7185, #e11d48)", // Rose
  "linear-gradient(135deg, #fbbf24, #d97706)", // Amber
  "linear-gradient(135deg, #22d3ee, #0891b2)", // Cyan
  "linear-gradient(135deg, #e879f9, #c026d3)", // Fuchsia
  "linear-gradient(135deg, #818cf8, #4f46e5)", // Indigo
];

export function getAvatarGradient(seed: string, offset = 0): string {
  if (!seed) return AVATAR_GRADIENTS[Math.abs(offset) % AVATAR_GRADIENTS.length];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[(Math.abs(hash) + offset) % AVATAR_GRADIENTS.length];
}

export function getTagColorClass(label: string): string {
  switch (label?.toLowerCase()) {
    case "design":
      return "tag-design";
    case "build":
      return "tag-build";
    case "research":
      return "tag-research";
    default:
      return "tag-default";
  }
}
