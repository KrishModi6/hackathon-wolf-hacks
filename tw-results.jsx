// TriageWolf — Results / Care Plan
const ResultsScreen = ({ state, onReset, onShowDashboard }) => {
  const ranked = window.RANKED_RESULTS;
  const topFacility = ranked[0];
  const ctas = state.classification.ctas_level;
  const matches = state.classification.bayesian_matches || [];
  const demoMods = state.classification.demographic_modifiers || [];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const headlineByCTAS = {
    1: { title: "Go to a hospital ER right now.", sub: "These symptoms can be life-threatening. If you're alone or worsening, call 911." },
    2: { title: "Get to an Emergency Department within an hour.", sub: "You should not wait this out. Brampton Civic ER is your fastest match." },
    3: { title: "You should be seen at urgent care today.", sub: "Peel Memorial Urgent Care is open and matches your case." },
    4: { title: "A walk-in clinic can help.", sub: "Telehealth is also a fine first step from home." },
    5: { title: "Self-care or telehealth is appropriate.", sub: "We'll show telehealth and the closest walk-in just in case." },
  };
  const head = headlineByCTAS[ctas];

  return (
    <div className="paper-bg" style={{ minHeight: "100%", padding: "28px 28px 60px" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <button onClick={onReset} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--tw-ink-3)", marginBottom: 16 }}>
          <Icon name="chevron-right" size={14} style={{ transform: "rotate(180deg)" }} />
          Back to triage
        </button>

        {/* Decision card — the hero */}
        <div className="surface" style={{
          padding: "0", marginBottom: 22, overflow: "hidden",
          background: ctas <= 2 ? "linear-gradient(180deg, #fff7f7 0%, #fff 60%)" : "var(--tw-card)",
          borderColor: ctas <= 2 ? "var(--tw-ctas2)" : "var(--tw-line)",
          borderWidth: ctas <= 2 ? 1.5 : 1,
        }}>
          <div style={{ padding: "26px 28px 22px", borderBottom: "1px solid var(--tw-line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <CTASChip level={ctas} size="lg" />
              {state.classification.safety_floor_triggered && (
                <span className="pill" style={{ background: "#fdecec", color: "var(--tw-ctas1)", border: "1px solid var(--tw-ctas2)" }}>
                  <Icon name="shield" size={11} /> Safety floor triggered
                </span>
              )}
              {demoMods.length > 0 && (
                <span className="pill" style={{ background: "var(--tw-paper-2)", color: "var(--tw-ink-3)" }}>
                  <Icon name="user" size={11} /> {demoMods.length} demographic mod{demoMods.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <h1 className="display" style={{
              fontSize: 44, fontWeight: 400, lineHeight: 1.05,
              margin: 0, letterSpacing: "-0.025em",
              color: ctas <= 2 ? "var(--tw-maroon-ink)" : "var(--tw-ink)",
            }}>
              {head.title}
            </h1>
            <p style={{ marginTop: 10, fontSize: 14.5, color: "var(--tw-ink-3)", maxWidth: 600, lineHeight: 1.5 }}>
              {head.sub}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 18, fontSize: 12.5, color: "var(--tw-ink-3)" }}>
              <div>
                <div style={{ fontSize: 10.5, color: "var(--tw-ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Symptoms</div>
                <div className="mono" style={{ color: "var(--tw-ink)" }}>{state.symptoms.length} reported</div>
              </div>
              <div style={{ width: 1, background: "var(--tw-line)" }} />
              <div>
                <div style={{ fontSize: 10.5, color: "var(--tw-ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Patient</div>
                <div className="mono" style={{ color: "var(--tw-ink)" }}>{state.age || "—"} y · {state.fsa || "—"}</div>
              </div>
              <div style={{ width: 1, background: "var(--tw-line)" }} />
              <div>
                <div style={{ fontSize: 10.5, color: "var(--tw-ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Conditions</div>
                <div className="mono" style={{ color: "var(--tw-ink)" }}>{state.conditions.length || "none"}</div>
              </div>
              <div style={{ width: 1, background: "var(--tw-line)" }} />
              <button onClick={() => setDrawerOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--tw-clay)", fontWeight: 600 }}>
                Why this rating? <Icon name="arrow-right" size={13} />
              </button>
            </div>
          </div>

          {/* Action row */}
          <div style={{ padding: "16px 28px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", background: "var(--tw-paper-2)" }}>
            <div style={{ fontSize: 12.5, color: "var(--tw-ink-3)" }}>
              Recommended now: <span style={{ fontWeight: 600, color: "var(--tw-ink)" }}>{topFacility.name}</span> · <WaitChip minutes={topFacility.wait_minutes} /> wait
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="outline" size="sm" icon="qr" onClick={() => setShowQR(true)}>Hand-off QR</Button>
              <Button variant="ghost" size="sm" icon="phone">Call 811</Button>
              {ctas <= 2 ? (
                <Button variant="danger" size="sm" iconAfter="arrow-right">Open in Maps</Button>
              ) : (
                <Button variant="primary" size="sm" iconAfter="arrow-right">Open in Maps</Button>
              )}
            </div>
          </div>
        </div>

        {/* Bayesian patterns alert */}
        {matches.length > 0 && (
          <div style={{ padding: 14, background: "#fdecec", border: "1px solid var(--tw-ctas2)", borderRadius: 10, marginBottom: 22, display: "flex", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--tw-ctas1)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="alert" size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tw-maroon-ink)", marginBottom: 4 }}>
                {matches[0].label} · <span className="mono" style={{ fontWeight: 500 }}>P = {matches[0].probability}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--tw-ink-2)", lineHeight: 1.5 }}>{matches[0].warning}</div>
            </div>
          </div>
        )}

        {/* Facility list */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
            Top {ranked.length} matches near you
          </h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ padding: "5px 9px", border: "1px solid var(--tw-line)", borderRadius: 6, fontSize: 12, background: "var(--tw-card)" }}>
              <Icon name="list" size={13} />
            </button>
            <button style={{ padding: "5px 9px", border: "1px solid var(--tw-line)", borderRadius: 6, fontSize: 12, color: "var(--tw-ink-4)" }}>
              <Icon name="map-pin" size={13} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ranked.map((r, idx) => {
            const f = r.facility;
            const isTop = idx === 0;
            return (
              <div key={f.id} className="surface" style={{
                padding: 18,
                borderColor: isTop ? "var(--tw-ink)" : "var(--tw-line)",
                borderWidth: isTop ? 1.5 : 1,
                position: "relative",
              }}>
                {isTop && (
                  <div style={{ position: "absolute", top: -1, right: 18, padding: "3px 10px", background: "var(--tw-ink)", color: "white", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: "0 0 4px 4px" }}>
                    Best match
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--tw-paper-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tw-ink-2)" }}>
                        <Icon name={f.type === "Telehealth" ? "video" : f.type === "Hospital ER" ? "hospital" : "stethoscope"} size={15} />
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--tw-ink-4)" }}>
                        {f.type}
                      </span>
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--tw-ink-5)" }} />
                      <span style={{ fontSize: 11.5, color: "var(--tw-ink-4)" }}>
                        ~{r.distance_km} km
                      </span>
                      <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--tw-ink-5)" }} />
                      <span style={{ fontSize: 11.5, color: "var(--tw-ink-4)" }}>
                        match <span className="mono" style={{ color: "var(--tw-ink-2)", fontWeight: 600 }}>{Math.round(r.score * 100)}%</span>
                      </span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--tw-ink)", letterSpacing: "-0.01em", marginBottom: 4 }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--tw-ink-3)", marginBottom: 12 }}>{f.address}</div>

                    {/* Capabilities */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {Object.entries(f.capabilities || {}).filter(([, v]) => v).slice(0, 5).map(([k]) => (
                        <span key={k} style={{ fontSize: 10.5, padding: "2px 7px", background: "var(--tw-paper-2)", borderRadius: 4, color: "var(--tw-ink-3)", letterSpacing: "0.02em" }}>
                          {k.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 8, alignItems: "end" }}>
                    <WaitChip minutes={r.wait_minutes} large />
                    <div style={{ fontSize: 10.5, color: "var(--tw-ink-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>predicted wait</div>
                    <div style={{ width: 140, marginTop: 4 }}>
                      <CapacityBar value={f.queue_length} max={50} label="Queue" />
                    </div>
                  </div>
                </div>

                <hr className="dotted-rule" style={{ margin: "14px 0" }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontSize: 11.5, color: "var(--tw-ink-4)", display: "flex", gap: 12, alignItems: "center" }}>
                    <span><Icon name="phone" size={11} /> <span className="mono" style={{ marginLeft: 4 }}>{f.phone}</span></span>
                    <span><Icon name="users" size={11} /> <span className="mono" style={{ marginLeft: 4 }}>{f.clinicians} clinicians</span></span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {f.type === "Telehealth" ? (
                      <Button size="sm" variant={isTop ? "accent" : "outline"} icon="video">Join virtual queue</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" icon="phone">Call</Button>
                        <Button size="sm" variant={isTop ? "accent" : "outline"} iconAfter="arrow-right">Directions</Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reasoning drawer */}
        {drawerOpen && (
          <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(20,14,10,0.4)", zIndex: 50 }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              position: "absolute", right: 0, top: 0, bottom: 0, width: 440,
              background: "var(--tw-card)",
              boxShadow: "var(--shadow-lg)",
              padding: 28, overflowY: "auto",
              animation: "slideIn 0.25s ease",
            }}>
              <style>{`@keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tw-ink-3)", marginBottom: 4 }}>
                    Reasoning
                  </div>
                  <h3 className="display" style={{ fontSize: 28, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
                    Why <span style={{ fontStyle: "italic", color: "var(--tw-maroon)" }}>CTAS {ctas}</span>
                  </h3>
                </div>
                <button onClick={() => setDrawerOpen(false)} style={{ width: 28, height: 28, borderRadius: 6, background: "var(--tw-paper-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="x" size={14} />
                </button>
              </div>

              <div style={{ marginBottom: 22 }}>
                <SectionLabel>Pipeline</SectionLabel>
                <div style={{ fontSize: 12.5, color: "var(--tw-ink-2)", lineHeight: 1.6 }}>
                  {state.classification.tier_reason.split(" | ").map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "1px dashed var(--tw-line)" }}>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--tw-ink-4)", paddingTop: 2 }}>0{i + 1}</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {matches.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <SectionLabel>Bayesian patterns</SectionLabel>
                  {matches.map((m) => (
                    <div key={m.key} style={{ padding: 12, background: "var(--tw-paper-2)", borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                        <span className="mono" style={{ fontSize: 12, color: "var(--tw-maroon)" }}>P = {m.probability}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--tw-ink-4)", marginBottom: 6 }}>
                        {m.signals_matched} co-signal{m.signals_matched !== 1 ? "s" : ""} · escalates to CTAS {m.target_ctas}
                      </div>
                      <div style={{ height: 4, background: "white", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${m.probability * 100}%`, height: "100%", background: "var(--tw-ctas2)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {demoMods.length > 0 && (
                <div>
                  <SectionLabel>Demographic mods</SectionLabel>
                  {demoMods.map((d, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "8px 0", fontSize: 12.5, color: "var(--tw-ink-2)", borderBottom: "1px dashed var(--tw-line)" }}>
                      <Icon name="user" size={13} style={{ color: "var(--tw-ink-4)", marginTop: 2 }} />
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR Modal */}
        {showQR && (
          <div onClick={() => setShowQR(false)} style={{ position: "absolute", inset: 0, background: "rgba(20,14,10,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div onClick={(e) => e.stopPropagation()} className="surface" style={{ padding: 28, width: 360, background: "white", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tw-ink-3)", marginBottom: 4 }}>Hand-off</div>
              <h3 style={{ fontSize: 18, margin: "0 0 14px", letterSpacing: "-0.01em" }}>Show this at reception</h3>
              <div style={{ width: 220, height: 220, margin: "0 auto", background: "var(--tw-paper-2)", border: "1px solid var(--tw-line)", borderRadius: 10, display: "grid", gridTemplateColumns: "repeat(15, 1fr)", gap: 1, padding: 12 }}>
                {Array.from({ length: 225 }).map((_, i) => (
                  <div key={i} style={{ background: Math.random() > 0.55 ? "var(--tw-ink)" : "transparent", borderRadius: 1 }} />
                ))}
              </div>
              <div className="mono" style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--tw-ink-3)" }}>
                Token · Tx_{Math.random().toString(36).slice(2, 10).toUpperCase()}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--tw-ink-4)", textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
                Scanning this skips intake — staff see your CTAS level, symptoms and Bayesian flags instantly.
              </div>
              <Button onClick={() => setShowQR(false)} variant="primary" full size="sm" style={{ marginTop: 16 }}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

window.ResultsScreen = ResultsScreen;
