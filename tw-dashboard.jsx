// TriageWolf — Dashboard / Operations console
const DashboardScreen = ({ scenario, setScenario }) => {
  const facilities = window.FACILITIES_DATA;
  const stats = {
    triagedToday: 1284,
    redirected: 312,
    avgWait: 87,
    bayesianHits: 47,
  };

  // Severity distribution
  const severity = [
    { level: 1, count: 18, label: "Resuscitation", color: "var(--tw-ctas1)" },
    { level: 2, count: 64, label: "Emergent", color: "var(--tw-ctas2)" },
    { level: 3, count: 287, label: "Urgent", color: "var(--tw-ctas3)" },
    { level: 4, count: 512, label: "Less urgent", color: "var(--tw-ctas4)" },
    { level: 5, count: 403, label: "Non-urgent", color: "var(--tw-ctas5)" },
  ];
  const totalSev = severity.reduce((s, x) => s + x.count, 0);

  // Trend data (12 hours)
  const trend = [22, 31, 28, 35, 48, 62, 81, 94, 86, 73, 68, 71];
  const maxTrend = Math.max(...trend);

  return (
    <div style={{ minHeight: "100%", background: "var(--tw-paper)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 28px 60px" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tw-ink-3)", marginBottom: 4 }}>Operations</div>
            <h1 className="display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.025em" }}>
              Brampton system load
            </h1>
            <div style={{ fontSize: 13, color: "var(--tw-ink-3)", marginTop: 4 }}>
              <span className="mono">{new Date().toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              {" · 5 facilities · "}
              <LiveDot />
            </div>
          </div>

          {/* Scenario switcher */}
          <div className="surface" style={{ padding: 6, display: "flex", gap: 4 }}>
            {[
              { id: null, label: "Normal ops", icon: "shield" },
              { id: "condition_x", label: "Condition X", icon: "alert" },
              { id: "heatwave", label: "Heatwave", icon: "thermometer" },
              { id: "cyberattack", label: "Cyber incident", icon: "globe" },
            ].map((s) => (
              <button key={s.id || "normal"} onClick={() => setScenario(s.id)} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 11px", fontSize: 12.5, fontWeight: 500,
                borderRadius: 6,
                background: scenario === s.id ? "var(--tw-ink)" : "transparent",
                color: scenario === s.id ? "white" : "var(--tw-ink-3)",
                transition: "all 0.12s",
              }}>
                <Icon name={s.icon} size={13} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 22 }}>
          {[
            { label: "Patients triaged today", value: stats.triagedToday.toLocaleString(), trend: "+12%", icon: "users" },
            { label: "Redirected to virtual", value: stats.redirected, trend: "+34%", icon: "video" },
            { label: "Avg system wait", value: `${stats.avgWait}m`, trend: scenario === "condition_x" ? "+187%" : "−4%", danger: scenario === "condition_x", icon: "clock" },
            { label: "Bayesian early-detects", value: stats.bayesianHits, trend: "+8 last hr", icon: "sparkles" },
          ].map((k) => (
            <div key={k.label} className="surface" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--tw-paper-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tw-ink-2)" }}>
                  <Icon name={k.icon} size={15} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: k.danger ? "var(--tw-ctas2)" : "var(--tw-ctas5)", padding: "2px 7px", background: k.danger ? "#fdecec" : "#e6f3eb", borderRadius: 4 }}>
                  {k.trend}
                </span>
              </div>
              <div className="mono" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1, color: "var(--tw-ink)" }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: "var(--tw-ink-4)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Wait times — bar chart */}
          <div className="surface" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 15, margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>Current wait times</h3>
                <p style={{ fontSize: 12, color: "var(--tw-ink-4)", margin: "3px 0 0" }}>
                  M/M/c queueing approximation · refreshes 60s
                </p>
              </div>
              <span className="pill" style={{ background: "var(--tw-paper-2)", color: "var(--tw-ink-3)" }}>
                {scenario === "condition_x" ? "× 3.0 surge mult" : "× 1.0 baseline"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {facilities.map((f) => {
                const wait = scenario === "condition_x" && f.type === "Hospital ER" ? f.wait * 3 : f.wait;
                const pct = Math.min(100, (wait / 480) * 100);
                const tone = wait >= 180 ? "var(--tw-ctas1)" : wait >= 90 ? "var(--tw-ctas3)" : wait >= 30 ? "var(--tw-ctas4)" : "var(--tw-ctas5)";
                return (
                  <div key={f.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {f.shortName} <span style={{ fontSize: 11, color: "var(--tw-ink-4)", fontWeight: 400, marginLeft: 6 }}>{f.type}</span>
                      </div>
                      <WaitChip minutes={wait} />
                    </div>
                    <div style={{ height: 8, background: "var(--tw-line-2)", borderRadius: 2, overflow: "hidden", position: "relative" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: tone, transition: "width 0.4s ease" }} />
                      {/* Threshold ticks */}
                      {[60, 180, 360].map((t) => (
                        <div key={t} style={{ position: "absolute", left: `${(t / 480) * 100}%`, top: 0, bottom: 0, width: 1, background: "var(--tw-ink-5)", opacity: 0.5 }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Severity distribution — donut + legend */}
          <div className="surface" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>Severity mix today</h3>
            <p style={{ fontSize: 12, color: "var(--tw-ink-4)", margin: "3px 0 18px" }}>{totalSev.toLocaleString()} patients triaged · CTAS distribution</p>

            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* Donut */}
              <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
                {(() => {
                  let cum = 0;
                  const r = 48, c = 60, circ = 2 * Math.PI * r;
                  return severity.map((s) => {
                    const frac = s.count / totalSev;
                    const dash = frac * circ;
                    const offset = -cum * circ;
                    cum += frac;
                    return (
                      <circle
                        key={s.level}
                        cx={c} cy={c} r={r}
                        fill="none"
                        stroke={s.color}
                        strokeWidth="14"
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={offset}
                        transform={`rotate(-90 ${c} ${c})`}
                      />
                    );
                  });
                })()}
                <text x="60" y="58" textAnchor="middle" className="mono" style={{ fontSize: 22, fontWeight: 600, fill: "var(--tw-ink)" }}>
                  {totalSev.toLocaleString()}
                </text>
                <text x="60" y="74" textAnchor="middle" style={{ fontSize: 9, fill: "var(--tw-ink-4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  patients
                </text>
              </svg>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                {severity.map((s) => (
                  <div key={s.level} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                    <span style={{ flex: 1, color: "var(--tw-ink-2)" }}>CTAS {s.level} · <span style={{ color: "var(--tw-ink-4)" }}>{s.label}</span></span>
                    <span className="mono" style={{ color: "var(--tw-ink), fontWeight: 600" }}>{s.count}</span>
                    <span className="mono" style={{ color: "var(--tw-ink-4)", width: 36, textAlign: "right" }}>{((s.count / totalSev) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trend + facility table */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
          {/* Trend */}
          <div className="surface" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>Triage volume · 12h</h3>
            <p style={{ fontSize: 12, color: "var(--tw-ink-4)", margin: "3px 0 18px" }}>Hourly arrival rate · all facilities</p>

            <svg width="100%" height="120" viewBox="0 0 360 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--tw-maroon)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--tw-maroon)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M 0 120 ${trend.map((v, i) => `L ${(i * 360) / (trend.length - 1)} ${120 - (v / maxTrend) * 100}`).join(" ")} L 360 120 Z`}
                fill="url(#trend-grad)"
              />
              <path
                d={`M 0 ${120 - (trend[0] / maxTrend) * 100} ${trend.map((v, i) => `L ${(i * 360) / (trend.length - 1)} ${120 - (v / maxTrend) * 100}`).join(" ")}`}
                fill="none" stroke="var(--tw-maroon)" strokeWidth="2"
              />
              {trend.map((v, i) => (
                <circle key={i} cx={(i * 360) / (trend.length - 1)} cy={120 - (v / maxTrend) * 100} r={i === trend.length - 1 ? 4 : 2.5} fill="var(--tw-maroon)" />
              ))}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10.5, color: "var(--tw-ink-4)" }}>
              <span className="mono">8a</span>
              <span className="mono">2p</span>
              <span className="mono">8p</span>
            </div>
          </div>

          {/* Facility table */}
          <div className="surface" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "18px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 15, margin: 0, fontWeight: 600, letterSpacing: "-0.01em" }}>Facility status</h3>
              <button style={{ padding: "5px 9px", border: "1px solid var(--tw-line)", borderRadius: 6, fontSize: 11.5, color: "var(--tw-ink-3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="filter" size={12} /> Filter
              </button>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "var(--tw-paper-2)", color: "var(--tw-ink-4)", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  <th style={{ padding: "8px 22px", textAlign: "left", fontWeight: 600 }}>Facility</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Type</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>Queue</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>Wait</th>
                  <th style={{ padding: "8px 22px", textAlign: "right", fontWeight: 600 }}>Saturation</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((f) => {
                  const wait = scenario === "condition_x" && f.type === "Hospital ER" ? f.wait * 3 : f.wait;
                  const sat = (f.queue_length / (f.clinicians * 10));
                  const satTone = sat >= 0.85 ? "var(--tw-ctas2)" : sat >= 0.6 ? "var(--tw-ctas3)" : "var(--tw-ctas5)";
                  return (
                    <tr key={f.id} style={{ borderTop: "1px solid var(--tw-line-2)" }}>
                      <td style={{ padding: "10px 22px", fontWeight: 500 }}>{f.shortName}</td>
                      <td style={{ padding: "10px 12px", color: "var(--tw-ink-3)" }}>{f.type}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }} className="mono">{f.queue_length}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}><WaitChip minutes={wait} /></td>
                      <td style={{ padding: "10px 22px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 50, height: 4, background: "var(--tw-line-2)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, sat * 100)}%`, height: "100%", background: satTone }} />
                          </div>
                          <span className="mono" style={{ color: satTone, fontSize: 11.5, fontWeight: 600 }}>{Math.round(sat * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

window.DashboardScreen = DashboardScreen;
