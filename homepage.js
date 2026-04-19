(function () {
    if (globalThis.__tmHomepage?.loaded) return;

    const runtime = {
        root: null,
        ctx: null,
        rangeDays: 30,
        profile: "desktop",
        clickHandler: null,
        resizeObserver: null,
        resizeRaf: 0,
    };

    const HOMEPAGE_STYLE_SOURCE = "homepage.css";
    const HOMEPAGE_STYLE_TEXT = String.raw`.tm-homepage-entry-btn.is-active {
    background: color-mix(in srgb, var(--tm-primary-color) 14%, var(--tm-card-bg));
    border-color: var(--tm-border-color);
    color: var(--tm-primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--tm-primary-color) 16%, transparent);
}

.tm-body.tm-body--homepage {
    min-height: 0;
    overflow: auto;
    background: var(--tm-bg-color);
}

#tmHomepageRoot {
    min-height: 100%;
}

@keyframes tm-home-fade-up {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes tm-home-pulse-ring {
    0% {
        opacity: 0.65;
        transform: scale(0.92);
    }
    70% {
        opacity: 0;
        transform: scale(1.22);
    }
    100% {
        opacity: 0;
        transform: scale(1.28);
    }
}

.tm-homepage-shell {
    --tm-home-bg: var(--tm-bg-color);
    --tm-home-surface: var(--card, var(--tm-card-bg));
    --tm-home-surface-alt: color-mix(in srgb, var(--tm-home-surface) 90%, var(--tm-home-bg) 10%);
    --tm-home-surface-soft: color-mix(in srgb, var(--tm-home-surface) 84%, var(--tm-home-bg) 16%);
    --tm-home-text: var(--tm-text-color);
    --tm-home-text-muted: var(--tm-secondary-text);
    --tm-home-border: var(--border, var(--tm-border-color));
    --tm-home-border-soft: color-mix(in srgb, var(--tm-border-color) 82%, transparent);
    --tm-home-accent: var(--tm-primary-color);
    --tm-home-accent-soft: color-mix(in srgb, var(--tm-primary-color) 14%, var(--tm-card-bg));
    --tm-home-accent-soft-2: color-mix(in srgb, var(--tm-primary-color) 24%, var(--tm-card-bg));
    --tm-home-accent-ring: color-mix(in srgb, var(--tm-primary-color) 18%, transparent);
    --tm-home-success: var(--tm-success-color);
    --tm-home-success-soft: color-mix(in srgb, var(--tm-success-color) 16%, var(--tm-card-bg));
    --tm-home-warning: var(--tm-warning-color, #f9ab00);
    --tm-home-warning-soft: color-mix(in srgb, var(--tm-warning-color, #f9ab00) 16%, var(--tm-card-bg));
    --tm-home-danger: var(--tm-danger-color);
    --tm-home-danger-soft: color-mix(in srgb, var(--tm-danger-color) 16%, var(--tm-card-bg));
    --tm-home-hover: var(--tm-hover-bg);
    --tm-home-shadow: var(--shadow-sm, 0 8px 20px rgba(15, 23, 42, 0.045));
    --tm-home-gap: 16px;
    --tm-home-card-radius: calc(var(--radius, 10px) + 2px);
    --tm-home-card-padding: 15px 16px;
    --tm-home-trend-height: 190px;
    --tm-home-heatmap-cell: 16px;
    --tm-home-heatmap-gap: 5px;
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    padding: 16px;
    box-sizing: border-box;
    overflow: hidden;
    background:
        radial-gradient(1200px 340px at -6% -14%, color-mix(in srgb, var(--tm-home-accent) 5%, transparent), transparent 62%),
        radial-gradient(920px 280px at 108% 0%, color-mix(in srgb, var(--tm-home-accent) 4%, transparent), transparent 58%),
        linear-gradient(180deg, color-mix(in srgb, var(--tm-home-accent) 3%, transparent), transparent 180px),
        var(--tm-home-bg);
    color: var(--tm-home-text);
}

.tm-homepage-shell::before,
.tm-homepage-shell::after {
    content: "";
    position: absolute;
    border-radius: 999px;
    pointer-events: none;
    filter: blur(18px);
    opacity: 0.9;
}

.tm-homepage-shell::before {
    top: -68px;
    right: 8%;
    width: 180px;
    height: 180px;
    background: color-mix(in srgb, var(--tm-home-accent) 10%, transparent);
}

.tm-homepage-shell::after {
    bottom: -44px;
    left: 6%;
    width: 140px;
    height: 140px;
    background: color-mix(in srgb, var(--tm-home-accent) 4%, transparent);
}

.tm-homepage-main {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.tm-homepage-main > * {
    margin: 0;
}

.tm-homepage-main > * + * {
    margin-top: var(--tm-home-gap);
}

.tm-homepage-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    animation: tm-home-fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tm-homepage-title-wrap {
    max-width: min(720px, 100%);
}

.tm-homepage-title {
    margin: 0;
    font-size: clamp(20px, 2vw, 26px);
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.045em;
    color: var(--tm-home-text);
}

.tm-homepage-subtitle {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--tm-home-text-muted);
    max-width: 62ch;
}

.tm-homepage-toolbar {
    display: inline-flex;
    align-items: center;
    gap: 10px;
}

.tm-homepage-range-switch {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--tm-home-border);
    border-radius: var(--radius, 10px);
    background: color-mix(in srgb, var(--tm-home-surface) 84%, var(--tm-home-surface-alt) 16%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
}

.tm-homepage-range-btn {
    min-width: 54px;
    height: 30px;
    padding: 0 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--tm-home-text-muted);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transform: translateY(0);
    filter: saturate(1);
    border-color: transparent;
    transition:
        transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
        background-color 220ms ease,
        color 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        filter 220ms ease;
}

.tm-homepage-range-btn:hover {
    background: var(--tm-home-hover);
    color: var(--tm-home-text);
    transform: translateY(0);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 14%, transparent);
}

.tm-homepage-range-btn.is-active {
    background: var(--tm-home-accent-soft);
    color: var(--tm-home-accent);
    box-shadow: 0 0 0 1px var(--tm-home-accent-ring);
}

.tm-homepage-hero-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: var(--tm-home-gap);
}

.tm-homepage-hero-grid > .tm-homepage-card {
    align-self: start;
    min-height: 0;
    height: auto;
}

.tm-homepage-card--overview,
.tm-homepage-card--summary,
.tm-homepage-card--trend {
    display: flex;
    flex-direction: column;
}

.tm-homepage-card.tm-homepage-card--overview {
    gap: 10px;
    border-color: color-mix(in srgb, var(--tm-home-accent) 12%, var(--tm-home-border));
    background: color-mix(in srgb, var(--tm-home-surface) 97%, var(--tm-home-bg) 3%);
}

.tm-homepage-card.tm-homepage-card--summary {
    gap: 10px;
    background: color-mix(in srgb, var(--tm-home-surface) 98%, var(--tm-home-bg) 2%);
}

.tm-homepage-card--overview .tm-homepage-card-head,
.tm-homepage-card--summary .tm-homepage-card-head,
.tm-homepage-card--trend .tm-homepage-card-head {
    margin-bottom: 0;
}

.tm-homepage-overview-rate {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid color-mix(in srgb, var(--tm-home-accent) 20%, var(--tm-home-border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--tm-home-accent) 6%, var(--tm-home-surface));
    font-size: 12px;
    font-weight: 700;
    color: var(--tm-home-accent);
    white-space: nowrap;
}

.tm-homepage-overview-summary {
    display: grid;
    grid-template-columns: minmax(86px, max-content) minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 8px 12px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 2px);
    background: color-mix(in srgb, var(--tm-home-surface) 96%, var(--tm-home-bg) 4%);
}

.tm-homepage-overview-total {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    min-width: 0;
}

.tm-homepage-overview-total-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-overview-total-value {
    font-size: 28px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.045em;
    color: var(--tm-home-text);
}

.tm-homepage-overview-bar-wrap {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: stretch;
    justify-content: center;
}

.tm-homepage-overview-bar {
    position: relative;
    display: flex;
    width: 100%;
    gap: 4px;
    align-items: stretch;
    height: 12px;
    padding: 2px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tm-home-border) 34%, transparent);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}

.tm-homepage-overview-bar-seg {
    min-width: 8px;
    height: 100%;
    border-radius: 999px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
}

.tm-homepage-overview-bar-seg.is-accent {
    background: linear-gradient(180deg, color-mix(in srgb, var(--tm-home-accent) 90%, white 10%), color-mix(in srgb, var(--tm-home-accent) 78%, black 6%));
}

.tm-homepage-overview-bar-seg.is-warning {
    background: linear-gradient(180deg, color-mix(in srgb, var(--tm-home-warning) 90%, white 10%), color-mix(in srgb, var(--tm-home-warning) 78%, black 6%));
}

.tm-homepage-overview-bar-seg.is-success {
    background: linear-gradient(180deg, color-mix(in srgb, var(--tm-home-success) 90%, white 10%), color-mix(in srgb, var(--tm-home-success) 78%, black 6%));
}

.tm-homepage-overview-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin-top: 0;
    padding-top: 0;
    border-top: 1px solid var(--tm-home-border-soft);
    background: transparent;
}

.tm-homepage-overview-stat {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 10px;
    min-height: 0;
    padding: 9px 12px 7px;
    border-right: 1px solid var(--tm-home-border-soft);
    background: transparent;
}

.tm-homepage-overview-stat:last-child {
    border-right: none;
}

.tm-homepage-overview-stat-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text);
}

.tm-homepage-overview-stat-main {
    display: inline-flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
}

.tm-homepage-overview-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--tm-home-accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 20%, transparent);
}

.tm-homepage-overview-dot.is-accent { background: color-mix(in srgb, var(--tm-home-accent) 88%, white 12%); }
.tm-homepage-overview-dot.is-warning { background: color-mix(in srgb, var(--tm-home-warning) 88%, white 12%); }
.tm-homepage-overview-dot.is-success { background: color-mix(in srgb, var(--tm-home-success) 88%, white 12%); }

.tm-homepage-overview-stat-value {
    margin-top: 0;
    font-size: 18px;
    line-height: 1;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-overview-stat-sub {
    font-size: 11px;
    line-height: 1;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-layout {
    display: grid;
    grid-template-columns: minmax(138px, 168px) minmax(0, 1fr);
    gap: 12px;
    align-items: stretch;
}

.tm-homepage-summary-main {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    padding: 14px 16px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 2px);
    background: color-mix(in srgb, var(--tm-home-accent) 4%, var(--tm-home-surface-alt));
}

.tm-homepage-summary-main-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-main-value {
    font-size: 34px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--tm-home-text);
}

.tm-homepage-summary-main-note {
    font-size: 11px;
    line-height: 1.4;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
    gap: 10px;
    align-content: stretch;
    min-width: 0;
}

.tm-homepage-summary-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
    padding: 11px 12px 10px;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 4px);
    background: var(--tm-home-surface-alt);
}

.tm-homepage-summary-row-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-row-value {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    white-space: nowrap;
    line-height: 1;
    color: var(--tm-home-text);
}

.tm-homepage-summary-row-number {
    font-size: 34px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: inherit;
}

.tm-homepage-summary-row-unit {
    font-size: 17px;
    line-height: 1;
    font-weight: 700;
    color: inherit;
}

.tm-homepage-summary-row-note {
    font-size: 11px;
    line-height: 1.35;
    color: var(--tm-home-text-muted);
}

.tm-homepage-summary-row.is-success .tm-homepage-summary-row-value {
    color: color-mix(in srgb, var(--tm-home-success) 86%, var(--tm-home-text) 14%);
}

.tm-homepage-summary-row.is-warning .tm-homepage-summary-row-value {
    color: color-mix(in srgb, var(--tm-home-warning) 88%, var(--tm-home-text) 12%);
}

.tm-homepage-card {
    border: 1px solid var(--tm-home-border);
    border-radius: var(--tm-home-card-radius);
    background: var(--tm-home-surface);
    box-shadow: var(--tm-home-shadow);
}

.tm-homepage-card {
    position: relative;
    overflow: hidden;
    padding: var(--tm-home-card-padding);
    background: color-mix(in srgb, var(--tm-home-surface) 94%, var(--tm-home-bg) 6%);
    transform: translateY(0);
    filter: saturate(1);
    transition:
        transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
        border-color 220ms ease,
        box-shadow 220ms ease,
        background-color 220ms ease,
        filter 220ms ease;
}

.tm-homepage-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, color-mix(in srgb, var(--tm-home-accent) 2%, transparent), transparent 34%);
    pointer-events: none;
}

.tm-homepage-card:hover {
    transform: translateY(0);
    border-color: color-mix(in srgb, var(--tm-home-accent) 14%, var(--tm-home-border));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 8%, transparent);
    filter: saturate(1.015);
}

.tm-homepage-card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
}

.tm-homepage-card-title {
    font-size: 14px;
    line-height: 1.2;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-card-desc {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--tm-home-text-muted);
}

.tm-homepage-card.tm-homepage-card--trend {
    gap: 10px;
    background: color-mix(in srgb, var(--tm-home-surface) 98%, var(--tm-home-bg) 2%);
    animation: tm-home-fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 120ms;
}

.tm-homepage-trend-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: flex-start;
    gap: 10px;
}

.tm-homepage-trend-head-main {
    display: grid;
    gap: 4px;
    min-width: 0;
}

.tm-homepage-trend-title-group {
    min-width: 0;
}

.tm-homepage-trend-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    min-width: 0;
}

.tm-homepage-trend-stat {
    display: inline-flex;
    align-items: baseline;
    flex-wrap: nowrap;
    gap: 0 5px;
    min-width: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    white-space: nowrap;
}

.tm-homepage-trend-stat-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-trend-stat-value {
    font-size: 16px;
    line-height: 1;
    font-weight: 800;
    color: var(--tm-home-text);
}

.tm-homepage-trend-stat-note {
    font-size: 11px;
    line-height: 1.2;
    color: var(--tm-home-text-muted);
}

.tm-homepage-trend-head .tm-homepage-range-switch {
    align-self: start;
}

.tm-homepage-trend-wrap {
    height: var(--tm-home-trend-height);
    position: relative;
    box-sizing: border-box;
    border: 1px solid var(--tm-home-border-soft);
    border-radius: calc(var(--tm-home-card-radius) - 2px);
    overflow: hidden;
    padding: 6px 8px 4px;
    background:
        linear-gradient(180deg, color-mix(in srgb, var(--tm-home-accent) 2%, transparent), transparent 34%),
        var(--tm-home-surface-alt);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}

.tm-homepage-trend-scroll {
    overflow: hidden;
}

.tm-homepage-trend-scroll-inner {
    width: 100%;
    min-width: 0;
}

.tm-homepage-trend-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: hidden;
}

.tm-homepage-trend-grid {
    stroke: var(--tm-home-border-soft);
    stroke-width: 1;
    stroke-dasharray: 3 7;
    opacity: 0.58;
}

.tm-homepage-trend-area {
    fill: url(#tmHomepageTrendFill);
    opacity: 0.66;
}

.tm-homepage-trend-line-glow {
    fill: none;
    stroke: color-mix(in srgb, var(--tm-home-accent) 22%, transparent);
    stroke-width: 6;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.28;
}

.tm-homepage-trend-line {
    fill: none;
    stroke: url(#tmHomepageTrendStroke);
    stroke-width: 2.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 1px 5px color-mix(in srgb, var(--tm-home-accent) 8%, transparent));
}

.tm-homepage-trend-dot {
    fill: var(--tm-home-accent);
}

.tm-homepage-trend-dot--peak {
    fill: color-mix(in srgb, var(--tm-home-accent) 86%, white 14%);
}

.tm-homepage-trend-dot--last {
    fill: var(--tm-home-surface);
    stroke: var(--tm-home-accent);
    stroke-width: 3;
}

.tm-homepage-trend-dot--last-ring {
    fill: none;
    stroke: color-mix(in srgb, var(--tm-home-accent) 22%, transparent);
    stroke-width: 2;
    transform-origin: center;
    animation: tm-home-pulse-ring 1800ms cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

.tm-homepage-trend-label {
    fill: var(--tm-home-text-muted);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    text-rendering: geometricPrecision;
}

.tm-homepage-trend-axis {
    display: grid;
    grid-template-columns: repeat(var(--tm-home-trend-days, 15), minmax(0, 1fr));
    gap: 3px;
}

.tm-homepage-trend-axis-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 2px 0 0;
}

.tm-homepage-trend-axis-value {
    min-height: 12px;
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    color: var(--tm-home-text);
}

.tm-homepage-trend-axis-value.is-empty {
    opacity: 0;
}

.tm-homepage-trend-axis-date {
    min-height: 12px;
    font-size: 10px;
    line-height: 1.2;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
}

.tm-homepage-trend-axis-date.is-empty {
    opacity: 0;
}

.tm-homepage-middle-grid,
.tm-homepage-bottom-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--tm-home-gap);
}

.tm-homepage-hero-grid > .tm-homepage-card,
.tm-homepage-middle-grid > .tm-homepage-card,
.tm-homepage-bottom-grid > .tm-homepage-card {
    animation: tm-home-fade-up 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tm-homepage-hero-grid > .tm-homepage-card--overview { animation-delay: 90ms; }
.tm-homepage-hero-grid > .tm-homepage-card--summary { animation-delay: 130ms; }
.tm-homepage-middle-grid > .tm-homepage-card:nth-child(1) { animation-delay: 180ms; }
.tm-homepage-middle-grid > .tm-homepage-card:nth-child(2) { animation-delay: 230ms; }
.tm-homepage-bottom-grid > .tm-homepage-card:nth-child(1) { animation-delay: 260ms; }
.tm-homepage-bottom-grid > .tm-homepage-card:nth-child(2) { animation-delay: 310ms; }

.tm-homepage-heatmap-grid {
    display: flex;
    flex-wrap: nowrap;
    gap: calc(var(--tm-home-heatmap-gap) * 2);
    align-items: start;
    justify-content: space-between;
    min-width: 0;
}

.tm-homepage-heatmap-shell {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.tm-homepage-heatmap-month {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 0 0 auto;
}

.tm-homepage-heatmap-month-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--tm-home-text);
    letter-spacing: -0.01em;
}

.tm-homepage-heatmap-month-grid {
    display: grid;
    grid-template-columns: repeat(var(--tm-home-heatmap-month-cols), minmax(0, 1fr));
    grid-template-rows: repeat(var(--tm-home-heatmap-month-rows, 8), minmax(0, 1fr));
    grid-auto-flow: column;
    gap: var(--tm-home-heatmap-gap);
}

.tm-homepage-heatmap-cell {
    width: var(--tm-home-heatmap-cell);
    height: var(--tm-home-heatmap-cell);
    border-radius: calc(var(--tm-home-heatmap-cell) * 0.28);
    background: color-mix(in srgb, var(--tm-home-border) 35%, transparent);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    transform: translateY(0) scale(1);
    filter: saturate(1);
    transition:
        transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
        filter 180ms ease,
        background-color 180ms ease,
        box-shadow 180ms ease;
}

.tm-homepage-heatmap-cell:hover {
    transform: translateY(-2px) scale(1.08);
    filter: saturate(1.1);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 14%, transparent);
}

.tm-homepage-heatmap-cell--l1 { background: color-mix(in srgb, var(--tm-home-accent) 12%, var(--tm-home-surface)); }
.tm-homepage-heatmap-cell--l2 { background: color-mix(in srgb, var(--tm-home-accent) 24%, var(--tm-home-surface)); }
.tm-homepage-heatmap-cell--l3 { background: color-mix(in srgb, var(--tm-home-accent) 40%, var(--tm-home-surface)); }
.tm-homepage-heatmap-cell--l4 { background: color-mix(in srgb, var(--tm-home-accent) 62%, var(--tm-home-surface)); }

.tm-homepage-heatmap-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 0;
}

.tm-homepage-heatmap-legend-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
    min-width: auto;
}

.tm-homepage-distribution-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.tm-homepage-distribution-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.tm-homepage-distribution-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
}

.tm-homepage-distribution-label {
    font-size: 12px;
    color: var(--tm-home-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-distribution-value {
    font-size: 12px;
    font-weight: 700;
    color: var(--tm-home-text-muted);
}

.tm-homepage-distribution-track {
    height: 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tm-home-border) 72%, transparent);
    overflow: hidden;
}

.tm-homepage-distribution-bar {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--tm-home-accent-soft-2), var(--tm-home-accent));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.16);
    filter: saturate(1) brightness(1);
    transform: translateX(0);
    transition:
        width 260ms cubic-bezier(0.22, 1, 0.36, 1),
        filter 220ms ease,
        box-shadow 220ms ease,
        transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tm-homepage-distribution-item:hover .tm-homepage-distribution-bar {
    filter: saturate(1.12) brightness(1.04);
    transform: translateX(0);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 16%, transparent);
}

.tm-homepage-list {
    display: flex;
    flex-direction: column;
}

.tm-homepage-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    border: none;
    border-radius: 10px;
    background: color-mix(in srgb, var(--tm-home-surface) 76%, transparent);
    color: inherit;
    cursor: pointer;
    text-align: left;
    transform: translateX(0);
    filter: saturate(1);
    transition:
        transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
        background-color 220ms ease,
        border-color 220ms ease,
        box-shadow 220ms ease,
        filter 220ms ease;
}

.tm-homepage-list-item:hover {
    background: color-mix(in srgb, var(--tm-home-hover) 76%, var(--tm-home-surface) 24%);
    transform: translateX(0);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tm-home-accent) 14%, transparent);
    filter: saturate(1.03);
}

.tm-homepage-list-item:focus-visible,
.tm-homepage-range-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--tm-home-accent-ring);
}

.tm-homepage-list-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1 1 auto;
}

.tm-homepage-list-title {
    font-size: 13px;
    line-height: 1.4;
    font-weight: 700;
    color: var(--tm-home-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-list-doc {
    font-size: 12px;
    line-height: 1.4;
    color: var(--tm-home-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tm-homepage-list-side {
    flex: 0 0 auto;
}

.tm-homepage-list-date,
.tm-homepage-list-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 1;
    font-weight: 700;
    color: var(--tm-home-text-muted);
    background: var(--tm-home-surface-alt);
}

.tm-homepage-list-badge.is-warning {
    color: color-mix(in srgb, var(--tm-home-warning) 90%, var(--tm-home-text) 10%);
    background: var(--tm-home-warning-soft);
}

.tm-homepage-list-badge.is-danger {
    color: color-mix(in srgb, var(--tm-home-danger) 92%, var(--tm-home-text) 8%);
    background: var(--tm-home-danger-soft);
}

.tm-homepage-list-empty,
.tm-homepage-chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 96px;
    padding: 14px;
    border: 1px dashed var(--tm-home-border-soft);
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--tm-home-text-muted);
    background: var(--tm-home-surface-alt);
}

.tm-homepage--dock {
    --tm-home-gap: 12px;
    --tm-home-trend-height: 172px;
    --tm-home-heatmap-cell: 15px;
    --tm-home-heatmap-gap: 5px;
}

.tm-homepage--dock .tm-homepage-hero-grid {
    grid-template-columns: 1fr;
}

.tm-homepage--dock .tm-homepage-middle-grid,
.tm-homepage--dock .tm-homepage-bottom-grid {
    grid-template-columns: 1fr;
}

.tm-homepage--mobile {
    --tm-home-gap: 12px;
    --tm-home-card-padding: 12px 14px;
    --tm-home-trend-height: 156px;
    --tm-home-heatmap-cell: 13px;
    --tm-home-heatmap-gap: 4px;
    padding: 12px;
}

.tm-homepage--mobile .tm-homepage-header {
    flex-direction: column;
    align-items: stretch;
}

.tm-homepage--mobile .tm-homepage-toolbar {
    width: 100%;
}

.tm-homepage--mobile .tm-homepage-range-btn {
    flex: 1 1 0;
    min-width: 0;
    height: 34px;
}

.tm-homepage--mobile .tm-homepage-card--trend .tm-homepage-card-head {
    display: grid;
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 8px;
}

.tm-homepage--mobile .tm-homepage-trend-head-main {
    display: grid;
    gap: 6px;
    min-width: 0;
}

.tm-homepage--mobile .tm-homepage-trend-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px 10px;
}

.tm-homepage--mobile .tm-homepage-trend-stat {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
        "label value"
        "note note";
    align-items: end;
    gap: 2px 6px;
    min-width: 0;
    padding: 0 8px;
    border-right: 1px solid var(--tm-home-border-soft);
    white-space: normal;
}

.tm-homepage--mobile .tm-homepage-trend-stat:last-child {
    border-right: none;
    padding-right: 0;
}

.tm-homepage--mobile .tm-homepage-trend-stat:first-child {
    padding-left: 0;
}

.tm-homepage--mobile .tm-homepage-trend-stat-label {
    grid-area: label;
    align-self: center;
    line-height: 1.1;
}

.tm-homepage--mobile .tm-homepage-trend-stat-value {
    grid-area: value;
    justify-self: end;
    align-self: center;
    line-height: 1;
}

.tm-homepage--mobile .tm-homepage-trend-stat-note {
    grid-area: note;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-top: 1px;
}

.tm-homepage--mobile .tm-homepage-card--trend .tm-homepage-range-switch {
    width: 100%;
    justify-content: space-between;
    margin-left: 0;
    align-self: stretch;
}

.tm-homepage--mobile .tm-homepage-card--trend .tm-homepage-range-btn {
    min-width: 46px;
    height: 30px;
    padding: 0 8px;
}

.tm-homepage--mobile .tm-homepage-hero-grid {
    grid-template-columns: 1fr;
}

.tm-homepage--mobile .tm-homepage-overview-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: visible;
    padding-top: 2px;
}

.tm-homepage--mobile .tm-homepage-overview-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    min-width: 0;
    padding: 9px 8px 8px;
    border-right: 1px solid var(--tm-home-border-soft);
    border-bottom: none;
}

.tm-homepage--mobile .tm-homepage-overview-stat:last-child {
    border-right: none;
}

.tm-homepage--mobile .tm-homepage-overview-stat-label {
    min-width: 0;
    white-space: normal;
    line-height: 1.3;
}

.tm-homepage--mobile .tm-homepage-overview-stat-main {
    width: 100%;
    justify-content: flex-start;
    gap: 4px;
}

.tm-homepage--mobile .tm-homepage-overview-summary {
    grid-template-columns: minmax(74px, max-content) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
}

.tm-homepage--mobile .tm-homepage-overview-total {
    gap: 3px;
}

.tm-homepage--mobile .tm-homepage-overview-total-value {
    font-size: 26px;
}

.tm-homepage--mobile .tm-homepage-summary-layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 8px;
}

.tm-homepage--mobile .tm-homepage-summary-main {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
        "label value"
        "note note";
    align-items: end;
    gap: 4px 12px;
    min-width: 0;
    padding: 12px 14px 11px;
}

.tm-homepage--mobile .tm-homepage-summary-main-label {
    grid-area: label;
    align-self: start;
}

.tm-homepage--mobile .tm-homepage-summary-main-value {
    grid-area: value;
    justify-self: end;
    font-size: 32px;
}

.tm-homepage--mobile .tm-homepage-summary-main-note {
    grid-area: note;
    padding-top: 2px;
}

.tm-homepage--mobile .tm-homepage-summary-list {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
}

.tm-homepage--mobile .tm-homepage-summary-row {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 5px 8px;
    padding: 10px 10px 9px;
}

.tm-homepage--mobile .tm-homepage-summary-row-value {
    justify-self: end;
}

.tm-homepage--mobile .tm-homepage-summary-row-number {
    font-size: 32px;
}

.tm-homepage--mobile .tm-homepage-summary-row-unit {
    font-size: 16px;
}

.tm-homepage--mobile .tm-homepage-summary-row-note {
    grid-column: 1 / -1;
    padding-top: 1px;
}

.tm-homepage--mobile .tm-homepage-overview-rate {
    align-self: flex-start;
}

.tm-homepage--mobile .tm-homepage-middle-grid,
.tm-homepage--mobile .tm-homepage-bottom-grid {
    grid-template-columns: 1fr;
}

.tm-homepage--mobile .tm-homepage-summary-main-value {
    font-size: 30px;
}

.tm-homepage--mobile .tm-homepage-summary-row-number {
    font-size: 30px;
}

.tm-homepage--mobile .tm-homepage-summary-row-unit {
    font-size: 15px;
}

.tm-homepage--mobile .tm-homepage-trend-wrap {
    padding: 6px 6px 4px;
}

.tm-homepage--mobile .tm-homepage-trend-axis {
    gap: 2px;
}

.tm-homepage--mobile .tm-homepage-trend-axis-value {
    min-height: 10px;
    font-size: 9px;
}

.tm-homepage--mobile .tm-homepage-trend-axis-date {
    font-size: 9px;
}

.tm-homepage--mobile .tm-homepage-list-item {
    align-items: flex-start;
    flex-direction: column;
    justify-content: flex-start;
}

.tm-homepage--mobile .tm-homepage-list-main,
.tm-homepage--mobile .tm-homepage-list-side {
    width: 100%;
    min-width: 0;
}

.tm-homepage--mobile .tm-homepage-list-title,
.tm-homepage--mobile .tm-homepage-list-doc {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    word-break: break-word;
}

.tm-homepage--mobile .tm-homepage-list-side {
    display: flex;
    justify-content: flex-start;
}

.tm-homepage--mobile .tm-homepage-list-date,
.tm-homepage--mobile .tm-homepage-list-badge {
    max-width: 100%;
    white-space: normal;
    word-break: break-word;
    line-height: 1.35;
    padding-top: 6px;
    padding-bottom: 6px;
}

@media (max-width: 420px) {
    .tm-homepage--mobile .tm-homepage-card--trend .tm-homepage-card-head {
        grid-template-columns: 1fr;
        align-items: stretch;
    }

    .tm-homepage--mobile .tm-homepage-card--trend .tm-homepage-range-switch {
        width: 100%;
        justify-content: space-between;
        margin-left: 0;
    }

    .tm-homepage--mobile .tm-homepage-overview-stat {
        padding-left: 7px;
        padding-right: 7px;
    }

    .tm-homepage--mobile .tm-homepage-overview-stat-value {
        font-size: 16px;
    }

    .tm-homepage--mobile .tm-homepage-overview-stat-sub {
        font-size: 10px;
    }

    .tm-homepage--mobile .tm-homepage-summary-layout,
    .tm-homepage--mobile .tm-homepage-summary-list {
        grid-template-columns: 1fr;
    }

    .tm-homepage--mobile .tm-homepage-summary-main {
        grid-column: auto;
    }

    .tm-homepage--mobile .tm-homepage-summary-main {
        grid-template-columns: minmax(0, 1fr) auto;
    }

    .tm-homepage--mobile .tm-homepage-summary-row-number {
        font-size: 30px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .tm-homepage-header,
    .tm-homepage-hero-grid > .tm-homepage-card,
    .tm-homepage-middle-grid > .tm-homepage-card,
    .tm-homepage-bottom-grid > .tm-homepage-card,
    .tm-homepage-card--trend {
        animation: none !important;
    }

    .tm-homepage-trend-dot--last-ring {
        animation: none !important;
    }
}`;

    const esc = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const toNumber = (value, fallback = 0) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    };

    function ensureHomepageStyle() {
        let styleEl = document.querySelector('style[data-tm-homepage-style="1"]');
        if (!(styleEl instanceof HTMLStyleElement)) {
            styleEl = document.createElement("style");
            styleEl.dataset.tmHomepageStyle = "1";
            styleEl.dataset.tmStyleSource = HOMEPAGE_STYLE_SOURCE;
            document.head.appendChild(styleEl);
        }
        if (styleEl.textContent !== HOMEPAGE_STYLE_TEXT) {
            styleEl.textContent = HOMEPAGE_STYLE_TEXT + `\n/*# sourceURL=${HOMEPAGE_STYLE_SOURCE} */`;
        }
        return styleEl;
    }

    function formatDateKey(date) {
        const dt = date instanceof Date ? date : new Date(date);
        if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function normalizeDateKey(value) {
        if (!value) return "";
        if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDateKey(value);
        const raw = String(value || "").trim();
        if (!raw) return "";
        if (/^\d{14}$/.test(raw)) {
            const dt = new Date(
                Number(raw.slice(0, 4)),
                Number(raw.slice(4, 6)) - 1,
                Number(raw.slice(6, 8)),
                Number(raw.slice(8, 10)),
                Number(raw.slice(10, 12)),
                Number(raw.slice(12, 14)),
                0,
            );
            return Number.isNaN(dt.getTime()) ? "" : formatDateKey(dt);
        }
        if (/^\d{8}$/.test(raw)) {
            return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
        }
        if (/^\d+$/.test(raw)) {
            const n = Number(raw);
            if (!Number.isFinite(n) || n <= 0) return "";
            const dt = new Date(n < 1e12 ? n * 1000 : n);
            return Number.isNaN(dt.getTime()) ? "" : formatDateKey(dt);
        }
        const m1 = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
        const m2 = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
        if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
        const dt = new Date(raw);
        return Number.isNaN(dt.getTime()) ? "" : formatDateKey(dt);
    }

    function buildDateFromKey(key) {
        const m = String(key || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function shiftDateKey(key, deltaDays) {
        const base = buildDateFromKey(normalizeDateKey(key));
        if (!(base instanceof Date)) return "";
        base.setDate(base.getDate() + (Number(deltaDays) || 0));
        return formatDateKey(base);
    }

    function dayDiff(fromKey, toKey) {
        const from = buildDateFromKey(normalizeDateKey(fromKey));
        const to = buildDateFromKey(normalizeDateKey(toKey));
        if (!(from instanceof Date) || !(to instanceof Date)) return 0;
        return Math.round((to.getTime() - from.getTime()) / 86400000);
    }

    function formatShortDate(key) {
        const dt = buildDateFromKey(key);
        return dt instanceof Date ? `${dt.getMonth() + 1}/${dt.getDate()}` : (key || "");
    }

    function formatListDate(key) {
        const dt = buildDateFromKey(key);
        if (!(dt instanceof Date)) return key || "";
        const week = ["日", "一", "二", "三", "四", "五", "六"];
        return `${dt.getMonth() + 1}月${dt.getDate()}日 周${week[dt.getDay()]}`;
    }

    function formatMetricValue(value) {
        const num = Number(value) || 0;
        const rounded = Math.round(num * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    }

    function flattenTasks(items, out = [], seen = new Set()) {
        (Array.isArray(items) ? items : []).forEach((item) => {
            if (!item || typeof item !== "object") return;
            const id = String(item.id || "").trim();
            if (id && seen.has(id)) return;
            if (id) seen.add(id);
            out.push(item);
            if (Array.isArray(item.children) && item.children.length) flattenTasks(item.children, out, seen);
        });
        return out;
    }

    function resolveTaskTitle(task) {
        return String(task?.content || task?.title || task?.name || task?.raw_content || "").trim() || "未命名任务";
    }

    function resolveTaskDoc(task) {
        return String(task?.doc_name || task?.docName || task?.root_name || task?.groupName || "").trim() || "未命名文档";
    }

    function resolveTaskDoneValue(task) {
        return String(
            task?.["custom-task-complete-at"]
            || task?.taskCompleteAt
            || task?.task_complete_at
            || task?.completedAt
            || task?.updated
            || task?.updatedAt
            || task?.completionTime
            || ""
        ).trim();
    }

    function resolveTaskDoneTs(task) {
        const raw = resolveTaskDoneValue(task);
        if (!raw) return 0;
        const ts = new Date(raw).getTime();
        if (Number.isFinite(ts) && ts > 0) return ts;
        const key = normalizeDateKey(raw);
        const dt = buildDateFromKey(key);
        return dt instanceof Date ? dt.getTime() : 0;
    }

    function resolveTaskDoneKey(task) {
        return normalizeDateKey(resolveTaskDoneValue(task));
    }

    function resolveTaskDoneMetricValue(task) {
        return String(
            task?.["custom-task-complete-at"]
            || task?.taskCompleteAt
            || task?.task_complete_at
            || task?.updated
            || task?.updatedAt
            || task?.completedAt
            || ""
        ).trim();
    }

    function resolveTaskDoneMetricKey(task) {
        return normalizeDateKey(resolveTaskDoneMetricValue(task));
    }

    function resolveTaskDueKey(task) {
        return normalizeDateKey(task?.completionTime || "");
    }

    function resolveTaskStatus(task) {
        if (task?.done) return "已完成";
        const raw = String(task?.customStatus || task?.status || "").trim();
        return raw || "待办";
    }

    function resolveTaskPriority(task) {
        const raw = String(task?.priority || "").trim().toLowerCase();
        if (raw === "high") return "高优先级";
        if (raw === "medium") return "中优先级";
        if (raw === "low") return "低优先级";
        return "";
    }

    function resolveProfile(ctx) {
        const width = toNumber(ctx?.containerWidth, 0);
        if (ctx?.isDockHost) return "dock";
        if (ctx?.hostUsesMobileUI || ctx?.isMobileDevice || (width > 0 && width < 760)) return "mobile";
        if (width > 0 && width < 1120) return "dock";
        return "desktop";
    }

    function getLayoutMetrics(ctx, profile) {
        const containerWidth = Math.max(320, toNumber(ctx?.containerWidth, 0) || 320);
        const shellPadding = profile === "mobile" ? 24 : 32;
        const contentWidth = Math.max(280, containerWidth - shellPadding);
        const gridGap = profile === "mobile" ? 12 : 12;
        const singleCardWidth = Math.max(240, contentWidth - 32);
        const doubleCardWidth = profile === "desktop"
            ? Math.max(240, Math.floor((contentWidth - gridGap) / 2) - 16)
            : singleCardWidth;
        return {
            containerWidth,
            contentWidth,
            trendWidth: Math.max(360, contentWidth - 16),
            heatmapWidth: doubleCardWidth,
        };
    }

    function isFutureDateKey(key, todayKey) {
        const normalized = normalizeDateKey(key);
        const today = normalizeDateKey(todayKey);
        if (!normalized || !today) return false;
        return dayDiff(today, normalized) > 0;
    }

    function buildTrend(tasks, todayKey, rangeDays) {
        const doneMap = new Map();
        const days = [];
        for (let i = rangeDays - 1; i >= 0; i -= 1) days.push(shiftDateKey(todayKey, -i));
        const allowKeys = new Set(days);
        tasks.forEach((task) => {
            if (!task?.done) return;
            const key = resolveTaskDoneMetricKey(task);
            if (!key || isFutureDateKey(key, todayKey) || !allowKeys.has(key)) return;
            doneMap.set(key, (doneMap.get(key) || 0) + 1);
        });
        const points = days.map((key, index) => ({
            key,
            label: formatShortDate(key),
            value: doneMap.get(key) || 0,
            index,
        }));
        return {
            points,
            maxValue: Math.max(1, ...points.map((point) => point.value)),
        };
    }

    function buildStreak(tasks, todayKey) {
        const doneSet = new Set();
        tasks.forEach((task) => {
            if (!task?.done) return;
            const key = resolveTaskDoneMetricKey(task);
            if (key && !isFutureDateKey(key, todayKey)) doneSet.add(key);
        });
        let streak = 0;
        // 连续完成按“上一天”为统计截止点，避免今天还没结束时提前拉长 streak。
        let cursor = shiftDateKey(todayKey, -1);
        while (doneSet.has(cursor)) {
            streak += 1;
            cursor = shiftDateKey(cursor, -1);
        }
        return streak;
    }

    function buildHeatmap(tasks, todayKey, ctx, profile) {
        const doneMap = new Map();
        tasks.forEach((task) => {
            if (!task?.done) return;
            const key = resolveTaskDoneMetricKey(task);
            if (!key || isFutureDateKey(key, todayKey)) return;
            doneMap.set(key, (doneMap.get(key) || 0) + 1);
        });

        const layout = getLayoutMetrics(ctx, profile);
        const maxCount = Math.max(1, ...Array.from(doneMap.values(), (value) => Number(value) || 0));
        const cellSize = profile === "mobile" ? 14 : (profile === "dock" ? 16 : 17);
        const gapSize = profile === "mobile" ? 5 : 6;
        const monthCols = profile === "mobile" ? 3 : 4;
        const monthBlockWidth = (cellSize * monthCols) + (gapSize * (monthCols - 1));
        const monthGap = gapSize * 2;
        const fitMonths = Math.max(1, Math.floor((layout.heatmapWidth + monthGap) / (monthBlockWidth + monthGap)));
        const minMonths = profile === "mobile" ? 3 : 4;
        const monthCount = Math.max(minMonths, Math.min(12, fitMonths));
        const today = buildDateFromKey(todayKey) || new Date();
        let maxVisibleDays = 1;
        for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
            const probe = new Date(today.getFullYear(), today.getMonth() - offset, 1, 12, 0, 0, 0);
            const daysInMonth = new Date(probe.getFullYear(), probe.getMonth() + 1, 0).getDate();
            const isCurrentMonth = probe.getFullYear() === today.getFullYear() && probe.getMonth() === today.getMonth();
            const visibleDays = isCurrentMonth ? Math.min(daysInMonth, today.getDate()) : daysInMonth;
            maxVisibleDays = Math.max(maxVisibleDays, visibleDays);
        }
        const sharedRows = Math.max(1, Math.ceil(maxVisibleDays / monthCols));
        const months = [];
        for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
            const dt = new Date(today.getFullYear(), today.getMonth() - offset, 1, 12, 0, 0, 0);
            const y = dt.getFullYear();
            const m = dt.getMonth();
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();
            const visibleDays = isCurrentMonth ? Math.min(daysInMonth, today.getDate()) : daysInMonth;
            const cells = [];
            for (let day = 1; day <= visibleDays; day += 1) {
                const key = formatDateKey(new Date(y, m, day, 12, 0, 0, 0));
                const count = doneMap.get(key) || 0;
                let level = 0;
                if (count > 0) level = Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
                cells.push({ key, count, level, day });
            }
            months.push({
                key: `${y}-${String(m + 1).padStart(2, "0")}`,
                label: `${m + 1}月`,
                rows: sharedRows,
                cells,
            });
        }
        return {
            months,
            cellSize,
            gapSize,
            monthCols,
            monthCount,
            maxCount,
        };
    }

    function buildDistribution(tasks) {
        const docMap = new Map();
        tasks.forEach((task) => {
            if (task?.done) return;
            const doc = resolveTaskDoc(task);
            docMap.set(doc, (docMap.get(doc) || 0) + 1);
        });
        const docItems = Array.from(docMap.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        return { title: "文档分布", items: docItems };
    }

    function buildRecentDone(tasks, todayKey) {
        return tasks
            .filter((task) => !!task?.done)
            .map((task) => ({
                id: String(task?.id || "").trim(),
                title: resolveTaskTitle(task),
                doc: resolveTaskDoc(task),
                dateKey: resolveTaskDoneKey(task),
                doneTs: resolveTaskDoneTs(task),
            }))
            .filter((item) => item.dateKey && !isFutureDateKey(item.dateKey, todayKey))
            .sort((a, b) => {
                if (b.doneTs !== a.doneTs) return b.doneTs - a.doneTs;
                return dayDiff(a.dateKey, b.dateKey);
            })
            .slice(0, 6);
    }

    function buildRiskList(tasks, todayKey) {
        return tasks
            .filter((task) => !task?.done)
            .map((task) => {
                const dueKey = resolveTaskDueKey(task);
                if (!dueKey) return null;
                const diff = dayDiff(todayKey, dueKey);
                if (diff > 7) return null;
                return {
                    id: String(task?.id || "").trim(),
                    title: resolveTaskTitle(task),
                    doc: resolveTaskDoc(task),
                    dateKey: dueKey,
                    diffDays: diff,
                    priority: resolveTaskPriority(task),
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.diffDays !== b.diffDays) return a.diffDays - b.diffDays;
                if (!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
                return String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
            })
            .slice(0, 6);
    }

    function buildOverview(ctx) {
        const todayKey = normalizeDateKey(ctx?.todayKey) || formatDateKey(new Date());
        const tasks = flattenTasks(ctx?.tasks || []);
        const trend = buildTrend(tasks, todayKey, runtime.rangeDays);
        const weekDone = buildTrend(tasks, todayKey, 7).points.reduce((sum, point) => sum + point.value, 0);
        const overdue = tasks.filter((task) => !task?.done && resolveTaskDueKey(task) && dayDiff(todayKey, resolveTaskDueKey(task)) < 0).length;
        const overdueCount = tasks.filter((task) => !task?.done && resolveTaskDueKey(task) && dayDiff(todayKey, resolveTaskDueKey(task)) < 0).length;
        const doneCount = tasks.filter((task) => !!task?.done).length;
        const pendingCount = Math.max(0, tasks.length - doneCount - overdueCount);
        const completionRate = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
        const streak = buildStreak(tasks, todayKey);
        const profile = resolveProfile(ctx);
        const scopeLabel = String(ctx?.currentDocName || ctx?.currentGroupName || "当前范围").trim() || "当前范围";
        const rangeDone = trend.points.reduce((sum, point) => sum + (Number(point?.value) || 0), 0);
        const subtitleParts = [];
        if (rangeDone > 0) subtitleParts.push(`近 ${runtime.rangeDays} 天完成 ${rangeDone} 项`);
        if (overdue > 0) subtitleParts.push(`逾期 ${overdue} 项`);
        return {
            tasks,
            trend,
            heatmap: buildHeatmap(tasks, todayKey, ctx, profile),
            distribution: buildDistribution(tasks),
            recentDone: buildRecentDone(tasks, todayKey),
            riskList: buildRiskList(tasks, todayKey),
            title: `主页 - ${scopeLabel}`,
            subtitle: subtitleParts.length
                ? subtitleParts.join("，")
                : `近 ${runtime.rangeDays} 天暂时没有完成记录`,
            kpis: {
                todayDone: trend.points.length ? trend.points[trend.points.length - 1].value : 0,
                weekDone,
                overdue,
                total: tasks.length,
                doneCount,
                overdueCount,
                pendingCount,
                completionRate,
                streak,
            },
        };
    }

    function buildGaugeSegments(overview) {
        const total = Math.max(1, Number(overview?.kpis?.total) || 0);
        return [
            {
                key: "done",
                label: "已完成",
                value: Number(overview?.kpis?.doneCount) || 0,
                pct: total > 0 ? Math.round(((Number(overview?.kpis?.doneCount) || 0) / total) * 100) : 0,
                tone: "is-accent",
            },
            {
                key: "overdue",
                label: "已过期",
                value: Number(overview?.kpis?.overdueCount) || 0,
                pct: total > 0 ? Math.round(((Number(overview?.kpis?.overdueCount) || 0) / total) * 100) : 0,
                tone: "is-warning",
            },
            {
                key: "pending",
                label: "未完成",
                value: Number(overview?.kpis?.pendingCount) || 0,
                pct: total > 0 ? Math.round(((Number(overview?.kpis?.pendingCount) || 0) / total) * 100) : 0,
                tone: "is-success",
            },
        ];
    }

    function buildTrendSummary(trend) {
        const points = Array.isArray(trend?.points) ? trend.points.slice() : [];
        if (!points.length) {
            return {
                pointCount: 0,
                total: 0,
                average: 0,
                last: { label: "", value: 0 },
                peak: { label: "", value: 0 },
            };
        }
        const total = points.reduce((sum, point) => sum + (Number(point?.value) || 0), 0);
        const last = points[points.length - 1] || { label: "", value: 0 };
        const peak = points.reduce((best, point) => {
            if (!best) return point;
            return (Number(point?.value) || 0) > (Number(best?.value) || 0) ? point : best;
        }, null) || { label: "", value: 0 };
        return {
            pointCount: points.length,
            total,
            average: points.length ? total / points.length : 0,
            last: { label: last.label || "", value: Number(last.value) || 0 },
            peak: { label: peak.label || "", value: Number(peak.value) || 0 },
        };
    }

    function getTrendAxisStep(pointCount) {
        const count = Math.max(0, Number(pointCount) || 0);
        if (count <= 14) return 1;
        if (count <= 35) return 5;
        if (count <= 70) return 7;
        return 10;
    }

    function renderTrendAxis(trend) {
        const points = Array.isArray(trend?.points) ? trend.points.slice() : [];
        if (!points.length) return "";
        const lastIndex = points.length - 1;
        const step = getTrendAxisStep(points.length);
        return `
            <div class="tm-homepage-trend-axis" style="--tm-home-trend-days:${points.length};">
                ${points.map((point, index) => {
                    const showDate = ((lastIndex - index) % step === 0) || index === 0 || index === lastIndex;
                    return `
                    <div class="tm-homepage-trend-axis-item" aria-label="${esc(`${point.label} 完成 ${Number(point.value) || 0} 项`)}">
                        <span class="tm-homepage-trend-axis-value ${(Number(point.value) || 0) > 0 ? "" : "is-empty"}">${(Number(point.value) || 0) > 0 ? Number(point.value) || 0 : ""}</span>
                        <span class="tm-homepage-trend-axis-date ${showDate ? "" : "is-empty"}">${showDate ? esc(point.label || "") : ""}</span>
                    </div>
                `;
                }).join("")}
            </div>
        `;
    }

    function buildSmoothSvgPath(points) {
        const list = Array.isArray(points) ? points : [];
        if (!list.length) return "";
        if (list.length === 1) return `M ${list[0].x} ${list[0].y}`;
        if (list.length === 2) return `M ${list[0].x} ${list[0].y} L ${list[1].x} ${list[1].y}`;
        let path = `M ${list[0].x} ${list[0].y}`;
        for (let i = 0; i < list.length - 1; i += 1) {
            const p0 = list[i - 1] || list[i];
            const p1 = list[i];
            const p2 = list[i + 1];
            const p3 = list[i + 2] || p2;
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            let cp1y = p1.y + (p2.y - p0.y) / 6;
            let cp2y = p2.y - (p3.y - p1.y) / 6;
            const minY = Math.min(p1.y, p2.y);
            const maxY = Math.max(p1.y, p2.y);
            const p1Value = Number(p1?.value) || 0;
            const p2Value = Number(p2?.value) || 0;

            // Clamp control points to the current segment range to avoid overshooting
            // below the baseline or above the peak.
            cp1y = Math.max(minY, Math.min(maxY, cp1y));
            cp2y = Math.max(minY, Math.min(maxY, cp2y));

            // When the line touches zero, keep the tangent pinned to the baseline so it
            // flattens into the axis instead of forming a rounded bowl near y=0.
            if (p1Value <= 0) cp1y = p1.y;
            if (p2Value <= 0) cp2y = p2.y;

            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        return path;
    }

    function renderRangeSwitch() {
        const rangeOptions = [7, 30, 90];
        return `
            <div class="tm-homepage-range-switch" role="tablist" aria-label="趋势范围">
                ${rangeOptions.map((days) => `<button type="button" class="tm-homepage-range-btn ${runtime.rangeDays === days ? "is-active" : ""}" data-tm-home-range="${days}">${days} 天</button>`).join("")}
            </div>
        `;
    }

    function buildTrendSvg(trend, ctx, profile) {
        const rawPoints = Array.isArray(trend?.points) ? trend.points : [];
        if (!rawPoints.length) return `<div class="tm-homepage-chart-empty">暂无趋势数据</div>`;
        const points = rawPoints.slice();
        const width = Math.max(360, Math.min(1400, Math.round(getLayoutMetrics(ctx, profile).trendWidth)));
        const height = profile === "mobile" ? 142 : (profile === "dock" ? 156 : 170);
        const padding = { top: 14, right: 12, bottom: 8, left: 12 };
        const innerW = width - padding.left - padding.right;
        const innerH = height - padding.top - padding.bottom;
        const maxValue = Math.max(1, ...points.map((point) => Number(point?.value) || 0));
        const xOf = (index) => padding.left + (points.length <= 1 ? innerW / 2 : (innerW / (points.length - 1)) * index);
        const yOf = (value) => padding.top + innerH - ((Number(value) || 0) / maxValue) * innerH;
        const chartPoints = points.map((point, index) => ({
            x: xOf(index),
            y: yOf(point.value),
            label: point.label,
            value: point.value,
        }));
        const linePath = buildSmoothSvgPath(chartPoints);
        const baselineY = padding.top + innerH;
        const areaPath = chartPoints.length
            ? `M ${chartPoints[0].x} ${baselineY} L ${chartPoints[0].x} ${chartPoints[0].y} ${linePath.slice(1)} L ${chartPoints[chartPoints.length - 1].x} ${baselineY} Z`
            : "";
        const gridLines = [0, 0.5, 1].map((ratio) => {
            const y = padding.top + innerH * ratio;
            return `<line x1="${padding.left}" y1="${y}" x2="${padding.left + innerW}" y2="${y}" class="tm-homepage-trend-grid" />`;
        }).join("");
        const lastPoint = chartPoints[chartPoints.length - 1];
        const peakPoint = chartPoints.reduce((best, point) => {
            if (!best) return point;
            if (point.value > best.value) return point;
            return best;
        }, null);
        const markers = [
            peakPoint ? `<circle cx="${peakPoint.x}" cy="${peakPoint.y}" r="3.5" class="tm-homepage-trend-dot tm-homepage-trend-dot--peak"><title>${esc(`峰值 ${peakPoint.label}：${peakPoint.value}`)}</title></circle>` : "",
            lastPoint ? `<circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="5.5" class="tm-homepage-trend-dot tm-homepage-trend-dot--last"><title>${esc(`最新 ${lastPoint.label}：${lastPoint.value}`)}</title></circle>` : "",
            lastPoint ? `<circle cx="${lastPoint.x}" cy="${lastPoint.y}" r="9" class="tm-homepage-trend-dot tm-homepage-trend-dot--last-ring"></circle>` : "",
        ].join("");
        return `
            <svg class="tm-homepage-trend-svg" viewBox="0 0 ${width} ${height}" aria-label="完成趋势">
                <defs>
                    <linearGradient id="tmHomepageTrendStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" style="stop-color:color-mix(in srgb, var(--tm-home-accent) 68%, var(--tm-home-accent-soft-2));"></stop>
                        <stop offset="100%" style="stop-color:var(--tm-home-accent);"></stop>
                    </linearGradient>
                    <linearGradient id="tmHomepageTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" style="stop-color:color-mix(in srgb, var(--tm-home-accent) 16%, transparent);"></stop>
                        <stop offset="100%" style="stop-color:color-mix(in srgb, var(--tm-home-accent) 0%, transparent);"></stop>
                    </linearGradient>
                </defs>
                ${gridLines}
                <path d="${areaPath}" class="tm-homepage-trend-area"></path>
                <path d="${linePath}" class="tm-homepage-trend-line-glow"></path>
                <path d="${linePath}" class="tm-homepage-trend-line"></path>
                ${markers}
            </svg>
        `;
    }

    function renderHeatmap(heatmap) {
        const months = Array.isArray(heatmap?.months) ? heatmap.months : [];
        if (!months.length) return `<div class="tm-homepage-chart-empty">暂无热力图数据</div>`;
        return `
            <div class="tm-homepage-heatmap-shell" style="--tm-home-heatmap-cell:${Math.max(12, Number(heatmap?.cellSize) || 16)}px;--tm-home-heatmap-gap:${Math.max(4, Number(heatmap?.gapSize) || 5)}px;--tm-home-heatmap-month-cols:${Math.max(3, Number(heatmap?.monthCols) || 4)};">
                <div class="tm-homepage-heatmap-grid" role="img" aria-label="完成热力图">
                    ${months.map((month) => `
                    <div class="tm-homepage-heatmap-month">
                        <div class="tm-homepage-heatmap-month-label">${esc(month?.label || "")}</div>
                        <div class="tm-homepage-heatmap-month-grid" style="--tm-home-heatmap-month-rows:${Math.max(1, Number(month?.rows) || 1)};">
                            ${(Array.isArray(month?.cells) ? month.cells : []).map((cell) => `
                                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l${Number(cell?.level) || 0}${cell?.placeholder ? " tm-homepage-heatmap-cell--placeholder" : ""}"${cell?.placeholder ? ' aria-hidden="true"' : ` title="${esc(`${cell?.key || ""} · 完成 ${Number(cell?.count) || 0} 项`)}"`}></span>
                            `).join("")}
                        </div>
                    </div>
                `).join("")}
                </div>
            </div>
        `;
    }

    function renderHeatmapLegend() {
        return `
            <div class="tm-homepage-heatmap-legend" aria-hidden="true">
                <span class="tm-homepage-heatmap-legend-label">低</span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l0"></span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l1"></span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l2"></span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l3"></span>
                <span class="tm-homepage-heatmap-cell tm-homepage-heatmap-cell--l4"></span>
                <span class="tm-homepage-heatmap-legend-label">高</span>
            </div>
        `;
    }

    function renderDistribution(distribution) {
        const items = Array.isArray(distribution?.items) ? distribution.items : [];
        if (!items.length) return `<div class="tm-homepage-chart-empty">暂无分布数据</div>`;
        const maxValue = Math.max(1, ...items.map((item) => Number(item?.value) || 0));
        return `
            <div class="tm-homepage-distribution-list">
                ${items.map((item) => {
                    const value = Number(item?.value) || 0;
                    const width = Math.max(6, Math.round((value / maxValue) * 100));
                    return `
                        <div class="tm-homepage-distribution-item">
                            <div class="tm-homepage-distribution-meta">
                                <span class="tm-homepage-distribution-label">${esc(item?.label || "")}</span>
                                <span class="tm-homepage-distribution-value">${value}</span>
                            </div>
                            <div class="tm-homepage-distribution-track"><span class="tm-homepage-distribution-bar" style="width:${width}%;"></span></div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderTaskList(list, emptyText, kind) {
        const items = Array.isArray(list) ? list : [];
        if (!items.length) return `<div class="tm-homepage-list-empty">${esc(emptyText)}</div>`;
        return `
            <div class="tm-homepage-list">
                ${items.map((item) => {
                    const meta = kind === "risk"
                        ? (item.diffDays < 0 ? `已逾期 ${Math.abs(item.diffDays)} 天` : (item.diffDays === 0 ? "今天到期" : `${item.diffDays} 天后到期`))
                        : formatListDate(item.dateKey);
                    const badge = kind === "risk"
                        ? `<span class="tm-homepage-list-badge ${item.diffDays < 0 ? "is-danger" : "is-warning"}">${esc(meta)}</span>`
                        : `<span class="tm-homepage-list-date">${esc(meta)}</span>`;
                    return `
                        <button type="button" class="tm-homepage-list-item" data-tm-home-open-task="${esc(item.id || "")}">
                            <span class="tm-homepage-list-main">
                                <span class="tm-homepage-list-title">${esc(item.title || "")}</span>
                                <span class="tm-homepage-list-doc">${esc(item.doc || "")}${item.priority ? ` · ${esc(item.priority)}` : ""}</span>
                            </span>
                            <span class="tm-homepage-list-side">${badge}</span>
                        </button>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderOverviewGauge(overview) {
        const segments = buildGaugeSegments(overview);
        const completionRate = Number(overview?.kpis?.completionRate) || 0;
        return `
            <section class="tm-homepage-card tm-homepage-card--overview">
                <div class="tm-homepage-card-head">
                    <div>
                        <div class="tm-homepage-card-title">任务状态</div>
                        <div class="tm-homepage-card-desc">完成、逾期、未完成占比</div>
                    </div>
                    <div class="tm-homepage-overview-rate">完成率 ${completionRate}%</div>
                </div>
                <div class="tm-homepage-overview-summary">
                    <div class="tm-homepage-overview-total">
                        <div class="tm-homepage-overview-total-label">总任务</div>
                        <div class="tm-homepage-overview-total-value">${Number(overview?.kpis?.total) || 0}</div>
                    </div>
                    <div class="tm-homepage-overview-bar-wrap">
                        <div class="tm-homepage-overview-bar" aria-label="任务状态概览">
                            ${segments.map((segment) => `<span class="tm-homepage-overview-bar-seg ${segment.tone}" style="width:${Math.max((segment.value > 0 ? 8 : 0), Number(segment.pct) || 0)}%;"></span>`).join("")}
                        </div>
                    </div>
                </div>
                <div class="tm-homepage-overview-stats">
                    ${segments.map((segment) => `
                        <div class="tm-homepage-overview-stat">
                            <div class="tm-homepage-overview-stat-label"><span class="tm-homepage-overview-dot ${segment.tone}"></span>${esc(segment.label)}</div>
                            <div class="tm-homepage-overview-stat-main">
                                <div class="tm-homepage-overview-stat-value">${segment.value}</div>
                                <div class="tm-homepage-overview-stat-sub">${segment.pct}%</div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </section>
        `;
    }

    function renderSummaryCard(overview) {
        const rows = [
            {
                label: "本周完成",
                value: overview?.kpis?.weekDone || 0,
                unit: "",
                note: `当前范围共 ${overview?.kpis?.total || 0} 项`,
                tone: "",
            },
            {
                label: "连续完成",
                value: Number(overview?.kpis?.streak) || 0,
                unit: "天",
                note: Number(overview?.kpis?.streak) > 0 ? "最近保持连续完成" : "最近还没有形成连续完成",
                tone: Number(overview?.kpis?.streak) > 0 ? "is-success" : "",
            },
        ];
        return `
            <section class="tm-homepage-card tm-homepage-card--summary">
                <div class="tm-homepage-card-head">
                    <div>
                        <div class="tm-homepage-card-title">完成摘要</div>
                        <div class="tm-homepage-card-desc">先看今天，再看本周和连续性</div>
                    </div>
                </div>
                <div class="tm-homepage-summary-layout">
                    <article class="tm-homepage-summary-main">
                        <div class="tm-homepage-summary-main-label">今日完成</div>
                        <div class="tm-homepage-summary-main-value">${overview?.kpis?.todayDone || 0}</div>
                        <div class="tm-homepage-summary-main-note">最近一周累计 ${overview?.kpis?.weekDone || 0} 项</div>
                    </article>
                    <div class="tm-homepage-summary-list">
                        ${rows.map((item) => `
                            <div class="tm-homepage-summary-row ${item.tone}">
                                <div class="tm-homepage-summary-row-label">${esc(item.label)}</div>
                                <div class="tm-homepage-summary-row-value">
                                    <span class="tm-homepage-summary-row-number">${esc(item.value)}</span>
                                    ${item.unit ? `<span class="tm-homepage-summary-row-unit">${esc(item.unit)}</span>` : ""}
                                </div>
                                <div class="tm-homepage-summary-row-note">${esc(item.note)}</div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </section>
        `;
    }

    function renderTrendCard(ctx, profile, overview) {
        const summary = buildTrendSummary(overview?.trend);
        const stats = [
            { label: "最近", value: summary.last.value, note: summary.last.label || "暂无" },
            { label: "峰值", value: summary.peak.value, note: summary.peak.label || "暂无" },
            { label: "日均", value: formatMetricValue(summary.average), note: `近 ${summary.pointCount || 0} 天` },
        ];
        return `
            <section class="tm-homepage-card tm-homepage-card--trend">
                <div class="tm-homepage-card-head tm-homepage-trend-head">
                    <div class="tm-homepage-trend-head-main">
                        <div class="tm-homepage-trend-title-group">
                        <div class="tm-homepage-card-title">完成趋势</div>
                        <div class="tm-homepage-card-desc">最近 ${runtime.rangeDays} 天完成曲线</div>
                        </div>
                        <div class="tm-homepage-trend-summary">
                            ${stats.map((item) => `
                                <div class="tm-homepage-trend-stat">
                                    <div class="tm-homepage-trend-stat-label">${esc(item.label)}</div>
                                    <div class="tm-homepage-trend-stat-value">${esc(item.value)}</div>
                                    <div class="tm-homepage-trend-stat-note">${esc(item.note)}</div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                    ${renderRangeSwitch()}
                </div>
                <div class="tm-homepage-trend-scroll">
                    <div class="tm-homepage-trend-scroll-inner">
                        <div class="tm-homepage-trend-wrap">${buildTrendSvg(overview.trend, ctx, profile)}</div>
                        ${renderTrendAxis(overview?.trend)}
                    </div>
                </div>
            </section>
        `;
    }

    function renderHeroSection(overview) {
        return `
            <div class="tm-homepage-hero-grid">
                ${renderOverviewGauge(overview)}
                ${renderSummaryCard(overview)}
            </div>
        `;
    }

    function renderShell(ctx, profile, overview) {
        return `
            <div class="tm-homepage-shell tm-homepage--${profile}">
                <div class="tm-homepage-main">
                    <header class="tm-homepage-header">
                        <div class="tm-homepage-title-wrap">
                            <h2 class="tm-homepage-title">${esc(overview.title || "主页")}</h2>
                            <p class="tm-homepage-subtitle" data-tm-home-subtitle>${esc(overview.subtitle)}</p>
                        </div>
                    </header>
                    ${renderHeroSection(overview)}
                    <div data-tm-home-trend-slot>${renderTrendCard(ctx, profile, overview)}</div>
                    <div class="tm-homepage-middle-grid">
                        <section class="tm-homepage-card">
                            <div class="tm-homepage-card-head">
                                <div>
                                    <div class="tm-homepage-card-title">完成热力图</div>
                                    <div class="tm-homepage-card-desc">按月展示当前范围内的完成情况</div>
                                </div>
                                ${renderHeatmapLegend()}
                            </div>
                            ${renderHeatmap(overview.heatmap)}
                        </section>
                        <section class="tm-homepage-card">
                            <div class="tm-homepage-card-head">
                                <div>
                                    <div class="tm-homepage-card-title">${esc(overview.distribution?.title || "分布")}</div>
                                    <div class="tm-homepage-card-desc">当前范围内未完成任务分布</div>
                                </div>
                            </div>
                            ${renderDistribution(overview.distribution)}
                        </section>
                    </div>
                    <div class="tm-homepage-bottom-grid">
                        <section class="tm-homepage-card">
                            <div class="tm-homepage-card-head">
                                <div>
                                    <div class="tm-homepage-card-title">最近完成</div>
                                    <div class="tm-homepage-card-desc">保留最近 6 条完成记录</div>
                                </div>
                            </div>
                            ${renderTaskList(overview.recentDone, "当前范围内还没有完成记录。", "done")}
                        </section>
                        <section class="tm-homepage-card">
                            <div class="tm-homepage-card-head">
                                <div>
                                    <div class="tm-homepage-card-title">风险提醒</div>
                                    <div class="tm-homepage-card-desc">逾期优先，其次展示 7 天内到期项</div>
                                </div>
                            </div>
                            ${renderTaskList(overview.riskList, "当前没有需要优先处理的风险任务。", "risk")}
                        </section>
                    </div>
                </div>
            </div>
        `;
    }

    function doRender() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        const ctx = runtime.ctx && typeof runtime.ctx === "object" ? runtime.ctx : {};
        runtime.profile = resolveProfile(ctx);
        runtime.root.dataset.tmHomepageProfile = runtime.profile;
        runtime.root.innerHTML = renderShell(ctx, runtime.profile, buildOverview(ctx));
        return true;
    }

    function doRenderRangeOnly() {
        if (!(runtime.root instanceof HTMLElement)) return false;
        const ctx = runtime.ctx && typeof runtime.ctx === "object" ? runtime.ctx : {};
        runtime.profile = resolveProfile(ctx);
        runtime.root.dataset.tmHomepageProfile = runtime.profile;
        const overview = buildOverview(ctx);
        const subtitleEl = runtime.root.querySelector("[data-tm-home-subtitle]");
        if (subtitleEl instanceof HTMLElement) subtitleEl.textContent = String(overview.subtitle || "");
        const trendSlot = runtime.root.querySelector("[data-tm-home-trend-slot]");
        if (trendSlot instanceof HTMLElement) {
            trendSlot.innerHTML = renderTrendCard(ctx, runtime.profile, overview);
            return true;
        }
        return doRender();
    }

    function bindInteractions() {
        if (!(runtime.root instanceof HTMLElement)) return;
        if (runtime.clickHandler) {
            try { runtime.root.removeEventListener("click", runtime.clickHandler); } catch (e) {}
        }
        runtime.clickHandler = (event) => {
            const target = event?.target instanceof Element ? event.target.closest("[data-tm-home-range],[data-tm-home-open-task]") : null;
            if (!(target instanceof Element)) return;
            const nextRange = String(target.getAttribute("data-tm-home-range") || "").trim();
            if (nextRange) {
                const days = Math.max(7, Math.min(90, Number(nextRange) || 30));
                if (days !== runtime.rangeDays) {
                    runtime.rangeDays = days;
                    doRenderRangeOnly();
                }
                return;
            }
            const taskId = String(target.getAttribute("data-tm-home-open-task") || "").trim();
            if (taskId && typeof runtime.ctx?.onOpenTask === "function") runtime.ctx.onOpenTask(taskId);
        };
        runtime.root.addEventListener("click", runtime.clickHandler);
    }

    function bindResizeObserver() {
        if (!(runtime.root instanceof HTMLElement) || typeof ResizeObserver !== "function") return;
        try { runtime.resizeObserver?.disconnect?.(); } catch (e) {}
        runtime.resizeObserver = new ResizeObserver((entries) => {
            const rect = entries?.[0]?.contentRect;
            if (!rect) return;
            if (runtime.resizeRaf) {
                try { cancelAnimationFrame(runtime.resizeRaf); } catch (e) {}
            }
            runtime.resizeRaf = requestAnimationFrame(() => {
                runtime.resizeRaf = 0;
                const nextWidth = Math.round(rect.width || 0);
                const nextHeight = Math.round(rect.height || 0);
                const prevProfile = runtime.profile;
                const prevWidth = Math.round(toNumber(runtime.ctx?.containerWidth, 0));
                const prevHeight = Math.round(toNumber(runtime.ctx?.containerHeight, 0));
                runtime.ctx = {
                    ...(runtime.ctx || {}),
                    containerWidth: nextWidth,
                    containerHeight: nextHeight,
                };
                if (resolveProfile(runtime.ctx) !== prevProfile || Math.abs(nextWidth - prevWidth) > 8 || Math.abs(nextHeight - prevHeight) > 8) {
                    doRender();
                }
            });
        });
        runtime.resizeObserver.observe(runtime.root);
    }

    function unmount() {
        if (runtime.resizeRaf) {
            try { cancelAnimationFrame(runtime.resizeRaf); } catch (e) {}
            runtime.resizeRaf = 0;
        }
        try { runtime.resizeObserver?.disconnect?.(); } catch (e) {}
        runtime.resizeObserver = null;
        if (runtime.root instanceof HTMLElement && runtime.clickHandler) {
            try { runtime.root.removeEventListener("click", runtime.clickHandler); } catch (e) {}
        }
        runtime.clickHandler = null;
        if (runtime.root instanceof HTMLElement) {
            try { runtime.root.innerHTML = ""; } catch (e) {}
        }
        runtime.root = null;
        runtime.ctx = null;
    }

    function mount(root, ctx = {}) {
        if (!(root instanceof HTMLElement)) return false;
        if (runtime.root && runtime.root !== root) unmount();
        ensureHomepageStyle();
        runtime.root = root;
        runtime.ctx = {
            ...(ctx && typeof ctx === "object" ? ctx : {}),
            containerWidth: Math.round(root.clientWidth || 0),
            containerHeight: Math.round(root.clientHeight || 0),
        };
        doRender();
        bindInteractions();
        bindResizeObserver();
        return true;
    }

    function update(ctx = {}) {
        if (!(runtime.root instanceof HTMLElement)) return false;
        runtime.ctx = {
            ...(runtime.ctx || {}),
            ...(ctx && typeof ctx === "object" ? ctx : {}),
            containerWidth: Math.round(runtime.root.clientWidth || toNumber(ctx?.containerWidth, 0)),
            containerHeight: Math.round(runtime.root.clientHeight || toNumber(ctx?.containerHeight, 0)),
        };
        return doRender();
    }

    globalThis.__tmHomepage = {
        loaded: true,
        mount,
        update,
        unmount,
        resize: () => update(runtime.ctx || {}),
    };
})();
