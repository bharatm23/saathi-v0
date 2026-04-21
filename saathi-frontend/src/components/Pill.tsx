import { cn } from "@/lib/utils";

type Tone = "navy" | "blue" | "teal" | "amber" | "red" | "gray";

const tones: Record<Tone, string> = {
  navy:  "bg-navy/10 text-navy border-navy/20",
  blue:  "bg-blue/10 text-blue border-blue/30",
  teal:  "bg-teal/10 text-teal border-teal/30",
  amber: "bg-amber/10 text-amber border-amber/30",
  red:   "bg-red/10 text-red border-red/30",
  gray:  "bg-gray-100 text-gray-700 border-gray-200",
};

export function Pill({
  children,
  tone = "gray",
  className,
  ...props
}: { tone?: Tone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
