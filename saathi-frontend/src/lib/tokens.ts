/**
 * Saathi design tokens. Single source of truth for colors & typography.
 * Mirrored by tailwind.config.ts → use Tailwind classes in components.
 */
export const tokens = {
  colors: {
    navy:  "#0F2D52",
    blue:  "#1A56A0",
    teal:  "#0E7C7B",
    amber: "#A85C00",
    red:   "#A8001E",
    gray: {
      50:  "#F9FAFB",
      100: "#F3F4F6",
      200: "#E5E7EB",
      300: "#D1D5DB",
      400: "#9CA3AF",
      500: "#6B7280",
      700: "#374151",
      900: "#111827",
    },
  },
  type: {
    pageTitle:     "text-[20px] font-semibold text-gray-900",
    sectionHeader: "text-[16px] font-semibold text-navy",
    body:          "text-[14px] font-normal text-gray-700",
    caption:       "text-[12px] font-normal text-gray-400",
    label:         "text-[11px] font-medium uppercase tracking-wide",
  },
  layout: {
    sidebarWidth: 224,
    contentMax:   720,
  },
} as const;
