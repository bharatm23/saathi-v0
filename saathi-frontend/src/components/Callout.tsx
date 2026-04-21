import { cn } from "@/lib/utils";

type Kind = "info" | "positive" | "caution";

const kinds: Record<Kind, string> = {
  info:     "border-navy bg-navy/5",
  positive: "border-teal bg-teal/[0.06]",
  caution:  "border-amber bg-amber/[0.06]",
};

export function Callout({
  kind = "info",
  children,
  className,
}: {
  kind?: Kind;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-l-4 px-4 py-3 rounded-sm", kinds[kind], className)}>
      {children}
    </div>
  );
}
