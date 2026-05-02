// Shared atoms for TriageWolf UI
const { useState, useEffect, useRef, useMemo } = React;

// Wolf wordmark / logo
const Wordmark = ({ size = 22, subtitle = true }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <svg width={size + 4} height={size + 4} viewBox="0 0 32 32" fill="none">
      <path
        d="M3 9l4-4 3 3h12l3-3 4 4-1 5-3 1.5v3l-3 5h-4l-1.5-2h-5L10 23H6l-3-5v-3L1 14z"
        transform="translate(1 0)"
        fill="var(--tw-maroon)"
      />
      <circle cx="13" cy="14" r="1.1" fill="#fff" />
      <circle cx="20" cy="14" r="1.1" fill="#fff" />
      <path d="M15 18h3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
    <div style={{ lineHeight: 1.05 }}>
      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em" }}>
        Triage<span style={{ color: "var(--tw-maroon)" }}>Wolf</span>
      </div>
      {subtitle && (
        <div style={{ fontSize: 10.5, color: "var(--tw-ink-4)", letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 1 }}>
          Brampton Care Navigator
        </div>
      )}
    </div>
  </div>
);

// CTAS chip — semantic color for severity level
const CTASChip = ({ level, size = "sm" }) => {
  const meta = {
    1: { label: "CTAS 1 · Resuscitation", color: "var(--tw-ctas1)" },
    2: { label: "CTAS 2 · Emergent", color: "var(--tw-ctas2)" },
    3: { label: "CTAS 3 · Urgent", color: "var(--tw-ctas3)" },
    4: { label: "CTAS 4 · Less urgent", color: "var(--tw-ctas4)" },
    5: { label: "CTAS 5 · Non-urgent", color: "var(--tw-ctas5)" },
  }[level] || { label: `CTAS ${level}`, color: "var(--tw-ink-3)" };
  const padY = size === "lg" ? 6 : 3;
  const padX = size === "lg" ? 12 : 8;
  const fs = size === "lg" ? 12 : 10.5;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: `${padY}px ${padX}px`,
        borderRadius: 999,
        background: meta.color,
        color: "white",
        fontSize: fs, fontWeight: 600,
        letterSpacing: "0.04em", textTransform: "uppercase",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.7)" }} />
      {meta.label}
    </span>
  );
};

// Section label — small uppercase
const SectionLabel = ({ children, accent, count }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", color: accent || "var(--tw-ink-3)",
    }}>
      {children}
    </span>
    <span style={{ flex: 1, height: 1, background: "var(--tw-line)" }} />
    {count != null && (
      <span className="mono" style={{ fontSize: 10.5, color: "var(--tw-ink-4)" }}>
        {String(count).padStart(2, "0")}
      </span>
    )}
  </div>
);

// Symptom pill — toggleable
const SymptomPill = ({ symptom, checked, onToggle, tone = "neutral" }) => {
  const toneMap = {
    critical: { dot: "var(--tw-ctas1)", checkBg: "#fdecec", checkBorder: "var(--tw-ctas2)" },
    urgent: { dot: "var(--tw-ctas3)", checkBg: "#fcefdc", checkBorder: "var(--tw-ctas3)" },
    moderate: { dot: "#a86c1a", checkBg: "#fbf3df", checkBorder: "#c89337" },
    mild: { dot: "var(--tw-ctas5)", checkBg: "#e6f3eb", checkBorder: "var(--tw-ctas5)" },
    signal: { dot: "var(--tw-maroon)", checkBg: "var(--tw-maroon-tint)", checkBorder: "var(--tw-maroon)" },
    neutral: { dot: "var(--tw-ink-4)", checkBg: "#f0ebe6", checkBorder: "var(--tw-ink-3)" },
  };
  const t = toneMap[tone] || toneMap.neutral;
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "10px 12px",
        background: checked ? t.checkBg : "var(--tw-card)",
        border: `1px solid ${checked ? t.checkBorder : "var(--tw-line)"}`,
        borderRadius: 10,
        textAlign: "left", width: "100%",
        transition: "all 0.12s ease",
        boxShadow: checked ? "0 0 0 2px rgba(110,22,34,0.06)" : "none",
      }}
    >
      <span style={{
        width: 16, height: 16, borderRadius: 4,
        border: `1.5px solid ${checked ? t.checkBorder : "var(--tw-ink-5)"}`,
        background: checked ? t.checkBorder : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-11" />
          </svg>
        )}
      </span>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: t.dot, flexShrink: 0,
      }} />
      <span style={{ fontSize: 13.5, color: checked ? "var(--tw-ink)" : "var(--tw-ink-2)", fontWeight: checked ? 500 : 400 }}>
        {symptom}
      </span>
    </button>
  );
};

