import { useCallback, useEffect, useRef, useState, useMemo } from "react";

import { useTheme } from "../../context/ThemeContext";
import publicWebsiteService, {
  resolveMediaUrl,
} from "../../services/publicWebsiteService";

/* ════════════════════════════════════════════════════════════════════════════
   SEO HELPERS
   ════════════════════════════════════════════════════════════════════════════ */
const setMeta = (attribute, key, content) => {
  if (!content) return () => {};
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector(selector);
  const created = !element;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  const previous = element.getAttribute("content");
  element.setAttribute("content", content);
  return () => {
    if (created) element.remove();
    else if (previous === null) element.removeAttribute("content");
    else element.setAttribute("content", previous);
  };
};

/* Create-only link (never hijacks existing app stylesheets) */
const addLink = (rel, href) => {
  if (!href) return () => {};
  const element = document.createElement("link");
  element.rel = rel;
  element.href = href;
  if (rel === "stylesheet") element.crossOrigin = "anonymous";
  document.head.appendChild(element);
  return () => element.remove();
};

/* ════════════════════════════════════════════════════════════════════════════
   UTILITIES
   ════════════════════════════════════════════════════════════════════════════ */
const isExternal = (url = "") => /^https?:\/\//i.test(url);
const relFor = (url, blank) =>
  blank || isExternal(url) ? "noreferrer" : undefined;

const trackPointer = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty(
    "--mx",
    `${((e.clientX - r.left) / r.width) * 100}%`,
  );
  e.currentTarget.style.setProperty(
    "--my",
    `${((e.clientY - r.top) / r.height) * 100}%`,
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   HARDCODED CONTENT
   ════════════════════════════════════════════════════════════════════════════ */
const NAV_LINKS = [
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Technology", href: "#technology" },
  { label: "Contact", href: "#contact" },
];

const SYSTEM_LAYERS = [
  { a: "React", b: "REST APIs", text: "Connected web interfaces" },
  { a: "Django", b: "Python", text: "Business logic and workflows" },
  { a: "Django REST", b: "React", text: "API-driven application delivery" },
  { a: "Vite", b: "React", text: "Modern frontend development" },
];

const APP_COLORS = {
  React: ["#149ECA", "#087EA4"],
  Vite: ["#646CFF", "#BD34FE"],
  Django: ["#0C4B33", "#44B78B"],
  "Django REST": ["#A30000", "#D32F2F"],
  "Django REST Framework": ["#A30000", "#D32F2F"],
  Python: ["#3776AB", "#FFD343"],
  "REST APIs": ["#635BFF", "#22D3EE"],
};

const TECHNOLOGIES_A = ["React", "Vite", "REST APIs"];
const TECHNOLOGIES_B = ["Django", "Django REST Framework", "Python"];

const CAPABILITY_SUMMARY = [
  {
    title: "Connected systems",
    label: "Software designed around coordinated business workflows",
  },
  {
    title: "Business software",
    label: "Practical platforms for businesses and organizations",
  },
  {
    title: "API-driven",
    label: "Clear interfaces between applications and services",
  },
  {
    title: "Scalable platforms",
    label: "Modular systems that can evolve with real operations",
  },
];

const CONTACT_ITEMS = [
  {
    icon: "mail",
    label: "Email",
    value: "asanlinktech@gmail.com",
    href: "mailto:asanlinktech@gmail.com",
  },
  {
    icon: "phone",
    label: "Phone",
    value: "+93 76 468 2380",
    href: "tel:+93764682380",
  },
  {
    icon: "pin",
    label: "Location",
    value: "Kote Sangi, Kabul, Afghanistan",
  },
];

const FOOTER_COLUMNS = [
  {
    title: "Explore",
    links: [
      { label: "Projects", href: "#projects" },
      { label: "Capabilities", href: "#capabilities" },
      { label: "Technology", href: "#technology" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Asanlink", href: "#about" },
      { label: "Contact", href: "#contact" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

/* ════════════════════════════════════════════════════════════════════════════
   ICONS (added sun / moon for premium toggle)
   ════════════════════════════════════════════════════════════════════════════ */
const Icon = ({ name, size = 18, className = "" }) => {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m3.5 7 8.5 6 8.5-6" />
      </>
    ),
    phone: (
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    ),
    pin: (
      <>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    play: <path d="M7.5 5.5v13l11-6.5-11-6.5Z" />,
    spark: (
      <path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8M5.6 18.4l2.8-2.8m7.2-7.2 2.8-2.8" />
    ),
    bolt: <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />,
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6l7-3Z" />
        <path d="m9.3 11.6 2 2 3.6-3.6" />
      </>
    ),
    chart: <path d="M5 20v-8M12 20V5M19 20v-6" />,
    code: <path d="M8 8 4 12l4 4M16 8l4 4-4 4" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.6 4 5.6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.6-4-9s1.5-6.4 4-9Z" />
      </>
    ),
    plug: (
      <>
        <path d="M9 7V3M15 7V3" />
        <path d="M7 7h10v4a5 5 0 0 1-10 0V7Z" />
        <path d="M12 16v5" />
      </>
    ),
    layers: (
      <>
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
        <path d="M10.3 20a2 2 0 0 0 3.4 0" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 12a8 8 0 1 1-2.3-5.7" />
        <path d="M20 4v5h-5" />
      </>
    ),
    doc: (
      <>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5M10 13h6M10 17h6" />
      </>
    ),
    swap: <path d="M7 10h13l-4-4M17 14H4l4 4" />,
    users: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3.5 20c.5-3.4 2.7-5.4 5.5-5.4s5 2 5.5 5.4" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16.2 14.8c2.2.4 3.7 2 4.2 4.7" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
        <path d="M5 5.5v13c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-13" />
        <path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
      </>
    ),
    workflow: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
        <path d="M10 6.5h3.5a4 4 0 0 1 4 4V14" />
      </>
    ),
    infinity: (
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
    send: <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" />,
    star: (
      <path
        fill="currentColor"
        stroke="none"
        d="M12 2.6l2.8 5.9 6.4.9-4.7 4.5 1.1 6.4L12 17.2l-5.6 3.1 1.1-6.4L2.8 9.4l6.4-.9L12 2.6Z"
      />
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="5" />
        <path d="M12 2v2m0 16v2M4.2 4.2l1.4 1.4m9.2 9.2 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4m9.2-9.2 1.4-1.4" />
      </>
    ),
    moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  };
  return (
    <svg
      className={`al-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.spark}
    </svg>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   PREMIUM THEME TOGGLE
   ════════════════════════════════════════════════════════════════════════════ */
const ThemeToggle = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  const [animating, setAnimating] = useState(false);
  const isDark = theme === "dark";

  const handleToggle = () => {
    setAnimating(true);
    setTimeout(() => {
      if (typeof toggleTheme === "function") toggleTheme();
      else if (typeof setTheme === "function")
        setTheme(isDark ? "light" : "dark");
      setAnimating(false);
    }, 320);
  };

  return (
    <button
      className="al-theme-toggle"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      aria-pressed={isDark}
      onClick={handleToggle}
      type="button"
      title="Toggle theme"
    >
      <span className="al-theme-toggle__track">
        <span
          className={`al-theme-toggle__pill ${isDark ? "is-dark" : "is-light"} ${animating ? "animating" : ""}`}
        >
          <span className="al-theme-toggle__sun" aria-hidden="true">
            <Icon name="sun" size={13} />
          </span>
          <span className="al-theme-toggle__moon" aria-hidden="true">
            <Icon name="moon" size={13} />
          </span>
        </span>
      </span>
    </button>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   SMALL PRESENTATIONAL COMPONENTS
   ════════════════════════════════════════════════════════════════════════════ */
const Brand = () => (
  <a className="al-brand" href="#top" aria-label="Asanlink — home">
    <span className="al-brand__mark" aria-hidden="true">
      <Icon name="link" size={17} />
    </span>
    Asanlink
  </a>
);

const AppTile = ({ name, size = 28 }) => {
  const c = APP_COLORS[name] || ["#635BFF", "#8B5CF6"];
  return (
    <span
      className="al-apptile"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${c[0]}, ${c[1]})`,
      }}
      aria-hidden="true"
    >
      {(name || "?").charAt(0)}
    </span>
  );
};

const SloganBadge = () => (
  <span className="al-hero__badge" data-reveal>
    <Icon name="link" size={13} />
    <span>Asanlink</span>
    <span className="al-hero__pair">seamless connectivity</span>
  </span>
);

/* ════════════════════════════════════════════════════════════════════════════
   CONNECTED-SYSTEM CANVAS
   ════════════════════════════════════════════════════════════════════════════ */
const SystemCanvas = () => {
  const [tick, setTick] = useState(0);
  const [hoverable] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches,
  );
  const tiltRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2600);
    return () => clearInterval(id);
  }, []);

  const onTilt = (e) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 4.5).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 6.5).toFixed(2)}deg`);
  };
  const resetTilt = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  const rows = [0, 1, 2].map(
    (offset) => SYSTEM_LAYERS[(tick + offset) % SYSTEM_LAYERS.length],
  );

  const sideItems = [
    { icon: "workflow", label: "Systems", active: true },
    { icon: "layers", label: "Applications" },
    { icon: "swap", label: "APIs" },
    { icon: "chart", label: "Data" },
    { icon: "plug", label: "Connections" },
  ];

  return (
    <div
      className="al-hero__tilt"
      ref={tiltRef}
      onPointerMove={hoverable ? onTilt : undefined}
      onPointerLeave={hoverable ? resetTilt : undefined}
    >
      <div className="al-system" aria-hidden="true">
        <div className="al-system__chrome">
          <span className="al-system__dots">
            <i style={{ background: "#FF5F57" }} />
            <i style={{ background: "#FEBC2E" }} />
            <i style={{ background: "#28C840" }} />
          </span>
          <span className="al-system__url">
            <Icon name="link" size={11} />
            Asanlink connected systems
          </span>
          <span className="al-system__live">
            <Icon name="layers" size={11} />
            Architecture
          </span>
        </div>

        <div className="al-system__body">
          <aside className="al-system__side">
            {sideItems.map((item) => (
              <span
                key={item.label}
                className={`al-system__sitem ${item.active ? "is-active" : ""}`}
              >
                <Icon name={item.icon} size={15} />
                {item.label}
              </span>
            ))}
            <span className="al-system__user">
              <span className="al-system__userdot">A</span>
              Asanlink
            </span>
          </aside>

          <div className="al-system__main">
            <div className="al-system__kpis">
              <div className="al-kpi">
                <span>Business software</span>
                <strong>Practical</strong>
                <em>built around real workflows</em>
              </div>
              <div className="al-kpi">
                <span>Connected systems</span>
                <strong>Integrated</strong>
                <em>clear data paths</em>
              </div>
              <div className="al-kpi">
                <span>Digital solutions</span>
                <strong>Focused</strong>
                <em>usable by design</em>
              </div>
            </div>

            <div className="al-system__chart">
              <div className="al-system__charthead">
                <span>Connected architecture</span>
                <span className="al-range">
                  <i className="is-on">UI</i>
                  <i>API</i>
                </span>
              </div>
              <svg className="al-chart" viewBox="0 0 560 200" fill="none">
                <defs>
                  <linearGradient id="alChA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#635BFF" stopOpacity=".32" />
                    <stop offset="1" stopColor="#635BFF" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="alChL" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#635BFF" />
                    <stop offset="1" stopColor="#22D3EE" />
                  </linearGradient>
                </defs>
                {[50, 100, 150].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    x2="560"
                    y1={y}
                    y2={y}
                    stroke="rgba(148,163,184,.18)"
                    strokeDasharray="3 6"
                  />
                ))}
                <path
                  className="al-chart__prev"
                  d="M0 176 C60 168 90 172 130 160 C170 148 210 158 250 148 C290 138 330 148 370 136 C410 126 450 134 490 120 C520 110 545 114 560 106"
                  stroke="rgba(148,163,184,.45)"
                  strokeWidth="1.5"
                  strokeDasharray="4 6"
                />
                <path
                  className="al-chart__area"
                  d="M0 168 C50 150 80 158 110 138 C140 118 170 136 200 118 C230 100 260 116 290 92 C320 70 350 86 380 66 C410 48 440 60 470 40 C500 22 530 30 560 14 L560 200 L0 200 Z"
                  fill="url(#alChA)"
                />
                <path
                  className="al-chart__line"
                  pathLength="1"
                  d="M0 168 C50 150 80 158 110 138 C140 118 170 136 200 118 C230 100 260 116 290 92 C320 70 350 86 380 66 C410 48 440 60 470 40 C500 22 530 30 560 14"
                  stroke="url(#alChL)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="556" cy="15" r="4" fill="#22D3EE" />
                <circle cx="556" cy="15" r="4" fill="#22D3EE" opacity=".5">
                  <animate
                    attributeName="r"
                    values="4;11"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values=".5;0"
                    dur="1.8s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>

            <div className="al-system__feed">
              <div className="al-feed__head">
                <span>System layers</span>
                <span className="al-live">
                  <Icon name="link" size={11} />
                  CONNECTED
                </span>
              </div>
              {rows.map((row, i) => (
                <div className="al-feed__row" key={row.text}>
                  <span className="al-feed__apps">
                    <AppTile name={row.a} size={20} />
                    <Icon name="arrow" size={11} />
                    <AppTile name={row.b} size={20} />
                  </span>
                  <span className="al-feed__text">{row.text}</span>
                  <time>{String(i + 1).padStart(2, "0")}</time>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CapabilitySummary = ({ title, label, delay = 0 }) => {
  return (
    <div className="al-stat" data-reveal style={{ "--d": `${delay}ms` }}>
      <strong>{title}</strong>
      <span className="al-stat__label">{label}</span>
    </div>
  );
};

/* Generic seamless marquee */
const Marquee = ({ children, reverse = false, duration = 46 }) => (
  <div
    className={`al-marquee ${reverse ? "al-marquee--rev" : ""}`}
    style={{ "--speed": `${duration}s` }}
  >
    <div className="al-marquee__track">
      <div className="al-marquee__group">{children}</div>
      <div className="al-marquee__group" aria-hidden="true">
        {children}
      </div>
    </div>
  </div>
);

/* Shared section heading */
const Heading = ({ eyebrow, title, lead, center = true, split = false }) => (
  <header
    className={`al-heading ${center ? "al-heading--center" : ""} ${
      split ? "al-heading--split" : ""
    }`}
    data-reveal
  >
    <div className="al-heading__stack">
      {eyebrow && <span className="al-eyebrow">{eyebrow}</span>}
      {title && <h2 className="al-h2">{title}</h2>}
    </div>
    {lead && <p className="al-lead">{lead}</p>}
  </header>
);

/* ════════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM (scoped CSS) — enhanced dark theme + premium toggle
   ════════════════════════════════════════════════════════════════════════════ */
const STYLES = `
.al{
  --al-font: "Inter", "SF Pro Display", "Segoe UI", ui-sans-serif, system-ui, -apple-system, sans-serif;
  --al-serif: "Instrument Serif", Georgia, "Times New Roman", serif;
  --al-mono: ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace;
  --al-ease: cubic-bezier(.22,1,.36,1);
  --al-fast: .22s var(--al-ease);
  --al-slow: .7s var(--al-ease);
  --al-container: 1160px;
  --al-primary-rgb: 99, 91, 255;
  --al-secondary-rgb: 139, 92, 246;
  --al-accent-rgb: 34, 211, 238;
  --al-success-rgb: 16, 185, 129;
  --al-bg-rgb: 247, 248, 252;
  --al-text-rgb: 13, 15, 26;
  --al-primary: rgb(var(--al-primary-rgb));
  --al-success: rgb(var(--al-success-rgb));
  --al-muted: rgba(var(--al-text-rgb), .62);
  --al-faint: rgba(var(--al-text-rgb), .45);
  --al-line: rgba(var(--al-text-rgb), .08);
  --al-line-strong: rgba(var(--al-text-rgb), .15);
  --al-surface: rgba(var(--al-text-rgb), .03);
  --al-surface-2: rgba(var(--al-text-rgb), .06);
  --al-raised: #ffffff;
  --al-glass: rgba(var(--al-bg-rgb), .7);
  --al-glass-strong: rgba(var(--al-bg-rgb), .88);
  --al-shadow: 0 1px 2px rgba(var(--al-text-rgb), .05), 0 16px 40px -18px rgba(var(--al-text-rgb), .18);
  --al-shadow-lg: 0 2px 6px rgba(var(--al-text-rgb), .05), 0 50px 100px -40px rgba(var(--al-text-rgb), .35);
  --al-grad: linear-gradient(135deg, rgb(var(--al-primary-rgb)), rgb(var(--al-secondary-rgb)) 55%, rgb(var(--al-accent-rgb)) 130%);
  --al-on-primary: #fff;
  --al-radius-xl: 26px; --al-radius-lg: 18px; --al-radius-md: 14px; --al-radius-sm: 10px;
  font-family: var(--al-font); color: rgb(var(--al-text-rgb)); background: rgb(var(--al-bg-rgb));
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  position: relative; min-height: 100vh; overflow-x: clip; line-height: 1.55;
}

