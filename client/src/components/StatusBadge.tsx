import { cn } from "@/lib/utils";
import { CONTRACT_STATUSES, ContractStatus } from "@shared/contracts";

interface StatusBadgeProps {
  status: ContractStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
}

export function StatusBadge({ status, size = "md", showIcon = true }: StatusBadgeProps) {
  const statusInfo = CONTRACT_STATUSES[status];
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        `status-${status}`,
        sizeClasses[size]
      )}
    >
      {showIcon && <span>{statusInfo.icon}</span>}
      <span>{statusInfo.label}</span>
    </span>
  );
}

export function StatusDot({ status }: { status: ContractStatus }) {
  const colorMap: Record<ContractStatus, string> = {
    draft: "bg-gray-400",
    pending_customer: "bg-blue-500",
    pending_contractor: "bg-indigo-500",
    awaiting_payment: "bg-yellow-500",
    paid: "bg-green-500",
    in_progress: "bg-orange-500",
    act_signing: "bg-violet-500",
    completed: "bg-emerald-500",
    rejected: "bg-red-500",
  };

  return (
    <span className={cn("w-2 h-2 rounded-full inline-block", colorMap[status])} />
  );
}