// Soft input
const Field = ({ label, hint, children }) => (
  <label style={{ display: "block" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tw-ink-3)" }}>
        {label}
      </span>
      {hint && <span style={{ fontSize: 11, color: "var(--tw-ink-4)" }}>{hint}</span>}
    </div>
    {children}
  </label>
);

const TextInput = React.forwardRef(({ value, onChange, placeholder, mono, ...rest }, ref) => (
  <input
    ref={ref}
    value={value}
    onChange={(e) => onChange?.(e.target.value)}
    placeholder={placeholder}
    className={mono ? "mono" : ""}
    style={{
      width: "100%",
      padding: "11px 13px",
      background: "var(--tw-card)",
      border: "1px solid var(--tw-line)",
      borderRadius: 8,
      fontSize: 14, color: "var(--tw-ink)",
      outline: "none",
      transition: "border-color 0.12s, box-shadow 0.12s",
    }}
    onFocus={(e) => { e.target.style.borderColor = "var(--tw-clay)"; e.target.style.boxShadow = "0 0 0 3px rgba(200,74,37,0.12)"; }}
    onBlur={(e) => { e.target.style.borderColor = "var(--tw-line)"; e.target.style.boxShadow = "none"; }}
    {...rest}
  />
));

// Primary button
const Button = ({ children, onClick, variant = "primary", size = "md", icon, iconAfter, disabled, full }) => {
  const sizes = {
    sm: { py: 8, px: 14, fs: 13 },
    md: { py: 12, px: 18, fs: 14 },
    lg: { py: 16, px: 24, fs: 15 },
  }[size];
  const variants = {
    primary: {
      background: "var(--tw-ink)", color: "white",
      hoverBg: "#1f1a17",
      boxShadow: "0 1px 0 rgba(255,255,255,0.05) inset, 0 4px 14px rgba(20,14,10,0.18)",
    },
    danger: {
      background: "var(--tw-maroon)", color: "white",
      hoverBg: "var(--tw-maroon-ink)",
      boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset, 0 4px 14px rgba(110,22,34,0.25)",
    },
    accent: {
      background: "var(--tw-clay)", color: "white",
      hoverBg: "#a83d1c",
      boxShadow: "0 1px 0 rgba(255,255,255,0.1) inset, 0 4px 14px rgba(200,74,37,0.25)",
    },
    ghost: {
      background: "transparent", color: "var(--tw-ink-2)",
      hoverBg: "var(--tw-line-2)",
      boxShadow: "none",
    },
    outline: {
      background: "var(--tw-card)", color: "var(--tw-ink)",
      hoverBg: "var(--tw-paper-2)",
      boxShadow: "inset 0 0 0 1px var(--tw-line)",
    },
  }[variant];

  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: `${sizes.py}px ${sizes.px}px`,
        background: hover && !disabled ? variants.hoverBg : variants.background,
        color: variants.color,
        fontSize: sizes.fs, fontWeight: 600,
        borderRadius: 8,
        boxShadow: variants.boxShadow,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.12s, transform 0.08s",
        transform: hover && !disabled ? "translateY(-0.5px)" : "none",
        width: full ? "100%" : "auto",
        letterSpacing: "-0.005em",
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={16} />}
    </button>
  );
};