.al[data-theme="dark"]{
  --al-bg-rgb: 4, 5, 11;
  --al-text-rgb: 237, 240, 250;
  --al-muted: rgba(var(--al-text-rgb), .68);
  --al-faint: rgba(var(--al-text-rgb), .48);
  --al-line: rgba(var(--al-text-rgb), .10);
  --al-line-strong: rgba(var(--al-text-rgb), .18);
  --al-surface: rgba(var(--al-text-rgb), .045);
  --al-surface-2: rgba(var(--al-text-rgb), .09);
  --al-raised: rgba(255,255,255,.05);
  --al-glass: rgba(8, 9, 18, .55);
  --al-glass-strong: rgba(8, 9, 18, .82);
  --al-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 24px 60px -24px rgba(0,0,0,.75);
  --al-shadow-lg: inset 0 1px 0 rgba(255,255,255,.06), 0 70px 130px -50px rgba(0,0,0,.85);
  color-scheme: dark;
}

.al *, .al *::before, .al *::after{ box-sizing: border-box; }
.al img{ max-width: 100%; display: block; }
.al a{ color: inherit; text-decoration: none; }
.al ul{ list-style: none; margin: 0; padding: 0; }
.al h1,.al h2,.al h3,.al h4,.al p{ margin: 0; }
.al button{ font-family: inherit; }
.al ::selection{ background: rgba(var(--al-primary-rgb), .9); color: #fff; }
.al :focus-visible{ outline: 2px solid var(--al-primary); outline-offset: 3px; border-radius: 8px; }
html{ scroll-behavior: smooth; scroll-padding-top: 96px; }

/* ── ATMOSPHERE ── */
.al__atmos{ position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.al__orb{ position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; will-change: transform; }
.al__orb--a{ width: 62vw; height: 62vw; max-width: 900px; max-height: 900px; top: -24vw; right: -16vw; background: radial-gradient(circle at 30% 30%, rgba(var(--al-primary-rgb),.32), transparent 62%); }
.al__orb--b{ width: 46vw; height: 46vw; max-width: 680px; max-height: 680px; top: 42vh; left: -20vw; background: radial-gradient(circle at 60% 40%, rgba(var(--al-accent-rgb),.24), transparent 60%); }
.al__orb--c{ width: 40vw; height: 40vw; max-width: 620px; max-height: 620px; bottom: -12vw; right: 10vw; background: radial-gradient(circle at 50% 50%, rgba(var(--al-secondary-rgb),.22), transparent 60%); }
.al[data-theme="dark"] .al__orb{ opacity: .55; }
.al__grid{ position: absolute; inset: 0;
  background-image: linear-gradient(rgba(var(--al-text-rgb),.045) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--al-text-rgb),.045) 1px, transparent 1px);
  background-size: 72px 72px;
  -webkit-mask-image: radial-gradient(ellipse 75% 55% at 50% 0%, #000 15%, transparent 78%);
  mask-image: radial-gradient(ellipse 75% 55% at 50% 0%, #000 15%, transparent 78%); }
.al__grain{ position: absolute; inset: 0; opacity: .03; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.al[data-theme="dark"] .al__grain{ mix-blend-mode: screen; opacity: .05; }
.al-shell{ position: relative; z-index: 1; }

/* ── LAYOUT ── */
.al-container{ width: min(var(--al-container), 100% - 2.5rem); margin-inline: auto; }
@media (min-width: 900px){ .al-container{ width: min(var(--al-container), 100% - 4rem); } }
.al-section{ position: relative; padding-block: clamp(4.5rem, 9vw, 8rem); }
.al-section--tint{ background: linear-gradient(180deg, transparent, rgba(var(--al-primary-rgb),.05) 18%, rgba(var(--al-primary-rgb),.05) 82%, transparent); }

/* ── PROGRESS BAR ── */
.al-progress{ position: fixed; top: 0; left: 0; height: 2px; width: 0; z-index: 90; pointer-events: none;
  background: linear-gradient(90deg, rgb(var(--al-primary-rgb)), rgb(var(--al-accent-rgb))); }

/* ── TYPOGRAPHY ── */
.al-eyebrow{ display: inline-flex; align-items: center; gap: .55rem; font-size: .74rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--al-primary); }
.al-eyebrow::before{ content: ""; width: 20px; height: 1px; background: currentColor; opacity: .6; }
.al-h2{ font-size: clamp(1.9rem, 3.8vw, 2.9rem); line-height: 1.08; letter-spacing: -.032em; font-weight: 700; text-wrap: balance; }
.al-h3{ font-size: 1.12rem; font-weight: 700; letter-spacing: -.015em; }
.al-serif-em{ font-family: var(--al-serif); font-style: italic; font-weight: 400; letter-spacing: -.01em;
  background: linear-gradient(100deg, rgb(var(--al-primary-rgb)), rgb(var(--al-accent-rgb)));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; padding-right: .06em; }
.al-h2 .al-serif-em{ font-size: 1.05em; }
.al-lead{ font-size: clamp(1rem, 1.4vw, 1.13rem); line-height: 1.65; color: var(--al-muted); max-width: 60ch; text-wrap: pretty; }
.al-heading{ display: grid; gap: 1rem; max-width: 720px; margin-bottom: clamp(2.5rem, 5vw, 3.75rem); }
.al-heading__stack{ display: grid; gap: 1rem; }
.al-heading--center{ margin-inline: auto; text-align: center; justify-items: center; }
.al-heading--split{ max-width: none; }
@media (min-width: 900px){
  .al-heading--split{ grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1rem 4rem; align-items: end; }
  .al-heading--split .al-lead{ margin-top: auto; justify-self: end; }
}

/* ── BUTTONS / LINKS / CHIPS ── */
.al-btn{ position: relative; display: inline-flex; align-items: center; justify-content: center; gap: .55rem;
  padding: .9rem 1.5rem; border-radius: 999px; font-weight: 600; font-size: .95rem; line-height: 1; letter-spacing: -.005em;
  border: 1px solid transparent; cursor: pointer; white-space: nowrap; overflow: hidden; isolation: isolate; min-height: 46px;
  transition: transform var(--al-fast), box-shadow var(--al-fast), background var(--al-fast), border-color var(--al-fast), color var(--al-fast); }
.al-btn .al-icon{ transition: transform var(--al-fast); }
.al-btn:hover .al-icon{ transform: translateX(3px); }
.al-btn:active{ transform: translateY(0) scale(.97); }
.al-btn--primary{ color: var(--al-on-primary); background: linear-gradient(135deg, rgb(var(--al-primary-rgb)), rgb(var(--al-secondary-rgb)));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 12px 30px -12px rgba(var(--al-primary-rgb), .75); }
.al-btn--primary::after{ content: ""; position: absolute; inset: 0; z-index: -1; transform: translateX(-130%);
  background: linear-gradient(115deg, transparent 32%, rgba(255,255,255,.32) 50%, transparent 66%); transition: transform .8s var(--al-ease); }
.al-btn--primary:hover{ transform: translateY(-2px); box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 20px 44px -14px rgba(var(--al-primary-rgb), .85); }
.al-btn--primary:hover::after{ transform: translateX(130%); }
.al-btn--ghost{ color: rgb(var(--al-text-rgb)); background: var(--al-glass); border-color: var(--al-line-strong);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.al-btn--ghost:hover{ transform: translateY(-2px); border-color: rgba(var(--al-primary-rgb), .5); box-shadow: var(--al-shadow); }
.al-btn--inverse{ color: rgb(var(--al-primary-rgb)); background: #fff;
  box-shadow: 0 14px 34px -14px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.6); }
.al-btn--inverse:hover{ transform: translateY(-2px); }
.al-btn--sm{ padding: .62rem 1.05rem; font-size: .86rem; min-height: 40px; }
.al-btn--lg{ padding: 1.05rem 1.7rem; font-size: 1rem; min-height: 52px; }

.al-textlink{ display: inline-flex; align-items: center; gap: .4rem; font-weight: 600; font-size: .9rem; color: var(--al-primary); position: relative; padding-bottom: 2px; }
.al-textlink::after{ content: ""; position: absolute; left: 0; bottom: 0; height: 1px; width: 100%; background: currentColor;
  transform: scaleX(0); transform-origin: right; transition: transform .35s var(--al-ease); }
.al-textlink:hover::after{ transform: scaleX(1); transform-origin: left; }
.al-chip{ display: inline-flex; align-items: center; gap: .45rem; padding: .4rem .8rem; border-radius: 999px;
  border: 1px solid var(--al-line); background: var(--al-surface); font-size: .78rem; font-weight: 600; color: var(--al-muted); }
.al-chip .al-icon{ color: var(--al-primary); }
.al-chip--mono{ font-family: var(--al-mono); font-weight: 500; font-size: .74rem; }
.al-chiprow{ display: flex; flex-wrap: wrap; gap: .45rem; }

/* ── ANNOUNCEMENT ── */
.al-announce{ position: relative; display: flex; align-items: center; justify-content: center; gap: .5rem; flex-wrap: wrap;
  padding: .6rem 3rem; font-size: .84rem; color: var(--al-muted); text-align: center;
  background: linear-gradient(90deg, rgba(var(--al-primary-rgb),.14), rgba(var(--al-accent-rgb),.12) 50%, rgba(var(--al-secondary-rgb),.14));
  border-bottom: 1px solid var(--al-line); }
.al-announce strong{ color: rgb(var(--al-text-rgb)); font-weight: 700; }
.al-announce__link{ display: inline-flex; align-items: center; gap: .3rem; color: var(--al-primary); font-weight: 600; }
.al-announce__close{ position: absolute; right: .6rem; top: 50%; transform: translateY(-50%); width: 28px; height: 28px;
  display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--al-faint); cursor: pointer; transition: background var(--al-fast), color var(--al-fast); }
.al-announce__close:hover{ background: var(--al-surface-2); color: rgb(var(--al-text-rgb)); }

/* ── HEADER ── */
.al-header{ position: sticky; top: 0; z-index: 60; padding: .7rem 0; pointer-events: none; }
.al-header__bar{ pointer-events: auto; display: flex; align-items: center; gap: 1rem; height: 60px; padding: 0 .55rem 0 1.1rem;
  border-radius: 999px; background: var(--al-glass); border: 1px solid var(--al-line);
  backdrop-filter: blur(18px) saturate(1.5); -webkit-backdrop-filter: blur(18px) saturate(1.5);
  transition: box-shadow var(--al-slow), background var(--al-fast), border-color var(--al-fast); }
.al-header.is-scrolled .al-header__bar{ background: var(--al-glass-strong); border-color: var(--al-line-strong); box-shadow: var(--al-shadow); }
.al-brand{ display: inline-flex; align-items: center; gap: .65rem; font-weight: 800; letter-spacing: -.03em; font-size: 1.06rem; }
.al-brand__mark{ width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; color: #fff; background: var(--al-grad);
  box-shadow: 0 8px 18px -8px rgba(var(--al-primary-rgb), .8), inset 0 1px 0 rgba(255,255,255,.35); }
.al-nav{ display: none; margin-inline: auto; }
@media (min-width: 1024px){ .al-nav{ display: block; } }
.al-nav ul{ display: flex; gap: .1rem; }
.al-nav a{ position: relative; display: inline-flex; padding: .5rem .85rem; border-radius: 999px; font-size: .9rem; font-weight: 500;
  color: var(--al-muted); transition: color var(--al-fast), background var(--al-fast); }
.al-nav a:hover{ color: rgb(var(--al-text-rgb)); background: var(--al-surface-2); }
.al-nav a.is-active{ color: rgb(var(--al-text-rgb)); }
.al-nav a.is-active::after{ content: ""; position: absolute; left: 50%; bottom: 2px; width: 4px; height: 4px; border-radius: 50%;
  background: var(--al-primary); transform: translateX(-50%); }
.al-header__right{ display: flex; align-items: center; gap: .5rem; margin-left: auto; }
.al-header__signin{ display: none; }
@media (min-width: 1024px){ .al-header__signin{ display: inline-flex; } }
.al-burger{ display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--al-line);
  background: transparent; color: rgb(var(--al-text-rgb)); cursor: pointer; transition: background var(--al-fast); }
.al-burger:hover{ background: var(--al-surface-2); }
@media (min-width: 1024px){ .al-burger{ display: none; } }

/* ── PREMIUM THEME TOGGLE ── */
.al-theme-toggle{ position: relative; display: inline-grid; place-items: center; width: 54px; height: 30px; border-radius: 999px;
  border: 1px solid var(--al-line-strong); background: var(--al-glass-strong); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4);
  cursor: pointer; transition: border-color var(--al-fast), box-shadow var(--al-fast); padding: 0; overflow: hidden; }
