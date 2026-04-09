import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const RECEPTION_FLOW = ["новая", "взята в работу", "принята"];
const ASSEMBLY_FLOW = ["новая", "взята в работу", "упаковано", "собрано", "готова к отгрузке", "отгружено"];

const normalizeAssemblyStatus = (status) => {
  const normalized = status?.trim().toLowerCase();
  const mapping = {
    "в обработке": "взята в работу",
    "в комплектовке": "собрано",
    "упакована": "готова к отгрузке",
    "отгружена": "отгружено",
  };
  return mapping[normalized] || normalized || "новая";
};

const normalizeReceptionStatus = (status) => {
  const normalized = status?.trim().toLowerCase();
  const mapping = {
    "создана": "новая",
    "отправлена": "новая",
    "новая": "новая",
    "в обработке": "взята в работу",
    "в работе": "взята в работу",
    "взята в работу": "взята в работу",
    "принята": "принята",
    "завершена": "принята",
    "отменена": "отменена",
  };
  return mapping[normalized] || normalized || "новая";
};

export default function StatusStepper({ status, type = "assembly", onNext, onCancel, loading }) {
  const flow = type === "reception" ? RECEPTION_FLOW : ASSEMBLY_FLOW;
  const currentStatus = type === "assembly" ? normalizeAssemblyStatus(status) : normalizeReceptionStatus(status);
  const currentIdx = flow.indexOf(currentStatus);
  const isFinished = currentStatus === "принята" || currentStatus === "отгружено" || currentStatus === "отменена";
  const nextStatus = flow[currentIdx + 1];

  const ACTION_LABELS = {
    "новая": "",
    "взята в работу": "▶ Взять в работу",
    "упаковано": "▶ Отметить упакованным",
    "собрано": "▶ Отметить собранным",
    "готова к отгрузке": "▶ Готова к отгрузке",
    "отгружено": "▶ Подтвердить отгрузку",
    "принята": "✓ Принять по факту",
  };

  return (
    <div className="space-y-4">
      {/* Steps */}
      <div className="flex items-center gap-0">
        {flow.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const future = idx > currentIdx;
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                  done && "bg-wms-success border-wms-success text-white",
                  active && "bg-primary border-primary text-white shadow-md shadow-primary/30",
                  future && "bg-muted border-border text-muted-foreground"
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span className={cn(
                  "text-[10px] mt-1 text-center leading-tight max-w-[50px]",
                  active ? "text-primary font-semibold" : done ? "text-wms-success" : "text-muted-foreground"
                )}>
                  {step}
                </span>
              </div>
              {idx < flow.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-1 mt-[-14px]",
                  idx < currentIdx ? "bg-wms-success" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
        {currentStatus === "отменена" && (
          <span className="ml-2 text-xs text-destructive font-medium">✕ Отменена</span>
        )}
      </div>

      {/* Action buttons */}
      {!isFinished && (
        <div className="flex gap-2 pt-1 flex-wrap">
          {nextStatus && (
            <Button
              onClick={() => onNext(nextStatus)}
              disabled={loading}
              className={cn(
                nextStatus === "принята" || nextStatus === "отгружено"
                  ? "bg-wms-success hover:bg-wms-success/90 text-white"
                  : ""
              )}
            >
              {ACTION_LABELS[nextStatus] || `→ ${nextStatus}`}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => onCancel()}
            disabled={loading}
          >
            Отменить заявку
          </Button>
        </div>
      )}
    </div>
  );
}