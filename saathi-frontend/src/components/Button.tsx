import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy/90 border-navy",
  ghost:   "text-gray-700 hover:bg-gray-100 border-transparent",
  outline: "bg-white text-gray-700 hover:bg-gray-50 border-gray-300",
};

const sizes: Record<Size, string> = {
  sm: "text-[12px] px-3 h-8 rounded-lg gap-1.5",
  md: "text-[13px] px-4 h-10 rounded-xl gap-2",
  lg: "text-[14px] px-5 h-12 rounded-xl gap-2 font-medium w-full",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: { variant?: Variant; size?: Size } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
