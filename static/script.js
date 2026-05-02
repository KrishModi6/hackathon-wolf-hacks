// Frontend behaviour for SwiftCare Brampton.
// Most interactivity is form-based, but the dashboard polls /api/state for live updates.

document.addEventListener("DOMContentLoaded", () => {
  initSymptomCounter();
  initDashboard();
  initAssistant();
  initCaregiverMode();
  initAccessibilityMode();
  initMentalHealthChat();
});

function initCaregiverMode() {
  const toggle = document.getElementById("caregiver-mode");
  const panel = document.getElementById("caregiver-fields");
  if (!toggle || !panel) return;
  const sync = () => panel.classList.toggle("hidden", !toggle.checked);
  toggle.addEventListener("change", sync);
  sync();
}

function initAccessibilityMode() {
  const btn = document.getElementById("a11y-toggle");
  if (!btn) return;
  const key = "swiftcare_a11y_mode";
  const label = btn.querySelector(".a11y-label");

  const apply = (on) => {
    document.body.classList.toggle("a11y-mode", on);
    if (label) {
      label.textContent = on ? "Accessibility: ON" : "Accessibility";
    } else {
      btn.textContent = on ? "Accessibility: ON" : "Accessibility";
    }
  };

  const remembered = window.localStorage.getItem(key) === "1";
  apply(remembered);

  btn.addEventListener("click", () => {
    const now = !document.body.classList.contains("a11y-mode");
    apply(now);
    window.localStorage.setItem(key, now ? "1" : "0");
  });
}

// ---- AI assistant + voice ----------------------------------------------------

let speechRecognizer = null;
let voiceRepliesOn = true;

function initAssistant() {
  const sendBtn = document.getElementById("ai-send");
  if (!sendBtn) return;

  const input = document.getElementById("ai-input");
  const micBtn = document.getElementById("mic-btn");
  const micStatus = document.getElementById("mic-status");
  const speakToggle = document.getElementById("speak-toggle");

  sendBtn.addEventListener("click", () => sendToAssistant(input.value));
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") sendToAssistant(input.value);
  });

  speakToggle.addEventListener("click", () => {
    voiceRepliesOn = !voiceRepliesOn;
    speakToggle.textContent = voiceRepliesOn ? "🔊 Voice replies: ON" : "🔇 Voice replies: OFF";
    if (!voiceRepliesOn) window.speechSynthesis?.cancel();
  });

  // Web Speech API for voice input. Falls back gracefully if unsupported.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    micBtn.disabled = true;
    micBtn.title = "Voice input not supported in this browser";
    micBtn.classList.add("opacity-50");
    return;
  }

  speechRecognizer = new SR();
  speechRecognizer.lang = "en-US";
  speechRecognizer.interimResults = true;
  speechRecognizer.continuous = false;

  let listening = false;
  let finalTranscript = "";

  speechRecognizer.onstart = () => {
    listening = true;
    finalTranscript = "";
    micBtn.classList.add("bg-red-100", "border-red-400");
    micStatus.textContent = "🎙️ Listening… speak now.";
  };
  speechRecognizer.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += text + " ";
      else interim += text;
    }
    input.value = (finalTranscript + interim).trim();
  };
  speechRecognizer.onerror = (e) => {
    micStatus.textContent = "Mic error: " + e.error;
  };
  speechRecognizer.onend = () => {
    listening = false;
    micBtn.classList.remove("bg-red-100", "border-red-400");
    micStatus.textContent = finalTranscript ? "Got it — review and click Analyze." : "";
    if (finalTranscript.trim()) sendToAssistant(input.value);
  };

  micBtn.addEventListener("click", () => {
    if (listening) speechRecognizer.stop();
    else {
      try { speechRecognizer.start(); }
      catch (err) { micStatus.textContent = "Mic busy — try again."; }
    }
  });
}

async function sendToAssistant(text) {
  const result = document.getElementById("ai-result");
  const sendBtn = document.getElementById("ai-send");
  if (!text || !text.trim()) {
    result.classList.remove("hidden");
    result.innerHTML = `<div class="p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">Please describe your symptoms first.</div>`;
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = "Analyzing…";
  result.classList.remove("hidden");
  result.innerHTML = `<div class="p-4 rounded-lg bg-white border border-gray-200 text-sm text-gray-600">Thinking…</div>`;

  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (data.error) {
      result.innerHTML = `<div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">${escapeHtml(data.error)}</div>`;
      return;
    }
    renderAssistantResult(data);
    autoCheckMatchedSymptoms(data.matched_symptoms || []);
    if (voiceRepliesOn) speakReply(data);
  } catch (err) {
    result.innerHTML = `<div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">Network error: ${escapeHtml(err.message)}</div>`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Analyze symptoms →";
  }
}

