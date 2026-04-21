import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-white border border-gray-200 rounded-2xl shadow-sm", className)}
      {...props}
    />
  );
}
