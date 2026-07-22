import { BookingStatus, BookingType } from "@/lib/constants";
import type { Dict } from "@/lib/i18n";

const STATUS_LABEL: Record<BookingStatus, keyof Dict> = {
  PendingValidation: "stPending",
  Confirmed: "stConfirmed",
  Cancelled: "stCancelled",
  Expired: "stExpired",
};

export function StatusChip({ status, t }: { status: string; t: Dict }) {
  const key = STATUS_LABEL[status as BookingStatus] ?? "stPending";
  return <span className={`status-chip status-${status}`}>{t[key]}</span>;
}

export function TypeChip({ type, t }: { type: string; t: Dict }) {
  const isDelivery = (type as BookingType) === "delivery";
  return (
    <span className={`type-chip type-${type}`}>
      {isDelivery ? "↓" : "↑"} {isDelivery ? t.delivery : t.collection}
    </span>
  );
}