function renderAssistantResult(data) {
  const result = document.getElementById("ai-result");
  const tier = (data.severity_tier || "mild").toLowerCase();
  const tierColors = {
    critical: ["bg-red-50", "border-red-300", "text-red-800", "Emergency"],
    urgent:   ["bg-orange-50", "border-orange-300", "text-orange-800", "Urgent"],
    moderate: ["bg-yellow-50", "border-yellow-300", "text-yellow-800", "Moderate"],
    mild:     ["bg-green-50", "border-green-300", "text-green-800", "Mild"],
  };
  const [bg, border, txt, label] = tierColors[tier] || tierColors.mild;

  let html = `
    <div class="p-4 rounded-lg ${bg} border ${border} ${txt}">
      <div class="flex items-center gap-2 mb-2">
        <span class="severity-badge ${tier === 'critical' ? 'bg-red-600' : tier === 'urgent' ? 'bg-orange-500' : tier === 'moderate' ? 'bg-yellow-500' : 'bg-green-600'}">${label}</span>
        <span class="text-xs font-semibold uppercase tracking-wide">AI Triage Assessment</span>
      </div>
      <div class="font-semibold mb-1">${escapeHtml(data.summary || '')}</div>
      <div class="text-sm">${escapeHtml(data.next_steps || '')}</div>
  `;

  if (data.early_warning) {
    html += `
      <div class="mt-3 p-3 rounded bg-white border-l-4 border-red-600 text-sm text-red-900">
        <strong>⚠️ Early warning:</strong> ${escapeHtml(data.early_warning)}
      </div>`;
  }

  if (data.matched_symptoms && data.matched_symptoms.length) {
    html += `
      <div class="mt-3 text-xs">
        <span class="font-semibold">Matched in form:</span>
        ${data.matched_symptoms.map(s => `<span class="inline-block px-2 py-0.5 mr-1 mt-1 rounded bg-white border border-gray-300 text-gray-700">${escapeHtml(s)}</span>`).join('')}
      </div>`;
  }

  if (data.condition_x_auto_triggered) {
    html += `
      <div class="mt-3 p-3 rounded bg-red-700 text-white text-sm font-semibold">
        🦠 OUTBREAK ALERT AUTO-ACTIVATED — ${escapeHtml(data.outbreak_reason || 'outbreak pattern detected')}.
        Surge protocols are now live across Brampton.
      </div>`;
    // Show the surge banner immediately without a page reload.
    if (!document.querySelector(".surge-banner")) {
      const banner = document.createElement("div");
      banner.className = "surge-banner";
      banner.textContent = "OUTBREAK ALERT: Brampton hospitals at capacity. Non-emergency patients are being routed to virtual triage.";
      document.body.prepend(banner);
    }
  }

  html += `</div>`;
  result.innerHTML = html;
}

function autoCheckMatchedSymptoms(matched) {
  if (!matched || !matched.length) return;
  const checkboxes = document.querySelectorAll('input[name="symptoms"]');
  checkboxes.forEach(cb => {
    if (matched.includes(cb.value)) cb.checked = true;
  });
  // Trigger the symptom counter update.
  const counter = document.getElementById("symptom-count");
  if (counter) {
    const n = Array.from(checkboxes).filter(c => c.checked).length;
    counter.textContent = n;
  }
}

function speakReply(data) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const parts = [data.summary, data.next_steps];
  if (data.early_warning) parts.unshift("Important. " + data.early_warning);
  if (data.condition_x_auto_triggered) parts.push("Outbreak surge mode has been activated.");
  const utterance = new SpeechSynthesisUtterance(parts.filter(Boolean).join(" "));
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function initMentalHealthChat() {
  const send = document.getElementById("mh-send");
  if (!send) return;
  const input = document.getElementById("mh-input");
  const log = document.getElementById("mh-chat-log");
  const result = document.getElementById("mh-result");

  const addMessage = (role, text) => {
    const el = document.createElement("div");
    el.className = `mh-message ${role}`;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  };

  const submit = async () => {
    const message = input.value.trim();
    if (!message) return;
    addMessage("user", message);
    input.value = "";
    send.disabled = true;
    send.textContent = "Checking...";
    try {
      const res = await fetch("/api/mental-health/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (data.error) {
        addMessage("bot", data.error);
        return;
      }
      addMessage("bot", `${data.summary} ${data.action}`);
      renderMentalHealthResult(data);
    } catch (err) {
      addMessage("bot", "I could not reach the mental-health support service. If this is urgent, call or text 9-8-8 now.");
    } finally {
      send.disabled = false;
      send.textContent = "Send";
    }
  };

  send.addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") submit();
  });

  function renderMentalHealthResult(data) {
    const colors = {
      CRISIS: "bg-red-50 border-red-300 text-red-900",
      URGENT: "bg-orange-50 border-orange-300 text-orange-900",
      SUPPORT: "bg-blue-50 border-blue-300 text-blue-900",
      MINOR: "bg-green-50 border-green-300 text-green-900",
    };
    const cls = colors[data.level] || colors.SUPPORT;
    const steps = (data.steps || []).map(step => `<li>${escapeHtml(step)}</li>`).join("");
    result.innerHTML = `
      <div class="p-4 rounded-xl border ${cls}">
        <div class="text-xs uppercase tracking-wide font-semibold">Mental health level: ${escapeHtml(data.level)}</div>
        <div class="mt-1 text-xl font-bold">${escapeHtml(data.action)}</div>
        <p class="mt-2 text-sm">${escapeHtml(data.dsm_note || "")}</p>
        <ul class="mt-3 list-disc list-inside text-sm space-y-1">${steps}</ul>
        <div class="mt-4 flex flex-wrap gap-2">
          <a class="tw-btn-secondary text-sm" href="${escapeHtml(data.resources.crisis.url)}" target="_blank" rel="noopener">Call/Text 9-8-8</a>
          <a class="tw-btn-secondary text-sm" href="${escapeHtml(data.resources.youth.url)}" target="_blank" rel="noopener">Kids Help Phone</a>
          <a class="tw-btn-secondary text-sm" href="#mh-emergency-form">Create ER Ticket</a>
        </div>
      </div>`;
  }
}

