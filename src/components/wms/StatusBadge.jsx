import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  "новая": { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  "в обработке": { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  "принята": { bg: "bg-green-100", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  "в комплектовке": { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  "упакована": { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  "отгружена": { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  "отменена": { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
};

export default function StatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] || { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200", dot: "bg-gray-500" };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      config.bg, config.text, config.border,
      className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {status}
    </span>
  );
}