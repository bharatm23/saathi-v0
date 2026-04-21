export function EmptyState({
  icon,
  message,
  action,
}: {
  icon?: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-16">
      {icon && <div className="text-gray-300 mb-4">{icon}</div>}
      <p className="text-[14px] text-gray-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