function initSymptomCounter() {
  const counter = document.getElementById("symptom-count");
  if (!counter) return;
  const checkboxes = document.querySelectorAll('input[name="symptoms"]');
  const update = () => {
    const n = Array.from(checkboxes).filter(c => c.checked).length;
    counter.textContent = n;
    counter.parentElement.classList.toggle("tw-text-orange", n > 0);
  };
  checkboxes.forEach(c => c.addEventListener("change", update));
  update();
}

function initDashboard() {
  const waitsCanvas = document.getElementById("waitsChart");
  if (!waitsCanvas) return; // not on dashboard page

  const initial = window.__DASH_DATA__ || {};
  const facilities = initial.facilities || [];
  const severityCounts = initial.severity_counts || {};
  const triageLog = initial.triage_log || [];

  const waitsChart = new Chart(waitsCanvas, {
    type: "bar",
    data: {
      labels: facilities.map(f => f.name),
      datasets: [{
        label: "Wait time (minutes)",
        data: facilities.map(f => f.wait),
        backgroundColor: facilities.map(f => waitColor(f.wait)),
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Minutes" } },
        x: { ticks: { maxRotation: 30, minRotation: 0, font: { size: 11 } } },
      },
    },
  });

  const severityCanvas = document.getElementById("severityChart");
  const severityChart = new Chart(severityCanvas, {
    type: "doughnut",
    data: {
      labels: ["CTAS 1", "CTAS 2", "CTAS 3", "CTAS 4", "CTAS 5"],
      datasets: [{
        data: [1,2,3,4,5].map(k => severityCounts[String(k)] || 0),
        backgroundColor: ["#b91c1c", "#dc2626", "#ea580c", "#ca8a04", "#15803d"],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });

  const trendCanvas = document.getElementById("trendChart");
  const trendChart = new Chart(trendCanvas, {
    type: "line",
    data: {
      labels: triageLog.map((_, i) => `#${i + 1}`),
      datasets: [{
        label: "Patients triaged",
        data: triageLog.map((_, i) => i + 1),
        borderColor: "#7a1f2b",
        backgroundColor: "rgba(122, 31, 43, 0.12)",
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  // Poll state every 5s so the demo feels live even without page reload.
  setInterval(async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      waitsChart.data.labels = data.facilities.map(f => f.name);
      waitsChart.data.datasets[0].data = data.facilities.map(f => f.wait);
      waitsChart.data.datasets[0].backgroundColor = data.facilities.map(f => waitColor(f.wait));
      waitsChart.update();

      severityChart.data.datasets[0].data = [1,2,3,4,5].map(k => data.severity_counts[String(k)] || 0);
      severityChart.update();

      const triagedEl = document.getElementById("stat-triaged");
      if (triagedEl) triagedEl.textContent = data.patients_triaged_today;
      const redirectEl = document.getElementById("stat-redirected");
      if (redirectEl) redirectEl.textContent = data.patients_redirected;
      const intakeEl = document.getElementById("stat-intake");
      if (intakeEl) intakeEl.textContent = (data.consult_requests || 0) + (data.critical_intake_packets || 0);
    } catch (err) {
      // Network blip, ignore.
    }
  }, 5000);
}

function waitColor(minutes) {
  if (minutes >= 240) return "#b91c1c";
  if (minutes >= 120) return "#ea580c";
  if (minutes >= 60)  return "#ca8a04";
  return "#15803d";
}