.al-theme-toggle:hover{ border-color: rgba(var(--al-primary-rgb), .45); box-shadow: 0 0 0 5px rgba(var(--al-primary-rgb), .08), 0 8px 24px -8px rgba(var(--al-primary-rgb), .35); }
.al-theme-toggle__track{ position: relative; width: 100%; height: 100%; border-radius: 999px; }
.al-theme-toggle__pill{ position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%;
  background: linear-gradient(135deg, rgb(var(--al-primary-rgb)), rgb(var(--al-secondary-rgb)));
  display: grid; place-items: center; color: #fff; transition: transform .38s var(--al-ease), box-shadow .38s var(--al-ease);
  box-shadow: 0 2px 10px rgba(var(--al-primary-rgb), .55), inset 0 1px 0 rgba(255,255,255,.28); }
.al-theme-toggle__pill.is-dark{ transform: translateX(24px); }
.al-theme-toggle__pill.animating{ animation: al-pill-bounce .32s ease; }
.al-theme-toggle__sun, .al-theme-toggle__moon{ position: absolute; inset: 0; display: grid; place-items: center; opacity: .9; transition: opacity .25s ease; }
.al-theme-toggle__pill.is-dark .al-theme-toggle__sun{ opacity: 0; }
.al-theme-toggle__pill.is-light .al-theme-toggle__moon{ opacity: 0; }
@keyframes al-pill-bounce{
  0%{ transform: translateX(0) scale(1); }
  30%{ transform: translateX(10px) scale(1.15); }
  70%{ transform: translateX(14px) scale(.92); }
  100%{ transform: translateX(24px) scale(1); }
}

/* ── MOBILE NAV ── */
.al-mobile{ position: fixed; inset: 0; z-index: 70; display: grid; grid-template-rows: auto 1fr;
  background: var(--al-glass-strong); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); animation: al-fade .3s var(--al-ease); }
.al-mobile__top{ display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--al-line); }
.al-mobile__body{ overflow: auto; padding: 1.5rem 1.25rem 2.5rem; display: grid; align-content: start; gap: 1.75rem; }
.al-mobile__list{ display: grid; gap: .25rem; }
.al-mobile__link{ display: flex; align-items: center; justify-content: space-between; padding: .9rem .75rem; border-radius: 14px;
  font-size: 1.4rem; font-weight: 700; letter-spacing: -.02em; animation: al-rise .5s var(--al-ease) both; animation-delay: calc(var(--i) * 45ms); }
.al-mobile__link:hover{ background: var(--al-surface-2); }
.al-mobile__link .al-icon{ color: var(--al-faint); }
.al-mobile__actions{ display: grid; gap: .6rem; }
.al-mobile__actions .al-btn{ justify-content: center; }

/* ── HERO ── */
.al-hero{ position: relative; padding: clamp(3.5rem, 8vw, 6.5rem) 0 clamp(4rem, 8vw, 6rem); text-align: center; overflow: clip; }
.al-hero::before{ content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(620px circle at var(--hx, 50%) var(--hy, 28%), rgba(var(--al-primary-rgb), .09), transparent 65%); }
.al-hero__copy{ position: relative; display: grid; gap: 1.4rem; justify-items: center; max-width: 860px; margin-inline: auto; }
.al-hero__copy > *{ animation: al-rise .9s var(--al-ease) both; }
.al-hero__copy > :nth-child(1){ animation-delay: .05s } .al-hero__copy > :nth-child(2){ animation-delay: .14s }
.al-hero__copy > :nth-child(3){ animation-delay: .23s } .al-hero__copy > :nth-child(4){ animation-delay: .32s }
.al-hero__copy > :nth-child(5){ animation-delay: .41s } .al-hero__copy > :nth-child(6){ animation-delay: .5s }
.al-hero__badge{ display: inline-flex; align-items: center; gap: .6rem; padding: .45rem 1rem .45rem .75rem; border-radius: 999px;
  border: 1px solid var(--al-line-strong); background: var(--al-glass); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font-size: .82rem; font-weight: 500; color: var(--al-muted); box-shadow: var(--al-shadow); }