// Wait-time chip — color-coded
const WaitChip = ({ minutes, large }) => {
  const tone = minutes >= 180 ? "var(--tw-ctas1)" : minutes >= 90 ? "var(--tw-ctas3)" : minutes >= 30 ? "var(--tw-ctas4)" : "var(--tw-ctas5)";
  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "baseline", gap: 4,
      color: tone,
      fontSize: large ? 28 : 14,
      fontWeight: 600,
      letterSpacing: "-0.02em",
    }}>
      {minutes}
      <span style={{ fontSize: large ? 12 : 10, fontWeight: 500, color: "var(--tw-ink-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>min</span>
    </span>
  );
};

// Capacity bar (queue / clinicians)
const CapacityBar = ({ value, max, label, accent }) => {
  const pct = Math.min(100, (value / max) * 100);
  const tone = pct >= 85 ? "var(--tw-ctas2)" : pct >= 60 ? "var(--tw-ctas3)" : "var(--tw-ctas5)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--tw-ink-4)", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        <span>{label}</span>
        <span className="mono">{value}/{max}</span>
      </div>
      <div style={{ height: 4, background: "var(--tw-line-2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: accent || tone, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
};

// Live ticker dot
const LiveDot = () => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--tw-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
    <span style={{
      width: 6, height: 6, borderRadius: "50%", background: "var(--tw-ctas5)",
      boxShadow: "0 0 0 3px rgba(47,122,85,0.18)",
      animation: "twPulse 1.6s ease-in-out infinite",
    }} />
    Live
    <style>{`@keyframes twPulse { 0%,100%{opacity:1;} 50%{opacity:0.55;} }`}</style>
  </span>
);

// Surge banner
const SurgeBanner = ({ scenario }) => {
  if (!scenario) return null;
  const meta = {
    condition_x: { label: "Condition X · Brampton ER capacity exceeded", tint: "linear-gradient(90deg, #6e1622, #8b1018)", iconName: "alert" },
    heatwave: { label: "Heatwave protocol active · prioritizing AC-equipped facilities", tint: "linear-gradient(90deg, #b8550f, #d97706)", iconName: "thermometer" },
    cyberattack: { label: "Cyber incident · running on offline triage protocols", tint: "linear-gradient(90deg, #2a2522, #5b524d)", iconName: "shield" },
  }[scenario];
  if (!meta) return null;
  return (
    <div style={{
      background: meta.tint, color: "white",
      padding: "10px 22px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      fontSize: 13, fontWeight: 500, letterSpacing: "-0.005em",
    }}>
      <Icon name={meta.iconName} size={15} />
      <span>{meta.label}</span>
      <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 8px", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 999, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        Surge
      </span>
    </div>
  );
};

// Container shell with header
const TWHeader = ({ active = "triage", onNav, scenario, dense }) => {
  const items = [
    { id: "triage", label: "Triage" },
    { id: "results", label: "Care plan" },
    { id: "dashboard", label: "Operations" },
    { id: "impact", label: "Impact" },
  ];
  return (
    <header style={{
      borderBottom: "1px solid var(--tw-line)",
      background: "var(--tw-card)",
    }}>
      <SurgeBanner scenario={scenario} />
      <div style={{
        maxWidth: dense ? 1320 : 1080,
        margin: "0 auto",
        padding: "14px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
      }}>
        <Wordmark />
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {items.map((it) => (
            <button key={it.id} onClick={() => onNav?.(it.id)} style={{
              padding: "7px 12px",
              fontSize: 13,
              color: active === it.id ? "var(--tw-ink)" : "var(--tw-ink-3)",
              fontWeight: active === it.id ? 600 : 500,
              borderRadius: 6,
              background: active === it.id ? "var(--tw-paper-2)" : "transparent",
              transition: "background 0.12s",
            }}>
              {it.label}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LiveDot />
          <div style={{ width: 1, height: 16, background: "var(--tw-line)" }} />
          <button style={{
            padding: "6px 10px", fontSize: 12, color: "var(--tw-ink-3)",
            border: "1px solid var(--tw-line)", borderRadius: 6,
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <Icon name="phone" size={13} />
            <span className="mono">911 / 811</span>
          </button>
        </div>
      </div>
    </header>
  );
};

Object.assign(window, {
  Wordmark, CTASChip, SectionLabel, SymptomPill, Field, TextInput, Button,
  WaitChip, CapacityBar, LiveDot, SurgeBanner, TWHeader,
});
