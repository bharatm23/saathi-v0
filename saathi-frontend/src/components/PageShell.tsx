import { cn } from "@/lib/utils";

export function PageShell({
  title,
  meta,
  actions,
  children,
  wide = false,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className="px-10 py-10">
      <header className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[20px] font-semibold text-gray-900 leading-none">{title}</h1>
          {meta && <div className="text-[12px] text-gray-400 mt-2">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className={cn(wide ? "w-full" : "max-w-content mx-auto", className)}>
        {children}
      </div>
    </div>
  );
}
