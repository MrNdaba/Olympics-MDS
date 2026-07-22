/* MDS — design tokens (design_handoff_mds/README.md · Design Tokens).
   COJOJ Blue brand + Senegal flag/status palette. Light UI only. */

:root {
  /* Brand */
  --blue: #0078d0;
  --blue-hover: #0064ae;
  --blue-tint-bg: #e5f2fb;
  --blue-tint-text: #005a9e;

  /* Ink & text */
  --ink: #12202e;
  --text-secondary: #5a6b7c;
  --label: #33475b;
  --muted: #9aa7b2;
  --disabled-text: #b6c0c9;

  /* Borders */
  --border-card: #dde4ea;
  --border-control: #c7d1da;
  --divider: #ebf0f4;
  --row: #f0f3f6;
  --border-disabled: #e3e9ef;

  /* Backgrounds */
  --bg-page: #f4f6f8;
  --bg-table-header: #f8fafb;
  --bg-canvas: #e8ecef;

  /* Statuses (flag palette) */
  --st-confirmed: #00a651;
  --st-confirmed-bg: #e3f5ec;
  --st-confirmed-text: #00753a;
  --st-pending: #e08a00;
  --st-pending-bg: #fcf3e1;
  --st-pending-text: #9a6400;
  --st-pending-cell: #f5c64b;
  --st-cancelled: #e31b23;
  --st-cancelled-bg: #fbe9e9;
  --st-cancelled-text: #b3261e;
  --st-expired: #9aa7b2;
  --st-expired-bg: #eef1f4;
  --st-expired-text: #5a6b7c;

  /* Senegal mosaic */
  --flag-yellow: #fcd116;
  --flag-green: #00a651;
  --flag-red: #e31b23;

  /* Shape */
  --radius-card: 10px;
  --radius-control: 7px;
  --radius-pill: 20px;

  --font-ui: var(--font-archivo), "Archivo", system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  height: 100%;
}

body {
  color: var(--ink);
  background: var(--bg-page);
  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
}

input,
select,
textarea {
  font-family: inherit;
}

.mono {
  font-family: var(--font-mono);
}

/* Senegal mosaic strip under every top bar */
.mosaic-strip {
  height: 4px;
  background: linear-gradient(
    90deg,
    var(--blue) 0 25%,
    var(--flag-yellow) 25% 50%,
    var(--flag-green) 50% 75%,
    var(--flag-red) 75% 100%
  );
  background-size: 56px 4px;
}

/* Status chip */
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 5px;
  font-weight: 600;
  font-size: 11px;
}
.status-chip::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.9;
}
.status-Confirmed {
  background: var(--st-confirmed-bg);
  color: var(--st-confirmed-text);
}
.status-PendingValidation {
  background: var(--st-pending-bg);
  color: var(--st-pending-text);
}
.status-Cancelled {
  background: var(--st-cancelled-bg);
  color: var(--st-cancelled-text);
}
.status-Expired {
  background: var(--st-expired-bg);
  color: var(--st-expired-text);
}

/* Booking-type chip (labelled column everywhere, spec §11.2) */
.type-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 5px;
  font-weight: 600;
  font-size: 10.5px;
}
.type-delivery {
  background: var(--blue-tint-bg);
  color: var(--blue-tint-text);
}
.type-collection {
  background: #eef1f4;
  color: var(--label);
}

@media print {
  .no-print {
    display: none !important;
  }
  body {
    background: #fff;
  }
}
