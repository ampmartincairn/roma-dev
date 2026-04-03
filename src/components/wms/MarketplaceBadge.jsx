import { cn } from "@/lib/utils";

export default function MarketplaceBadge({ marketplace }) {
  const isWB = marketplace === "WB";
  const isOzon = marketplace === "Ozon";

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide",
      isWB && "bg-purple-100 text-purple-700",
      isOzon && "bg-blue-100 text-blue-700",
      !isWB && !isOzon && "bg-gray-100 text-gray-700"
    )}>
      {marketplace}
    </span>
  );
}