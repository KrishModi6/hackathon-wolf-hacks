// TriageWolf — Triage / entry screen
const TriageScreen = ({ state, setState, onSubmit }) => {
  const symptoms = window.SYMPTOMS_DATA;
  const [aiText, setAiText] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const examples = [
    "82-yr-old grandmother, chest pain spreading to left arm, sweating",
    "Toddler with high fever and a rash",
    "Sprained my ankle running, can walk but limping",
  ];

  const toggleSymptom = (s) => {
    setState((prev) => {
      const has = prev.symptoms.includes(s);
      return { ...prev, symptoms: has ? prev.symptoms.filter((x) => x !== s) : [...prev.symptoms, s] };
    });
  };

  const fakeAI = () => {
    setAiLoading(true);
    setTimeout(() => {
      // Simple heuristic for the demo
      const t = aiText.toLowerCase();
      let extracted = [];
      let pattern = null;
      if (/chest pain|heart/.test(t)) {
        extracted.push("Chest pain");
        if (/sweat/.test(t)) extracted.push("Profuse sweating");
        if (/arm|numb/.test(t)) extracted.push("Numbness or tingling in left arm");
        if (/jaw|shoulder/.test(t)) extracted.push("Jaw or shoulder pain");
        pattern = { label: "Possible cardiac event", probability: 0.78, ctas: 1 };
      } else if (/fever|burning|hot/.test(t)) {
        extracted.push("High fever (over 39C)");
        if (/confus/.test(t)) extracted.push("Confusion or disorientation");
        pattern = { label: "Possible sepsis pattern", probability: 0.41, ctas: 2 };
      } else if (/sprain|ankle|fell/.test(t)) {
        extracted.push("Sprain or strain");
      } else if (/cough|cold|throat/.test(t)) {
        extracted.push("Cold symptoms");
        if (/throat/.test(t)) extracted.push("Sore throat");
      } else {
        extracted.push("Mild headache");
      }
      const match = aiText.match(/(\d{1,3})[\s-]?(year|yr|y)/i);
      const age = match ? match[1] : null;
      setAiResult({ extracted, pattern, age });
      setAiLoading(false);
    }, 700);
  };

  const applyAI = () => {
    setState((prev) => ({
      ...prev,
      symptoms: Array.from(new Set([...prev.symptoms, ...(aiResult.extracted || [])])),
      age: aiResult.age || prev.age,
    }));
    setAiResult(null);
    setAiText("");
  };

  const totalSelected = state.symptoms.length;

  return (
    <div className="paper-bg" style={{ minHeight: "100%", padding: "32px 28px 60px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ marginBottom: 28, display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "end" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 11px", background: "var(--tw-maroon-tint)", color: "var(--tw-maroon)", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 14 }}>
              <Icon name="shield" size={12} />
              CTAS-aligned · Brampton 2040
            </div>
            <h1 className="display" style={{
              fontSize: 56, fontWeight: 400,
              margin: 0, lineHeight: 1.02,
              letterSpacing: "-0.025em",
              color: "var(--tw-ink)",
            }}>
              Find the fastest care<br />
              <span style={{ fontStyle: "italic", color: "var(--tw-maroon)" }}>right now.</span>
            </h1>
            <p style={{ marginTop: 14, fontSize: 15, color: "var(--tw-ink-3)", maxWidth: 540, lineHeight: 1.5 }}>
              Tell TriageWolf how you feel. We match you to the right Brampton facility in seconds — using the Canadian Triage and Acuity Scale, live wait times, and a Bayesian early-detection layer that catches cardiac, stroke and sepsis patterns before they're obvious.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", color: "var(--tw-ink-4)", fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <div className="mono" style={{ fontSize: 11.5 }}>{new Date().toLocaleDateString("en-CA", { weekday: "short", day: "numeric", month: "short" })}</div>
            <div>5 facilities tracked</div>
            <div>{state.activeUsers || 1284} active sessions</div>
          </div>
        </div>

        {/* AI assistant */}
        <div className="surface" style={{
          padding: 22,
          marginBottom: 22,
          background: "linear-gradient(180deg, #fff 0%, #fdfaf6 100%)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, background: "radial-gradient(circle, rgba(200,74,37,0.08), transparent 70%)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, position: "relative" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--tw-ink)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="sparkles" size={16} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>TriageWolf Assistant</div>
              <div style={{ fontSize: 11.5, color: "var(--tw-ink-4)" }}>Describe symptoms in plain words · or use the mic</div>
            </div>
            <span className="pill" style={{ background: "var(--tw-paper-2)", color: "var(--tw-ink-3)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--tw-ctas5)" }} />
              Online
            </span>
          </div>

          <div style={{ position: "relative" }}>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="e.g. My grandmother is 82, has chest pain spreading to her left arm and is sweating a lot..."
              rows={3}
              style={{
                width: "100%", padding: "14px 56px 14px 16px",
                background: "var(--tw-card)",
                border: "1px solid var(--tw-line)",
                borderRadius: 10,
                fontSize: 14, lineHeight: 1.5,
                color: "var(--tw-ink)",
                resize: "none", outline: "none",
                fontFamily: "inherit",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--tw-clay)"; e.target.style.boxShadow = "0 0 0 3px rgba(200,74,37,0.12)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--tw-line)"; e.target.style.boxShadow = "none"; }}
            />
            <button
              title="Voice input"
              style={{
                position: "absolute", right: 10, bottom: 10,
                width: 36, height: 36, borderRadius: 8,
                background: "var(--tw-card)", border: "1px solid var(--tw-line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--tw-ink-3)",
              }}>
              <Icon name="mic" size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {examples.map((ex, i) => (
                <button key={i} onClick={() => setAiText(ex)} style={{
                  padding: "5px 10px",
                  fontSize: 11.5,
                  color: "var(--tw-ink-3)",
                  background: "var(--tw-paper-2)",
                  border: "1px solid var(--tw-line-2)",
                  borderRadius: 999,
                }}>
                  {ex.slice(0, 40)}{ex.length > 40 ? "…" : ""}
                </button>
              ))}
            </div>
            <Button onClick={fakeAI} disabled={!aiText.trim() || aiLoading} icon={aiLoading ? null : "send"} variant="primary" size="sm">
              {aiLoading ? "Analyzing…" : "Analyze"}
            </Button>
          </div>

          {aiResult && (
            <div style={{ marginTop: 14, padding: 14, background: "var(--tw-paper)", border: "1px solid var(--tw-line)", borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Icon name="check" size={14} style={{ color: "var(--tw-ctas5)" }} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>Detected from your description</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {aiResult.extracted.map((s) => (
                  <span key={s} style={{ padding: "4px 10px", background: "white", border: "1px solid var(--tw-line)", borderRadius: 999, fontSize: 12 }}>
                    {s}
                  </span>
                ))}
                {aiResult.age && (
                  <span style={{ padding: "4px 10px", background: "white", border: "1px solid var(--tw-line)", borderRadius: 999, fontSize: 12 }}>
                    Age <span className="mono" style={{ fontWeight: 600 }}>{aiResult.age}</span>
                  </span>
                )}
              </div>
              {aiResult.pattern && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: 12,
                  background: aiResult.pattern.ctas === 1 ? "#fdecec" : "#fcefdc",
                  border: `1px solid ${aiResult.pattern.ctas === 1 ? "var(--tw-ctas2)" : "var(--tw-ctas3)"}`,
                  borderRadius: 8, marginBottom: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon name="alert" size={18} style={{ color: aiResult.pattern.ctas === 1 ? "var(--tw-ctas1)" : "var(--tw-ctas3)" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{aiResult.pattern.label}</div>
                      <div style={{ fontSize: 11.5, color: "var(--tw-ink-3)" }}>
                        Bayesian posterior · <span className="mono">P = {aiResult.pattern.probability.toFixed(2)}</span> · target CTAS {aiResult.pattern.ctas}
                      </div>
                    </div>
                  </div>
                  <CTASChip level={aiResult.pattern.ctas} />
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" variant="primary" onClick={applyAI} icon="check">Apply to form</Button>
                <Button size="sm" variant="ghost" onClick={() => setAiResult(null)}>Dismiss</Button>
              </div>
            </div>
          )}
        </div>

        {/* Form layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22, alignItems: "start" }}>
          <div className="surface" style={{ padding: 24 }}>
            {/* Basics */}
            <SectionLabel accent="var(--tw-maroon)">Step 01 · Patient basics</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <Field label="Postal code (FSA)" hint="First 3 chars">
                <TextInput value={state.fsa} onChange={(v) => setState({ ...state, fsa: v.toUpperCase().slice(0, 3) })} placeholder="L6S" mono />
              </Field>
              <Field label="Patient age">
                <TextInput value={state.age} onChange={(v) => setState({ ...state, age: v.replace(/\D/g, "").slice(0, 3) })} placeholder="25" mono />
              </Field>
            </div>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: "100%", padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "var(--tw-paper-2)", border: "1px solid var(--tw-line-2)",
                borderRadius: 8, fontSize: 13, color: "var(--tw-ink-3)", marginBottom: 12,
              }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon name="users" size={14} />
                Triaging for someone else, or pregnant / chronic conditions?
              </span>
              <Icon name={showAdvanced ? "chevron-down" : "chevron-right"} size={14} />
            </button>

            {showAdvanced && (
              <div style={{ padding: 14, background: "var(--tw-paper)", borderRadius: 10, border: "1px dashed var(--tw-line)", marginBottom: 18 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={state.caregiver} onChange={(e) => setState({ ...state, caregiver: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--tw-maroon)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>I'm triaging for a family member</div>
                    <div style={{ fontSize: 11.5, color: "var(--tw-ink-4)" }}>Adults triaging children, kids triaging elderly parents, etc.</div>
                  </div>
                </label>

                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tw-ink-3)", marginBottom: 8 }}>
                  Pre-existing conditions
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    ["pregnant", "Pregnant"],
                    ["heart_disease", "Heart disease"],
                    ["diabetes", "Diabetes"],
                    ["asthma", "Asthma / COPD"],
                    ["immunocompromised", "Immunocompromised"],
                    ["kidney", "Kidney disease"],
                  ].map(([k, label]) => (
                    <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "white", border: "1px solid var(--tw-line)", borderRadius: 6, cursor: "pointer", fontSize: 12.5 }}>
                      <input
                        type="checkbox"
                        checked={state.conditions.includes(k)}
                        onChange={() => setState({
                          ...state,
                          conditions: state.conditions.includes(k)
                            ? state.conditions.filter((c) => c !== k)
                            : [...state.conditions, k],
                        })}
                        style={{ width: 14, height: 14, accentColor: "var(--tw-maroon)" }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Symptoms */}
            <SectionLabel accent="var(--tw-maroon)" count={totalSelected}>
              Step 02 · What's going on
            </SectionLabel>

            {[
              { key: "critical", title: "Critical", desc: "Anything in this row triggers immediate ER routing.", tone: "critical", icon: "alert" },
              { key: "urgent", title: "Urgent", desc: "Should be seen within hours.", tone: "urgent", icon: "thermometer" },
              { key: "moderate", title: "Moderate", desc: "Walk-in or telehealth typically suitable.", tone: "moderate", icon: "stethoscope" },
              { key: "mild", title: "Mild", desc: "Self-care or telehealth.", tone: "mild", icon: "chat" },
              { key: "signals", title: "Subtle warning signs", desc: "Combined with other symptoms, these escalate severity.", tone: "signal", icon: "sparkles" },
            ].map((g) => (
              <div key={g.key} style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon name={g.icon} size={14} style={{ color: g.tone === "critical" ? "var(--tw-ctas1)" : g.tone === "urgent" ? "var(--tw-ctas3)" : g.tone === "signal" ? "var(--tw-maroon)" : "var(--tw-ink-3)" }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{g.title}</span>
                  <span style={{ fontSize: 11.5, color: "var(--tw-ink-4)" }}>· {g.desc}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {symptoms[g.key].map((s) => (
                    <SymptomPill key={s} symptom={s} checked={state.symptoms.includes(s)} onToggle={() => toggleSymptom(s)} tone={g.tone} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right rail — sticky summary */}
          <div style={{ position: "sticky", top: 16 }}>
            <div className="surface" style={{ padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tw-ink-3)", marginBottom: 10 }}>
                Live near you
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {window.FACILITIES_DATA.slice(0, 4).map((f) => (
                  <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--tw-ink)" }}>{f.shortName}</div>
                      <div style={{ fontSize: 10.5, color: "var(--tw-ink-4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{f.type}</div>
                    </div>
                    <WaitChip minutes={f.wait} />
                  </div>
                ))}
              </div>
              <hr className="dotted-rule" style={{ margin: "12px 0" }} />
              <div style={{ fontSize: 11, color: "var(--tw-ink-4)" }}>
                Updated <span className="mono">{new Date().toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}</span> · auto-refreshes every 60s
              </div>
            </div>

            <div className="surface" style={{ padding: 18, marginBottom: 16, background: "var(--tw-paper-2)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tw-ink-3)", marginBottom: 8 }}>
                Your selection
              </div>
              {totalSelected === 0 ? (
                <div style={{ fontSize: 12.5, color: "var(--tw-ink-4)" }}>
                  No symptoms yet — tap the most prominent one or describe it above.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {state.symptoms.map((s) => (
                    <span key={s} style={{ fontSize: 11.5, padding: "3px 8px", background: "white", border: "1px solid var(--tw-line)", borderRadius: 999 }}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={onSubmit} disabled={totalSelected === 0} variant="danger" size="lg" full iconAfter="arrow-right">
              Find my care
            </Button>

            <div style={{ marginTop: 12, padding: 10, background: "transparent", fontSize: 11, color: "var(--tw-ink-4)", lineHeight: 1.5, textAlign: "center" }}>
              Hackathon prototype · not medical advice. If you suspect an emergency, call <span style={{ fontWeight: 600, color: "var(--tw-maroon)" }} className="mono">911</span> immediately.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.TriageScreen = TriageScreen;