.al-hero__pair{ display: inline-flex; align-items: center; gap: .35rem; color: var(--al-primary); font-weight: 700; animation: al-word .5s var(--al-ease); }
.al-hero__title{ font-size: clamp(2.6rem, 6.4vw, 4.5rem); line-height: 1.04; letter-spacing: -.04em; font-weight: 800; text-wrap: balance;
  background: linear-gradient(180deg, rgb(var(--al-text-rgb)) 55%, rgba(var(--al-text-rgb), .72));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; padding-bottom: .06em; }
.al-hero__title .al-serif-em{ font-size: 1.03em; }
.al-hero__lead{ max-width: 640px; }
.al-hero__micro{ font-size: .8rem; color: var(--al-faint); }
.al-hero__proof{ display: flex; align-items: center; gap: .9rem; flex-wrap: wrap; justify-content: center; font-size: .86rem; color: var(--al-muted); }
.al-hero__stage{ position: relative; max-width: 980px; margin: clamp(2.75rem, 5vw, 4.25rem) auto 0; }
.al-stage__glow{ position: absolute; inset: -10% -14%; z-index: -1; filter: blur(60px);
  background: radial-gradient(50% 55% at 50% 45%, rgba(var(--al-primary-rgb), .38), transparent 70%); }
.al-stage__rings{ position: absolute; inset: -12% -16%; width: 132%; height: 124%; z-index: -1; pointer-events: none; }
.al-stage__rings ellipse{ fill: none; stroke: rgba(var(--al-primary-rgb), .18); stroke-width: 1; }
.al-stage__rings ellipse:nth-child(2){ stroke: rgba(var(--al-accent-rgb), .16); animation: al-dashmove 26s linear infinite; }
.al-hero__tilt{ transform: perspective(1400px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform .5s var(--al-ease); transform-style: preserve-3d; will-change: transform; }
.al-float{ position: absolute; z-index: 3; display: flex; align-items: center; gap: .7rem; padding: .7rem .95rem; border-radius: 16px;
  background: var(--al-glass-strong); border: 1px solid var(--al-line-strong); box-shadow: var(--al-shadow-lg);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); animation: al-float 7s ease-in-out infinite; text-align: left; }
.al-float small{ display: block; font-size: .62rem; text-transform: uppercase; letter-spacing: .1em; color: var(--al-faint); font-weight: 700; }
.al-float strong{ font-size: .86rem; letter-spacing: -.01em; display: flex; align-items: center; gap: .4rem; }
.al-float--a{ top: -24px; right: -14px; }
.al-float--b{ bottom: 16%; left: -24px; animation-delay: -3s; }
.al-float--c{ bottom: -22px; right: 7%; animation-delay: -5s; }
@media (max-width: 1060px){ .al-float--a{ right: 6px; } .al-float--b{ left: 6px; } .al-float--c{ right: 12px; } }
@media (max-width: 640px){ .al-float--b{ display: none; } .al-float--a{ top: -16px; } .al-float--c{ bottom: -14px; } }
.al-hero__scrollcue{ position: absolute; left: 50%; bottom: .75rem; transform: translateX(-50%); width: 24px; height: 38px;
  border-radius: 14px; border: 1px solid var(--al-line-strong); display: none; }
.al-hero__scrollcue::after{ content: ""; position: absolute; top: 7px; left: 50%; width: 3px; height: 7px; margin-left: -1.5px;
  border-radius: 2px; background: var(--al-muted); animation: al-scrollcue 2s ease-in-out infinite; }
@media (min-width: 1024px){ .al-hero__scrollcue{ display: block; } }

/* ── SYSTEM CANVAS ── */
.al-system{ position: relative; border-radius: 22px; overflow: hidden; border: 1px solid var(--al-line-strong);
  background: var(--al-glass-strong); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: var(--al-shadow-lg); }
.al-system::before{ content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
  background: linear-gradient(135deg, rgba(var(--al-primary-rgb), .55), transparent 38%, transparent 62%, rgba(var(--al-accent-rgb), .45));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude; }
.al-system__chrome{ display: flex; align-items: center; gap: .7rem; padding: .65rem 1rem; border-bottom: 1px solid var(--al-line); background: var(--al-raised); }
.al-system__dots{ display: flex; gap: 6px; }
.al-system__dots i{ width: 10px; height: 10px; border-radius: 50%; }
.al-system__url{ margin-inline: auto; display: flex; align-items: center; gap: .4rem; font-size: .74rem; color: var(--al-faint);
  background: var(--al-surface); border: 1px solid var(--al-line); padding: .3rem .95rem; border-radius: 999px; }
.al-system__live{ display: flex; align-items: center; gap: .4rem; font-size: .68rem; font-weight: 700; letter-spacing: .1em; color: var(--al-success); }
.al-system__body{ display: grid; grid-template-columns: 168px 1fr; min-height: 420px; text-align: left; }
.al-system__side{ border-right: 1px solid var(--al-line); padding: .9rem .7rem; display: flex; flex-direction: column; gap: .25rem;
  background: rgba(var(--al-text-rgb), .02); }
.al-system__sitem{ display: flex; align-items: center; gap: .6rem; padding: .5rem .7rem; border-radius: 10px; font-size: .82rem; font-weight: 550; color: var(--al-muted); }
.al-system__sitem.is-active{ color: rgb(var(--al-text-rgb)); background: rgba(var(--al-primary-rgb), .13); }
.al-system__sitem.is-active .al-icon{ color: var(--al-primary); }
.al-system__user{ margin-top: auto; display: flex; align-items: center; gap: .55rem; padding: .5rem .55rem; border-top: 1px solid var(--al-line);
  font-size: .78rem; font-weight: 600; color: var(--al-muted); }
