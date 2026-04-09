import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  "новая": { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  "создана": { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  "взята в работу": { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  "принята": { bg: "bg-green-100", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  "отменена": { bg: "bg-red-100", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  "отправлена": { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200", dot: "bg-cyan-500" },
  "в работе": { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  "завершена": { bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-200", dot: "bg-lime-500" },
  "упаковано": { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  "собрано": { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" },
  "готова к отгрузке": { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
  "отгружено": { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  "в комплектовке": { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  "упакована": { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  "отгружена": { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
};

export default function StatusBadge({ status, className }) {
  // Нормализуем статус: убираем лишние пробелы и приводим к нижнему регистру для поиска
  const normalizedStatus = status?.trim().toLowerCase();

  // Маппинг старых статусов на новые для совместимости
  const statusMapping = {
    "создана": "создана",
    "взята в работу": "взята в работу",
    "принята": "принята",
    "отменена": "отменена",
    "новая": "новая",
    "в обработке": "взята в работу",
    "отправлена": "отправлена",
    "в работе": "взята в работу",
    "упаковано": "упаковано",
    "собрано": "собрано",
    "готова к отгрузке": "готова к отгрузке",
    "отгружено": "отгружено",
    "завершена": "завершена",
    "в комплектовке": "в комплектовке",
    "упакована": "упакована",
    "отгружена": "отгружена"
  };

  // Ищем статус в маппинге (сначала точное совпадение, потом нормализованное)
  const displayStatus = statusMapping[status] || statusMapping[normalizedStatus] || status || "неизвестно";

  const config = STATUS_CONFIG[displayStatus] || { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200", dot: "bg-gray-500" };

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      config.bg, config.text, config.border,
      className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {displayStatus}
    </span>
  );
}