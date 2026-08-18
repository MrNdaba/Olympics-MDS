import { BookingStatus, BookingType } from "@/lib/constants";
import type { Dict } from "@/lib/i18n";

const STATUS_LABEL: Record<BookingStatus, keyof Dict> = {
  PendingValidation: "stPending",
  Confirmed: "stConfirmed",
  Cancelled: "stCancelled",
  Expired: "stExpired",
};

export function StatusChip({
  status,
  t,
  reason,
}: {
  status: string;
  t: Dict;
  /** Cancellation reason (item #5) — shown in a hover tooltip when the
   *  booking is Cancelled. Omit/undefined when there isn't one to show. */
  reason?: string | null;
}) {
  const key = STATUS_LABEL[status as BookingStatus] ?? "stPending";
  const chip = <span className={`status-chip status-${status}`}>{t[key]}</span>;
  if (status !== "Cancelled" || !reason) return chip;
  return (
    <span className="reason-tooltip" data-has-reason="true" tabIndex={0}>
      {chip}
      <span className="reason-tooltip-bubble" role="tooltip">
        {t.reasonLabel}: {reason}
      </span>
    </span>
  );
}

export function TypeChip({ type, t }: { type: string; t: Dict }) {
  const isDelivery = (type as BookingType) === "delivery";
  return (
    <span className={`type-chip type-${type}`}>
      {isDelivery ? "↓" : "↑"} {isDelivery ? t.delivery : t.collection}
    </span>
  );
}