.al-system__userdot{ width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: .6rem; font-weight: 700;
  color: #fff; background: var(--al-grad); }
.al-system__main{ padding: 1.1rem 1.2rem; display: grid; gap: .9rem; align-content: start; }
.al-system__kpis{ display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: .7rem; }
.al-kpi{ border: 1px solid var(--al-line); border-radius: 12px; padding: .7rem .8rem; background: var(--al-raised); display: grid; gap: .15rem; }
.al-kpi span{ font-size: .64rem; text-transform: uppercase; letter-spacing: .09em; color: var(--al-faint); font-weight: 700; }
.al-kpi strong{ font-size: 1.05rem; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.al-kpi em{ font-size: .66rem; font-style: normal; font-weight: 700; color: var(--al-success); }
.al-system__chart{ border: 1px solid var(--al-line); border-radius: 14px; background: var(--al-raised); padding: .85rem 1rem .5rem; }
.al-system__charthead{ display: flex; align-items: center; justify-content: space-between; font-size: .78rem; font-weight: 650; margin-bottom: .4rem; }
.al-range{ display: inline-flex; gap: 4px; }
.al-range i{ font-style: normal; font-size: .64rem; font-weight: 650; padding: .2rem .5rem; border-radius: 999px; color: var(--al-faint); }
.al-range i.is-on{ background: rgba(var(--al-primary-rgb), .13); color: var(--al-primary); }
.al-chart{ width: 100%; height: auto; display: block; }
.al-chart__line{ stroke-dasharray: 1; stroke-dashoffset: 1; }
[data-reveal].is-in .al-chart__line{ animation: al-draw 1.7s var(--al-ease) .35s forwards; }
.al-chart__area{ opacity: 0; }
[data-reveal].is-in .al-chart__area{ animation: al-fadein 1.2s var(--al-ease) .9s forwards; }
.al-system__feed{ border: 1px solid var(--al-line); border-radius: 14px; background: var(--al-raised); padding: .8rem 1rem .5rem; }
.al-feed__head{ display: flex; align-items: center; justify-content: space-between; font-size: .68rem; text-transform: uppercase;
  letter-spacing: .1em; color: var(--al-faint); font-weight: 700; margin-bottom: .3rem; }
.al-live{ display: inline-flex; align-items: center; gap: .4rem; }
.al-feed__row{ display: flex; align-items: center; gap: .6rem; padding: .48rem .1rem; border-top: 1px dashed var(--al-line);
  font-size: .8rem; color: var(--al-muted); animation: al-row-in .5s var(--al-ease) both; }
.al-feed__apps{ display: flex; align-items: center; gap: .3rem; color: var(--al-faint); }
.al-feed__text{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.al-feed__row time{ margin-left: auto; font-size: .68rem; color: var(--al-faint); flex: none; }
@media (max-width: 860px){ .al-system__body{ grid-template-columns: 1fr; } .al-system__side{ display: none; } }
@media (max-width: 560px){ .al-feed__row time{ display: none; } }
.al-apptile{ display: inline-grid; place-items: center; color: #fff; font-weight: 700; flex: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 4px 10px -4px rgba(0,0,0,.4); }

/* ── ABOUT SUMMARY ── */
.al-proof{ padding-top: clamp(2.5rem, 5vw, 4rem); }
.al-stats{ margin-top: clamp(2.5rem, 5vw, 4rem); border-block: 1px solid var(--al-line);
  background: linear-gradient(180deg, rgba(var(--al-primary-rgb), .045), transparent); }
.al-stats__grid{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--al-line); }
@media (max-width: 860px){ .al-stats__grid{ grid-template-columns: repeat(2, 1fr); } }
.al-stat{ background: rgb(var(--al-bg-rgb)); padding: clamp(1.6rem, 3vw, 2.4rem) 1rem; text-align: center; display: grid; gap: .35rem; }
.al-stat strong{ font-size: clamp(1.15rem, 2.2vw, 1.65rem); font-weight: 800; letter-spacing: -.035em; line-height: 1.12;
  background: linear-gradient(180deg, rgb(var(--al-text-rgb)), rgba(var(--al-text-rgb), .7));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.al-stat__label{ font-size: .8rem; color: var(--al-faint); }

/* ── MARQUEE ── */
.al-marquee{ overflow: hidden; padding-block: .35rem;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
.al-marquee__track{ display: flex; gap: 14px; width: max-content; animation: al-marquee var(--speed, 46s) linear infinite; }
.al-marquee--rev .al-marquee__track{ animation-direction: reverse; }
.al-marquee:hover .al-marquee__track{ animation-play-state: paused; }
.al-marquee__group{ display: flex; gap: 14px; align-items: center; }

/* ════════════════════════════════════════════════════════════════════════════
   PROJECTS — UNIFORM CARD GRID (no special featured layout)
   ════════════════════════════════════════════════════════════════════════════ */
.al-pfeature{ display: none; } /* disabled — all cards uniform */

.al-pgrid{ display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 310px), 1fr)); }
.al-pcard{ position: relative; display: flex; flex-direction: column; border-radius: var(--al-radius-lg); text-align: left;
  border: 1px solid var(--al-line); background: var(--al-glass); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  overflow: hidden; transition: transform var(--al-slow), box-shadow var(--al-slow), border-color var(--al-fast); }
.al-pcard::after{ content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0;
  transition: opacity var(--al-slow);
  background: radial-gradient(560px circle at var(--mx, 50%) var(--my, 0%), rgba(var(--al-primary-rgb), .12), transparent 42%); }
.al-pcard:hover{ transform: translateY(-4px); box-shadow: var(--al-shadow-lg); border-color: rgba(var(--al-primary-rgb), .32); }
.al-pcard:hover::after{ opacity: 1; }
.al-pcard__cover{ position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: var(--al-surface-2); }
.al-pcard__cover img{ width: 100%; height: 100%; object-fit: cover; transition: transform 1s var(--al-ease); }
.al-pcard:hover .al-pcard__cover img{ transform: scale(1.05); }
.al-pcard__cover--fallback{ display: grid; place-items: center;
  background: linear-gradient(135deg, rgba(var(--al-primary-rgb), .16), rgba(var(--al-accent-rgb), .1)); }
.al-pcard__glyph{ font-size: 3.2rem; font-weight: 800; letter-spacing: -.04em; line-height: 1;
  background: var(--al-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.al-pcard__body{ padding: 1.3rem; display: grid; gap: .8rem; flex: 1; align-content: start; }
.al-pcard__desc{ font-size: .93rem; line-height: 1.6; color: var(--al-muted); }
.al-pcard__chips{ display: flex; flex-wrap: wrap; gap: .4rem; }
.al-pcard__chips span{ font-size: .74rem; padding: .3rem .65rem; border-radius: 999px; border: 1px solid var(--al-line);
  background: var(--al-surface); color: var(--al-muted); }
.al-pcard__foot{ margin-top: auto; padding-top: .4rem; }

.al-pskel__feature{ height: 300px; margin-bottom: 16px; border-radius: var(--al-radius-xl); }
.al-pskel__grid{ display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.al-pskel__card{ height: 270px; border-radius: var(--al-radius-lg); }
.al-skel{ position: relative; overflow: hidden; background: var(--al-surface-2); border: 1px solid var(--al-line); }
.al-skel::after{ content: ""; position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(var(--al-text-rgb), .07) 50%, transparent 70%);
  background-size: 200% 100%; animation: al-shimmer 1.6s linear infinite; }
.al-pempty{ display: grid; justify-items: center; gap: .7rem; text-align: center; padding: 3.25rem 1.5rem;
  border: 1px dashed var(--al-line-strong); border-radius: var(--al-radius-lg); background: var(--al-surface); color: var(--al-muted); }
.al-pempty__icon{ width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center;
  color: var(--al-primary); background: rgba(var(--al-primary-rgb), .1); border: 1px solid rgba(var(--al-primary-rgb), .2); }
.al-pempty p{ font-size: .92rem; max-width: 42ch; }

/* ── BENTO FEATURES ── */
.al-bento{ display: grid; gap: 14px; grid-template-columns: repeat(3, 1fr); }
.al-bento__cell{ position: relative; overflow: hidden; border-radius: var(--al-radius-lg); text-align: left;
  border: 1px solid var(--al-line-strong); padding: 1.6rem; display: grid; gap: .85rem; align-content: start; min-height: 215px;
  background: linear-gradient(180deg, var(--al-glass-strong), var(--al-glass));
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  transition: transform var(--al-slow), box-shadow var(--al-slow), border-color var(--al-fast); }
.al-bento__cell::after{ content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0;
  transition: opacity var(--al-slow);
  background: radial-gradient(460px circle at var(--mx, 50%) var(--my, 50%), rgba(var(--al-primary-rgb), .1), transparent 45%); }
.al-bento__cell:hover{ transform: translateY(-3px); box-shadow: var(--al-shadow-lg); border-color: rgba(var(--al-primary-rgb), .3); }
.al-bento__cell:hover::after{ opacity: 1; }
.al-bento__cell--wide{ grid-column: span 2; }
@media (max-width: 960px){ .al-bento{ grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px){ .al-bento{ grid-template-columns: 1fr; } .al-bento__cell--wide{ grid-column: auto; } }
.al-bento__icon{ width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center; color: var(--al-primary);
  background: rgba(var(--al-primary-rgb), .09); border: 1px solid rgba(var(--al-primary-rgb), .18);
  transition: transform var(--al-fast), box-shadow var(--al-fast); }
.al-bento__cell:hover .al-bento__icon{ transform: translateY(-2px); box-shadow: 0 10px 24px -10px rgba(var(--al-primary-rgb), .6); }
.al-bento__title{ font-size: 1.08rem; font-weight: 700; letter-spacing: -.015em; }
.al-bento__desc{ font-size: .92rem; line-height: 1.6; color: var(--al-muted); }
.al-flowviz{ display: flex; align-items: center; gap: .6rem; margin-top: .5rem; }
.al-flowviz__node{ display: grid; justify-items: center; gap: .4rem; flex: none; }
.al-flowviz__node > span:last-child{ font-size: .7rem; font-weight: 650; color: var(--al-faint); }
.al-flowviz__core{ width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; color: #fff; background: var(--al-grad);
  box-shadow: 0 12px 26px -10px rgba(var(--al-primary-rgb), .7); }
.al-wire{ flex: 1; height: 2px; min-width: 36px; border-radius: 2px;
  background-image: linear-gradient(90deg, rgba(var(--al-primary-rgb), .55) 50%, transparent 0);
  background-size: 12px 2px; animation: al-wiremove 1.1s linear infinite; }
.al-pulse{ position: relative; width: 118px; height: 118px; margin: .75rem auto 0; display: grid; place-items: center; }
.al-pulse i{ position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(var(--al-primary-rgb), .5);
  animation: al-ping 2.6s var(--al-ease) infinite; }
.al-pulse i:nth-child(2){ animation-delay: .85s; }
.al-pulse i:nth-child(3){ animation-delay: 1.7s; }
.al-pulse__core{ width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; color: #fff; background: var(--al-grad);
  box-shadow: 0 12px 30px -10px rgba(var(--al-primary-rgb), .7); }
.al-bars{ display: flex; gap: 6px; align-items: flex-end; height: 72px; margin-top: .5rem; }
.al-bars i{ flex: 1; height: var(--h); border-radius: 6px 6px 3px 3px;
  background: linear-gradient(180deg, rgba(var(--al-primary-rgb), .85), rgba(var(--al-accent-rgb), .35));
  transform: scaleY(0); transform-origin: bottom; transition: transform .9s var(--al-ease) calc(var(--i) * 55ms); }
[data-reveal].is-in .al-bars i{ transform: scaleY(1); }
.al-code{ margin-top: .25rem; border-radius: 14px; border: 1px solid rgba(255,255,255,.09); background: #0B0E1C;
  color: #DFE4FF; font-family: var(--al-mono); font-size: .78rem; line-height: 1.75; padding: .9rem 1.05rem 1.05rem;
  box-shadow: var(--al-shadow); overflow-x: auto; }
.al-code__bar{ display: flex; align-items: center; gap: 6px; margin-bottom: .7rem; font-size: .68rem; color: #7C86AD; }
.al-code__bar i{ width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.al-code__bar b{ margin-left: .35rem; font-weight: 500; }
.tk-k{ color: #C792EA; } .tk-f{ color: #82AAFF; } .tk-s{ color: #C3E88D; }
.tk-c{ color: #5C6798; font-style: italic; } .tk-n{ color: #F78C6C; }
.al-upt{ display: grid; gap: .55rem; justify-items: start; margin-top: .5rem; }
.al-upt__num{ font-size: 2.6rem; font-weight: 800; letter-spacing: -.04em; line-height: 1;
  background: linear-gradient(120deg, rgb(var(--al-primary-rgb)), rgb(var(--al-accent-rgb)));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.al-upt__cap{ display: inline-flex; align-items: center; gap: .5rem; font-size: .8rem; color: var(--al-muted); }

/* ── STEPS ── */
.al-steps-wrap{ margin-top: clamp(3.5rem, 7vw, 5.5rem); }
.al-steps{ position: relative; display: grid; gap: 14px; grid-template-columns: repeat(3, 1fr); }
.al-steps::before{ content: ""; position: absolute; top: 40px; left: 12%; right: 12%; height: 2px;
  background: linear-gradient(90deg, rgba(var(--al-primary-rgb), .0), rgba(var(--al-primary-rgb), .5) 30%, rgba(var(--al-accent-rgb), .5) 70%, rgba(var(--al-accent-rgb), 0));
  transform: scaleX(0); transform-origin: left; transition: transform 1.4s var(--al-ease) .25s; }
.al-steps.is-in::before{ transform: scaleX(1); }
.al-step{ position: relative; border-radius: var(--al-radius-lg); border: 1px solid var(--al-line); background: var(--al-glass);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 1.5rem; padding-top: 2.1rem; text-align: left;
  display: grid; gap: .7rem; justify-items: start; }
.al-step__num{ position: absolute; top: -23px; left: 1.5rem; width: 46px; height: 46px; border-radius: 50%;
  display: grid; place-items: center; font-weight: 800; font-size: .95rem; color: #fff; background: var(--al-grad);
  border: 4px solid rgb(var(--al-bg-rgb)); box-shadow: 0 10px 24px -8px rgba(var(--al-primary-rgb), .6); }
.al-step p{ font-size: .92rem; line-height: 1.6; color: var(--al-muted); }
@media (max-width: 900px){ .al-steps{ grid-template-columns: 1fr; } .al-steps::before{ display: none; } .al-step{ margin-top: 23px; } }

/* ── TECHNOLOGY ── */
.al-int{ display: flex; align-items: center; gap: .65rem; padding: .5rem .95rem .5rem .55rem; border-radius: 999px;
  border: 1px solid var(--al-line); background: var(--al-glass); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  font-size: .87rem; font-weight: 600; color: var(--al-muted); white-space: nowrap; flex: none;
  transition: color var(--al-fast), border-color var(--al-fast), transform var(--al-fast), box-shadow var(--al-fast); }
.al-int:hover{ color: rgb(var(--al-text-rgb)); border-color: rgba(var(--al-primary-rgb), .4);
  transform: translateY(-2px); box-shadow: var(--al-shadow); }
.al-ints__stack{ display: grid; gap: 14px; margin-bottom: 2rem; }
.al-ints__more{ display: flex; justify-content: center; }

/* ── CTA PANEL ── */
.al-cta__panel{ position: relative; overflow: hidden; isolation: isolate; border-radius: 30px; text-align: center;
  padding: clamp(3rem, 7vw, 5.5rem) clamp(1.5rem, 5vw, 4.5rem); color: #fff;
  background: radial-gradient(120% 160% at 10% 0%, rgba(255,255,255,.22), transparent 42%),
    linear-gradient(120deg, rgb(var(--al-primary-rgb)), rgb(var(--al-secondary-rgb)) 55%, #0EA5B7 115%);
  box-shadow: 0 40px 100px -40px rgba(var(--al-primary-rgb), .7); }
.al-cta__panel::before{ content: ""; position: absolute; inset: 0; z-index: -1;
  background-image: linear-gradient(rgba(255,255,255,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.09) 1px, transparent 1px);
  background-size: 54px 54px;
  -webkit-mask-image: radial-gradient(ellipse at center, #000, transparent 75%);
  mask-image: radial-gradient(ellipse at center, #000, transparent 75%); }
.al-cta__orb{ position: absolute; width: 380px; height: 380px; border-radius: 50%; z-index: -1; filter: blur(30px);
  background: radial-gradient(circle, rgba(255,255,255,.35), transparent 65%); animation: al-float 9s ease-in-out infinite; }
.al-cta__orb--a{ top: -160px; right: -80px; }
.al-cta__orb--b{ bottom: -200px; left: -100px; animation-delay: -4s; }
.al-cta__inner{ display: grid; gap: 1.4rem; justify-items: center; max-width: 720px; margin-inline: auto; }
.al-cta__title{ font-size: clamp(2rem, 4.6vw, 3.4rem); letter-spacing: -.035em; line-height: 1.05; font-weight: 800; text-wrap: balance; }
.al-cta__title .al-serif-em{ background: linear-gradient(100deg, #fff, rgba(255,255,255,.75));
  -webkit-background-clip: text; background-clip: text; }
.al-cta__desc{ font-size: clamp(1rem, 1.4vw, 1.14rem); color: rgba(255,255,255,.86); max-width: 54ch; }
.al-cta__eyebrow{ color: rgba(255,255,255,.85); }
.al-cta__form{ display: flex; gap: .6rem; width: 100%; max-width: 520px; }
.al-cta__hint{ font-size: .8rem; color: rgba(255,255,255,.7); }
@media (max-width: 560px){ .al-cta__form{ flex-direction: column; } }

/* ── CONTACT ── */
.al-contact{ display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); }
.al-contact__card{ position: relative; display: grid; gap: .85rem; padding: 1.4rem; border-radius: var(--al-radius-lg); text-align: left;
  border: 1px solid var(--al-line); background: var(--al-glass); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  overflow: hidden; transition: transform var(--al-slow), border-color var(--al-fast), box-shadow var(--al-slow); }
.al-contact__card:hover{ transform: translateY(-3px); border-color: rgba(var(--al-primary-rgb), .35); box-shadow: var(--al-shadow); }
.al-contact__card--wide{ grid-column: 1 / -1; }
@media (min-width: 760px){ .al-contact__card--wide{ grid-column: span 2; } }
.al-contact__icon{ width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: var(--al-primary);
  background: rgba(var(--al-primary-rgb), .09); border: 1px solid rgba(var(--al-primary-rgb), .2); }
.al-contact__label{ font-size: .7rem; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; color: var(--al-faint); }
.al-contact__value{ font-weight: 600; letter-spacing: -.01em; line-height: 1.45; word-break: break-word; }
a.al-contact__value:hover{ color: var(--al-primary); }
.al-contact__arrow{ position: absolute; top: 1.15rem; right: 1.15rem; color: var(--al-faint); opacity: 0;
  transform: translate(-4px, 4px); transition: all var(--al-fast); }
.al-contact__card:hover .al-contact__arrow{ opacity: 1; transform: none; color: var(--al-primary); }
.al-notechip{ margin-top: 2rem; display: flex; justify-content: center; }

/* ── FOOTER ── */
.al-footer{ position: relative; margin-top: clamp(2rem, 5vw, 4rem); padding: clamp(3.5rem, 7vw, 6rem) 0 2.25rem;
  border-top: 1px solid var(--al-line); overflow: hidden;
  background: linear-gradient(180deg, transparent, rgba(var(--al-text-rgb), .03)); }
.al-footer::before{ content: ""; position: absolute; left: 50%; top: -1px; transform: translateX(-50%); width: 60%; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(var(--al-primary-rgb), .7), transparent); }
.al-footer__watermark{ position: absolute; right: -2%; bottom: -10%; font-size: clamp(5rem, 16vw, 14rem); font-weight: 800;
  letter-spacing: -.06em; line-height: 1; color: rgba(var(--al-text-rgb), .035); pointer-events: none; user-select: none; white-space: nowrap; }
.al-footer__grid{ position: relative; display: grid; gap: 3rem; }
@media (min-width: 900px){ .al-footer__grid{ grid-template-columns: minmax(0, 1.3fr) minmax(0, 2fr); gap: 4rem; } }
.al-footer__brand{ display: grid; gap: 1.15rem; align-content: start; max-width: 380px; }
.al-footer__cols{ display: grid; gap: 2rem; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.al-footer__col{ display: grid; gap: .75rem; align-content: start; }
.al-footer__col-title{ font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--al-faint); }
.al-footer__link{ display: inline-block; width: fit-content; font-size: .9rem; color: var(--al-muted);
  transition: color var(--al-fast), transform var(--al-fast); }
.al-footer__link:hover{ color: rgb(var(--al-text-rgb)); transform: translateX(3px); }
.al-footer__legal{ position: relative; margin-top: clamp(2.5rem, 5vw, 4rem); padding-top: 1.5rem; border-top: 1px solid var(--al-line);
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem 2rem; font-size: .8rem; color: var(--al-faint); }
.al-status{ display: inline-flex; align-items: center; gap: .5rem; padding: .45rem .95rem; border-radius: 999px;
  border: 1px solid var(--al-line); background: var(--al-surface); font-size: .78rem; font-weight: 600; color: var(--al-muted); }

/* ── REVEAL ── */
[data-reveal]{ opacity: 0; transform: translateY(24px) scale(.985); filter: blur(4px);
  transition: opacity .9s var(--al-ease), transform .9s var(--al-ease), filter .9s var(--al-ease);
  transition-delay: var(--d, 0ms); will-change: opacity, transform; }
[data-reveal].is-in{ opacity: 1; transform: none; filter: none; }

/* ── KEYFRAMES ── */
@keyframes al-rise{ from{ opacity: 0; transform: translateY(22px) scale(.98); filter: blur(4px); } to{ opacity: 1; transform: none; filter: none; } }
@keyframes al-fade{ from{ opacity: 0; } to{ opacity: 1; } }
@keyframes al-fadein{ to{ opacity: 1; } }
@keyframes al-float{ 0%, 100%{ transform: translateY(0); } 50%{ transform: translateY(-10px); } }
@keyframes al-word{ from{ opacity: 0; transform: translateY(10px); filter: blur(3px); } to{ opacity: 1; transform: none; filter: none; } }
@keyframes al-row-in{ from{ opacity: 0; transform: translateY(-8px); } to{ opacity: 1; transform: none; } }
@keyframes al-marquee{ to{ transform: translateX(-50%); } }
@keyframes al-draw{ to{ stroke-dashoffset: 0; } }
@keyframes al-dashmove{ to{ stroke-dashoffset: -260; } }
@keyframes al-wiremove{ to{ background-position: 24px 0; } }
@keyframes al-ping{ 0%{ transform: scale(.55); opacity: .85; } 100%{ transform: scale(1.75); opacity: 0; } }
@keyframes al-shimmer{ from{ background-position: -200% 0; } to{ background-position: 200% 0; } }
@keyframes al-scrollcue{ 0%{ transform: translateY(0); opacity: 1; } 100%{ transform: translateY(12px); opacity: 0; } }

@media (prefers-reduced-motion: reduce){
  html{ scroll-behavior: auto; }
  .al *, .al *::before, .al *::after{ animation: none !important; transition-duration: .01ms !important; }
  [data-reveal]{ opacity: 1; transform: none; filter: none; }
  .al-chart__line{ stroke-dashoffset: 0 !important; }
  .al-chart__area{ opacity: 1 !important; }
  .al-bars i{ transform: scaleY(1) !important; }
  .al-steps::before{ transform: scaleX(1) !important; }
}
`;

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC WEBSITE — Asanlink landing page
   ════════════════════════════════════════════════════════════════════════════ */
export default function PublicWebsite() {
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const progressRef = useRef(null);

  /* Projects — the only backend-driven public content */
  const [projects, setProjects] = useState([]);
  const [projectsState, setProjectsState] = useState("loading");

  const load = useCallback(async () => {
    try {
      const response = await publicWebsiteService.getProjects();
      setProjects(
        (Array.isArray(response) ? response : []).filter(
          (project) => project?.name,
        ),
      );
      setProjectsState("ready");
    } catch {
      setProjects([]);
      setProjectsState("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* SEO + fonts (hardcoded) */
  useEffect(() => {
    const previousTitle = document.title;
    const previousLanguage = document.documentElement.lang;
    document.title = "Asanlink — Seamless Connectivity";
    document.documentElement.lang = "en";
    const cleanups = [
      setMeta(
        "name",
        "description",
        "Asanlink builds connected software systems, business management platforms, web applications, and practical digital solutions.",
      ),
      setMeta("name", "theme-color", theme === "dark" ? "#05060C" : "#F7F8FC"),
      setMeta("property", "og:title", "Asanlink — Seamless Connectivity"),
      setMeta(
        "property",
        "og:description",
        "Connected software systems and practical digital solutions for businesses and organizations.",
      ),
      addLink("preconnect", "https://fonts.googleapis.com"),
      addLink("preconnect", "https://fonts.gstatic.com"),
      addLink(
        "stylesheet",
        "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Inter:wght@400;500;600;700;800&display=swap",
      ),
    ];
    return () => {
      document.title = previousTitle;
      document.documentElement.lang = previousLanguage;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [theme]);

  /* Scroll progress */
  useEffect(() => {
    const onScroll = () => {
      const el = progressRef.current;
      if (!el) return;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      el.style.width = `${max > 0 ? (doc.scrollTop / max) * 100 : 0}%`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Header scroll state */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Mobile nav */
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  /* Announcement */
  const [showAnnounce, setShowAnnounce] = useState(true);

  /* Scroll reveal + active section spy */
  const [activeId, setActiveId] = useState("");
  useEffect(() => {
    if (!rootRef.current) return undefined;
    const root = rootRef.current;
    const revealEls = Array.from(root.querySelectorAll("[data-reveal]"));
    const sectionEls = Array.from(root.querySelectorAll("main section[id]"));
    if (!("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-in"));
      return undefined;
    }
    const reveal = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            reveal.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    revealEls.forEach((el) => reveal.observe(el));
    const spy = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.2, 0.5] },
    );
    sectionEls.forEach((el) => spy.observe(el));
    return () => {
      reveal.disconnect();
      spy.disconnect();
    };
  }, [projectsState]);

  /* Hero spotlight */
  const heroSpot = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty(
      "--hx",
      `${((e.clientX - r.left) / r.width) * 100}%`,
    );
    e.currentTarget.style.setProperty(
      "--hy",
      `${((e.clientY - r.top) / r.height) * 100}%`,
    );
  };

  /* Uniform sorted projects (featured first, all same card layout) */
  const sortedProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    const featured = projects.filter((p) => p.is_featured);
    const rest = projects.filter((p) => !p.is_featured);
    return [...featured, ...rest];
  }, [projects]);

  const isActiveHref = (href = "") =>
    href.startsWith("#") && href.slice(1) === activeId;

  const projectUrlFor = (project) =>
    project.product_url || project.cta_url || "";
  const projectImageFor = (project) =>
    project.cover_image ||
    project.media_items?.find((item) => item?.asset?.url)?.asset ||
    null;

  const ProjectIdentity = ({ project }) => (
    <div className="al-ident">
      {project.logo?.url ? (
        <img
          className="al-ident__logo"
          src={resolveMediaUrl(project.logo.url)}
          alt={project.logo.alt_text || `${project.name} logo`}
        />
      ) : (
        <span className="al-ident__mark" aria-hidden="true">
          {project.name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="al-ident__meta">
        {project.category?.name && (
          <span className="al-tag">{project.category.name}</span>
        )}
        <span className="al-ident__name">{project.name}</span>
      </div>
    </div>
  );

  /* ── PROJECT RENDERERS (uniform cards) ── */
  const renderProjects = () => (
    <section className="al-section al-section--tint" id="projects">
      <div className="al-container">
        <Heading
          split
          eyebrow="Projects"
          title={
            <>
              Explore Asanlink&apos;s{" "}
              <em className="al-serif-em">software systems.</em>
            </>
          }
          // lead="Published project information comes directly from Asanlink's project records."
        />

        {projectsState === "loading" && (
          <div aria-label="Loading projects" role="status">
            <div className="al-pskel__feature al-skel" />
            <div className="al-pskel__grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="al-pskel__card al-skel" />
              ))}
            </div>
          </div>
        )}

        {projectsState === "error" && (
          <div className="al-pempty" data-reveal>
            <span className="al-pempty__icon">
              <Icon name="refresh" size={22} />
            </span>
            <h3 className="al-h3">Projects are temporarily unavailable</h3>
            <p>The rest of the Asanlink website remains available.</p>
            <button
              type="button"
              className="al-btn al-btn--ghost al-btn--sm"
              onClick={() => {
                setProjectsState("loading");
                load();
              }}
            >
              Retry <Icon name="refresh" size={14} />
            </button>
          </div>
        )}

        {projectsState === "ready" && sortedProjects.length === 0 && (
          <div className="al-pempty" data-reveal>
            <span className="al-pempty__icon">
              <Icon name="grid" size={22} />
            </span>
            <h3 className="al-h3">No public projects yet</h3>
            <p>Published Asanlink projects will appear here.</p>
          </div>
        )}

        {projectsState === "ready" && sortedProjects.length > 0 && (
          <div className="al-pgrid">
            {sortedProjects.map((project, i) => (
              <article
                className="al-pcard"
                key={project.id || i}
                data-reveal
                style={{ "--d": `${(i % 3) * 80}ms` }}
                onPointerMove={trackPointer}
              >
                {projectImageFor(project)?.url ? (
                  <div className="al-pcard__cover">
                    <img
                      src={resolveMediaUrl(projectImageFor(project).url)}
                      alt={projectImageFor(project).alt_text || project.name}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="al-pcard__cover al-pcard__cover--fallback">
                    <span className="al-pcard__glyph" aria-hidden="true">
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="al-pcard__body">
                  <ProjectIdentity project={project} />
                  {project.short_description && (
                    <p className="al-pcard__desc">
                      {project.short_description}
                    </p>
                  )}
                  {project.features?.length > 0 && (
                    <div className="al-pcard__chips">
                      {project.features.slice(0, 4).map((f) => (
                        <span key={f.id}>{f.title}</span>
                      ))}
                    </div>
                  )}
                  {projectUrlFor(project) && (
                    <div className="al-pcard__foot">
                      <a
                        className="al-textlink"
                        href={projectUrlFor(project)}
                        target={
                          isExternal(projectUrlFor(project))
                            ? "_blank"
                            : undefined
                        }
                        rel={relFor(projectUrlFor(project))}
                      >
                        {project.product_url
                          ? "Visit project"
                          : project.cta_label || "Learn more"}
                        <Icon name="arrowUpRight" size={15} />
                      </a>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  /* ── RENDER ── */
  return (
    <div className="al" data-theme={theme} ref={rootRef}>
      <style>{STYLES}</style>

      {/* ATMOSPHERE */}
      <div className="al__atmos" aria-hidden="true">
        <div className="al__grid" />
        <div className="al__orb al__orb--a" />
        <div className="al__orb al__orb--b" />
        <div className="al__orb al__orb--c" />
        <div className="al__grain" />
      </div>

      <div className="al-progress" ref={progressRef} aria-hidden="true" />

      <div className="al-shell">
        {/* ANNOUNCEMENT */}
        {showAnnounce && (
          <div className="al-announce">
            <span>
              <strong>Asanlink</strong> — seamless connectivity for practical
              software systems
            </span>
            <a className="al-announce__link" href="#projects">
              Explore projects <Icon name="arrow" size={13} />
            </a>
            <button
              type="button"
              className="al-announce__close"
              aria-label="Dismiss announcement"
              onClick={() => setShowAnnounce(false)}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {/* HEADER */}
        <header className={`al-header ${scrolled ? "is-scrolled" : ""}`}>
          <div className="al-container">
            <div className="al-header__bar">
              <Brand />
              <nav className="al-nav" aria-label="Primary">
                <ul>
                  {NAV_LINKS.map((link) => (
                    <li key={link.href}>
                      <a
                        className={isActiveHref(link.href) ? "is-active" : ""}
                        href={link.href}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="al-header__right">
                <ThemeToggle />
                <a
                  className="al-btn al-btn--ghost al-btn--sm al-header__signin"
                  href="/login"
                >
                  Sign in
                </a>
                <a
                  className="al-btn al-btn--primary al-btn--sm"
                  href="#contact"
                >
                  Contact
                </a>
                <button
                  type="button"
                  className="al-burger"
                  aria-label="Open menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(true)}
                >
                  <Icon name="menu" size={20} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* MOBILE NAV */}
        {menuOpen && (
          <div
            className="al-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="al-mobile__top">
              <Brand />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <ThemeToggle />
                <button
                  type="button"
                  className="al-burger"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  autoFocus
                >
                  <Icon name="close" size={20} />
                </button>
              </div>
            </div>
            <div className="al-mobile__body">
              <nav aria-label="Primary">
                <ul className="al-mobile__list">
                  {NAV_LINKS.map((link, i) => (
                    <li key={link.href}>
                      <a
                        className="al-mobile__link"
                        style={{ "--i": i }}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                      >
                        {link.label}
                        <Icon name="arrowUpRight" size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div
                className="al-mobile__actions"
                onClick={() => setMenuOpen(false)}
              >
                <a className="al-btn al-btn--ghost" href="/login">
                  Sign in
                </a>
                <a className="al-btn al-btn--primary" href="#contact">
                  Contact <Icon name="arrow" size={16} />
                </a>
              </div>
            </div>
          </div>
        )}

        <main id="main">
          {/* ── HERO ── */}
          <section className="al-hero" id="top" onPointerMove={heroSpot}>
            <div className="al-container">
              <div className="al-hero__copy">
                <SloganBadge />
                <h1 className="al-hero__title">
                  Business software,{" "}
                  <em className="al-serif-em">seamlessly connected.</em>
                </h1>
                <p className="al-lead al-hero__lead">
                  Asanlink builds practical software systems and digital
                  solutions that help businesses and organizations manage work
                  through clear, connected platforms.
                </p>
                <div className="al-hero__proof">
                  <span className="al-chip">Business management systems</span>
                  <span className="al-chip">Web applications</span>
                  <span className="al-chip">API integration</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: ".75rem",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  <a
                    className="al-btn al-btn--primary al-btn--lg"
                    href="#projects"
                  >
                    Explore projects <Icon name="arrow" size={17} />
                  </a>
                  <a className="al-btn al-btn--ghost al-btn--lg" href="#about">
                    About Asanlink <Icon name="arrow" size={16} />
                  </a>
                </div>
                <p className="al-hero__micro">
                  Software systems · Digital solutions · Seamless connectivity
                </p>
              </div>

              {/* Hero visual — decorative connected-system architecture */}
              <div className="al-hero__stage" data-reveal aria-hidden="true">
                <div className="al-stage__glow" />
                <svg className="al-stage__rings" viewBox="0 0 900 500">
                  <ellipse cx="450" cy="250" rx="430" ry="225" />
                  <ellipse
                    cx="450"
                    cy="250"
                    rx="330"
                    ry="168"
                    strokeDasharray="3 10"
                  />
                </svg>

                <SystemCanvas />

                <div className="al-float al-float--a">
                  <Icon name="swap" size={20} />
                  <span>
                    <small>Architecture</small>
                    <strong>API-driven systems</strong>
                  </span>
                </div>
                <div className="al-float al-float--b">
                  <Icon name="workflow" size={20} />
                  <span>
                    <small>Purpose</small>
                    <strong>Business-focused software</strong>
                  </span>
                </div>
                <div className="al-float al-float--c">
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      background: "linear-gradient(135deg,#10B981,#059669)",
                    }}
                  >
                    <Icon name="check" size={15} />
                  </span>
                  <span>
                    <small>Approach</small>
                    <strong>Built to connect</strong>
                  </span>
                </div>
              </div>
            </div>
            <span className="al-hero__scrollcue" aria-hidden="true" />
          </section>

          {/* ── ABOUT ── */}
          <section className="al-proof" id="about">
            <div className="al-container">
              <Heading
                eyebrow="About Asanlink"
                title={
                  <>
                    Connected software for{" "}
                    <em className="al-serif-em">real operations.</em>
                  </>
                }
                lead="Asanlink is a technology and software company focused on connected systems, business management platforms, and practical digital solutions."
              />
            </div>
            <div className="al-stats">
              <div className="al-container">
                <div className="al-stats__grid">
                  {CAPABILITY_SUMMARY.map((item, i) => (
                    <CapabilitySummary
                      key={item.title}
                      {...item}
                      delay={i * 90}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── PROJECTS (DYNAMIC — uniform card grid) ── */}
          {renderProjects()}

          {/* ── CAPABILITIES (bento + process) ── */}
          <section className="al-section" id="capabilities">
            <div className="al-container">
              <Heading
                eyebrow="Capabilities"
                title={
                  <>
                    Software shaped around{" "}
                    <em className="al-serif-em">real operations.</em>
                  </>
                }
                lead="Asanlink builds web applications, business management systems, custom software, and the APIs that connect them."
              />

              <div className="al-bento">
                {/* Custom software solutions */}
                <article
                  className="al-bento__cell al-bento__cell--wide"
                  data-reveal
                  onPointerMove={trackPointer}
                >
                  <span className="al-bento__icon">
                    <Icon name="workflow" size={21} />
                  </span>
                  <h3 className="al-bento__title">Custom software solutions</h3>
                  <p className="al-bento__desc">
                    Purpose-built applications and business systems designed
                    around clear requirements and practical workflows.
                  </p>
                  <div className="al-flowviz" aria-hidden="true">
                    <div className="al-flowviz__node">
                      <AppTile name="React" size={40} />
                      <span>Interface</span>
                    </div>
                    <span className="al-wire" />
                    <div className="al-flowviz__node">
                      <span className="al-flowviz__core">
                        <Icon name="link" size={20} />
                      </span>
                      <span>Asanlink</span>
                    </div>
                    <span className="al-wire" />
                    <div className="al-flowviz__node">
                      <AppTile name="Django" size={40} />
                      <span>Services</span>
                    </div>
                  </div>
                </article>

                {/* Business management systems */}
                <article
                  className="al-bento__cell"
                  data-reveal
                  style={{ "--d": "80ms" }}
                  onPointerMove={trackPointer}
                >
                  <span className="al-bento__icon">
                    <Icon name="bolt" size={21} />
                  </span>
                  <h3 className="al-bento__title">
                    Business management systems
                  </h3>
                  <p className="al-bento__desc">
                    Coherent platforms for organizing operational workflows,
                    records, and the work people manage every day.
                  </p>
                  <div className="al-pulse" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <span className="al-pulse__core">
                      <Icon name="infinity" size={22} />
                    </span>
                  </div>
                  <div className="al-chiprow">
                    <span className="al-chip">Practical workflows</span>
                    <span className="al-chip">Clear interfaces</span>
                  </div>
                </article>

                {/* Web applications */}
                <article
                  className="al-bento__cell"
                  data-reveal
                  onPointerMove={trackPointer}
                >
                  <span className="al-bento__icon">
                    <Icon name="chart" size={21} />
                  </span>
                  <h3 className="al-bento__title">Web applications</h3>
                  <p className="al-bento__desc">
                    Responsive interfaces that make complex business processes
                    easier to understand and manage.
                  </p>
                  <div className="al-bars" aria-hidden="true">
                    {[42, 68, 50, 84, 60, 92, 72, 55, 88, 64, 96, 78].map(
                      (h, i) => (
                        <i key={i} style={{ "--h": `${h}%`, "--i": i }} />
                      ),
                    )}
                  </div>
                  <div className="al-chiprow">
                    <span className="al-chip">
                      <Icon name="globe" size={12} /> Responsive experiences
                    </span>
                  </div>
                </article>

                {/* API integration */}
                <article
                  className="al-bento__cell al-bento__cell--wide"
                  data-reveal
                  style={{ "--d": "80ms" }}
                  onPointerMove={trackPointer}
                >
                  <span className="al-bento__icon">
                    <Icon name="code" size={21} />
                  </span>
                  <h3 className="al-bento__title">API-driven integration</h3>
                  <p className="al-bento__desc">
                    REST APIs connect interfaces to business data through
                    explicit, maintainable application boundaries.
                  </p>
                  <pre className="al-code">
                    <span className="al-code__bar">
                      <i style={{ background: "#FF5F57" }} />
                      <i style={{ background: "#FEBC2E" }} />
                      <i style={{ background: "#28C840" }} />
                      <b>projects.js</b>
                    </span>
                    <code>
                      <span className="tk-c">
                        {"// Public project records from the Asanlink backend"}
                      </span>
                      {"\n"}
                      <span className="tk-k">const</span>
                      {" response = "}
                      <span className="tk-k">await</span>{" "}
                      <span className="tk-f">fetch</span>({"\n  "}
                      <span className="tk-s">
                        &quot;/api/public/v1/products/&quot;
                      </span>
                      {",\n"});{"\n\n"}
                      <span className="tk-k">const</span>
                      {" projects = "}
                      <span className="tk-k">await</span>
                      {" response."}
                      <span className="tk-f">json</span>();
                    </code>
                  </pre>
                </article>

                {/* Security */}
                <article
                  className="al-bento__cell"
                  data-reveal
                  onPointerMove={trackPointer}
                >
                  <span className="al-bento__icon">
                    <Icon name="shield" size={21} />
                  </span>
                  <h3 className="al-bento__title">
                    Secure application foundations
                  </h3>
                  <p className="al-bento__desc">
                    Authentication, role-based permissions, validation, and
                    careful data handling support the systems that need them.
                  </p>
                  <div className="al-chiprow">
                    <span className="al-chip">
                      <Icon name="shield" size={12} /> Authentication
                    </span>
                    <span className="al-chip">Role-based access</span>
                    <span className="al-chip">Data validation</span>
                  </div>
                </article>

                {/* Maintainable architecture */}
                <article
                  className="al-bento__cell"
                  data-reveal
                  style={{ "--d": "80ms" }}
                  onPointerMove={trackPointer}
                >
                  <span className="al-bento__icon">
                    <Icon name="code" size={21} />
                  </span>
                  <h3 className="al-bento__title">
                    Maintainable web architecture
                  </h3>
                  <p className="al-bento__desc">
                    React interfaces, Django services, and REST APIs create
                    clear boundaries between each part of a system.
                  </p>
                  <div className="al-chiprow">
                    <span className="al-chip al-chip--mono">
                      React ↔ REST API ↔ Django
                    </span>
                  </div>
                </article>

                {/* Scalable platforms */}
                <article
                  className="al-bento__cell"
                  data-reveal
                  style={{ "--d": "160ms" }}
                  onPointerMove={trackPointer}
                >
                  <span className="al-bento__icon">
                    <Icon name="globe" size={21} />
                  </span>
                  <h3 className="al-bento__title">Designed to evolve</h3>
                  <div className="al-upt">
                    <span className="al-upt__num">Scalable</span>
                    <span className="al-upt__cap">
                      <Icon name="layers" size={12} />
                      modular foundations for growing systems
                    </span>
                  </div>
                </article>
              </div>

              {/* Process */}
              <div className="al-steps-wrap">
                <Heading
                  eyebrow="How we build"
                  title={
                    <>
                      From real needs to{" "}
                      <em className="al-serif-em">connected software.</em>
                    </>
                  }
                  lead="A clear path from understanding the workflow to delivering a practical, maintainable system."
                />
                <div className="al-steps" data-reveal>
                  <article className="al-step">
                    <span className="al-step__num">01</span>
                    <span className="al-bento__icon">
                      <Icon name="plug" size={20} />
                    </span>
                    <h3 className="al-bento__title">Understand</h3>
                    <p>
                      Define the business workflow, the people it serves, and
                      the information the system must manage.
                    </p>
                  </article>
                  <article className="al-step">
                    <span className="al-step__num">02</span>
                    <span className="al-bento__icon">
                      <Icon name="layers" size={20} />
                    </span>
                    <h3 className="al-bento__title">Build</h3>
                    <p>
                      Shape the interface, backend, and API around those
                      requirements with clear technical boundaries.
                    </p>
                  </article>
                  <article className="al-step">
                    <span className="al-step__num">03</span>
                    <span className="al-bento__icon">
                      <Icon name="bolt" size={20} />
                    </span>
                    <h3 className="al-bento__title">Connect</h3>
                    <p>
                      Bring the parts together into a coherent digital system
                      that supports day-to-day work.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </section>

          {/* ── TECHNOLOGY ── */}
          <section className="al-section al-section--tint" id="technology">
            <div className="al-container">
              <Heading
                split
                eyebrow="Technology"
                title={
                  <>
                    A modern stack for{" "}
                    <em className="al-serif-em">connected systems.</em>
                  </>
                }
                lead="Technologies used in Asanlink's current software include modern React interfaces, Django services, Python, and REST APIs."
              />
              <div className="al-ints__stack" data-reveal>
                <Marquee duration={46}>
                  {TECHNOLOGIES_A.map((name) => (
                    <span className="al-int" key={name}>
                      <AppTile name={name} size={28} />
                      {name}
                    </span>
                  ))}
                </Marquee>
                <Marquee duration={56} reverse>
                  {TECHNOLOGIES_B.map((name) => (
                    <span className="al-int" key={name}>
                      <AppTile name={name} size={28} />
                      {name}
                    </span>
                  ))}
                </Marquee>
              </div>
              <div className="al-ints__more" data-reveal>
                <a className="al-textlink" href="#projects">
                  Explore the systems built with this stack
                  <Icon name="arrow" size={15} />
                </a>
              </div>
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="al-section" id="work-with-us">
            <div className="al-container">
              <div className="al-cta__panel" data-reveal>
                <span
                  className="al-cta__orb al-cta__orb--a"
                  aria-hidden="true"
                />
                <span
                  className="al-cta__orb al-cta__orb--b"
                  aria-hidden="true"
                />
                <div className="al-cta__inner">
                  <span className="al-eyebrow al-cta__eyebrow">
                    Build with Asanlink
                  </span>
                  <h2 className="al-cta__title">
                    Have a system that should{" "}
                    <em className="al-serif-em">work better?</em>
                  </h2>
                  <p className="al-cta__desc">
                    Talk with Asanlink about a business workflow, a custom
                    software system, or a connection between applications.
                  </p>
                  <div
                    className="al-cta__form"
                    style={{ justifyContent: "center" }}
                  >
                    <a
                      className="al-btn al-btn--inverse al-btn--lg"
                      href="mailto:asanlinktech@gmail.com"
                    >
                      Email Asanlink <Icon name="send" size={15} />
                    </a>
                  </div>
                  <p className="al-cta__hint">seamless connectivity</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── CONTACT ── */}
          <section className="al-section" id="contact">
            <div className="al-container">
              <Heading
                eyebrow="Contact"
                title={
                  <>
                    Connect with <em className="al-serif-em">Asanlink.</em>
                  </>
                }
                lead="For project questions, custom software discussions, or support, use the confirmed contact details below."
              />
              <div className="al-contact">
                {CONTACT_ITEMS.map((item, i) => {
                  const Wrapper = item.href ? "a" : "div";
                  const external = item.href && isExternal(item.href);
                  return (
                    <article
                      className={`al-contact__card ${item.wide ? "al-contact__card--wide" : ""}`}
                      key={`${item.label}-${i}`}
                      data-reveal
                      style={{ "--d": `${(i % 3) * 70}ms` }}
                    >
                      {item.href && (
                        <Icon
                          className="al-contact__arrow"
                          name="arrowUpRight"
                          size={16}
                        />
                      )}
                      <span className="al-contact__icon" aria-hidden="true">
                        <Icon name={item.icon} size={19} />
                      </span>
                      <span style={{ display: "grid", gap: ".25rem" }}>
                        <span className="al-contact__label">{item.label}</span>
                        <Wrapper
                          className="al-contact__value"
                          href={item.href || undefined}
                          target={external ? "_blank" : undefined}
                          rel={external ? "noreferrer" : undefined}
                        >
                          {item.value}
                        </Wrapper>
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        {/* ── FOOTER ── */}
        <footer className="al-footer">
          <span className="al-footer__watermark" aria-hidden="true">
            ASANLINK
          </span>
          <div className="al-container al-footer__grid">
            <div className="al-footer__brand">
              <Brand />
              <p className="al-pcard__desc">
                Connected software systems and practical digital solutions for
                businesses and organizations.
              </p>
            </div>
            <nav className="al-footer__cols" aria-label="Footer">
              {FOOTER_COLUMNS.map((col) => (
                <div className="al-footer__col" key={col.title}>
                  <span className="al-footer__col-title">{col.title}</span>
                  <ul className="al-footer__col">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <a className="al-footer__link" href={link.href}>
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
          <div className="al-container al-footer__legal">
            <span>
              © {new Date().getFullYear()} Asanlink. All rights reserved.
            </span>
            <span className="al-status">
              <Icon name="link" size={13} />
              seamless connectivity
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
