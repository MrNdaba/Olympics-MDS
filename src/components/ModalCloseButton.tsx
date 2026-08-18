"use client";

/** X close icon, top-right of a modal — the sole way to dismiss without
 *  submitting. Replaces the old secondary white "Cancel" button so every
 *  dialog has exactly one primary action button (item #6). The parent modal
 *  card must be `position: relative` for the absolute placement to land. */
export function ModalCloseButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        width: 28,
        height: 28,
        display: "inline-grid",
        placeItems: "center",
        borderRadius: 7,
        border: "none",
        background: "transparent",
        color: "#5A6B7C",
        fontSize: 15,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      ✕
    </button>
  );
}
