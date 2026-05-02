// TriageWolf — minimal stroke icon set, 1.5px, 20px viewbox
const Icon = ({ name, size = 18, stroke = 1.5, className = "", style = {} }) => {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    style,
  };
  switch (name) {
    case "wolf":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M3 7l3-3 2 2h8l2-2 3 3-1 4-2 1v3l-2 4h-3l-1-2h-4l-1 2H7l-2-4v-3l-2-1z" />
          <circle cx="9.5" cy="11" r="0.6" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="11" r="0.6" fill="currentColor" stroke="none" />
          <path d="M11 14h2" />
        </svg>
      );
    case "pulse":
      return (
        <svg {...props}>
          <path d="M3 12h4l2-6 4 12 2-6h6" />
        </svg>
      );
    case "mic":
      return (
        <svg {...props}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...props}>
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
          <path d="M19 15l.7 1.8L21.5 17l-1.8.7L19 19.5l-.7-1.8L16.5 17l1.8-.7z" />
        </svg>
      );
    case "send":
      return <svg {...props}><path d="M4 12l16-8-6 16-2-7-8-1z" /></svg>;
    case "search":
      return <svg {...props}><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></svg>;
    case "map-pin":
      return <svg {...props}><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case "clock":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "user":
      return <svg {...props}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case "users":
      return <svg {...props}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M15 19a5 5 0 0 1 6 0" /></svg>;
    case "hospital":
      return <svg {...props}><path d="M4 21V8l8-4 8 4v13" /><path d="M4 21h16M10 21v-5h4v5M12 8v6M9 11h6" /></svg>;
    case "stethoscope":
      return <svg {...props}><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M5 3h2M13 3h2" /><path d="M10 13v2a5 5 0 0 0 10 0v-1" /><circle cx="20" cy="13" r="2" /></svg>;
    case "video":
      return <svg {...props}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>;
    case "alert":
      return <svg {...props}><path d="M12 4 2 20h20z" /><path d="M12 10v5M12 18v.01" /></svg>;
    case "shield":
      return <svg {...props}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "chevron-right":
      return <svg {...props}><path d="m9 6 6 6-6 6" /></svg>;
    case "chevron-down":
      return <svg {...props}><path d="m6 9 6 6 6-6" /></svg>;
    case "arrow-right":
      return <svg {...props}><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
    case "phone":
      return <svg {...props}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>;
    case "qr":
      return <svg {...props}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M21 14v7M14 18v3M17 21h4" /></svg>;
    case "x":
      return <svg {...props}><path d="M6 6l12 12M18 6 6 18" /></svg>;
    case "check":
      return <svg {...props}><path d="m5 12 5 5 9-11" /></svg>;
    case "info":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></svg>;
    case "thermometer":
      return <svg {...props}><path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0z" /></svg>;
    case "heart":
      return <svg {...props}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>;
    case "lung":
      return <svg {...props}><path d="M12 4v10M8 8c-3 1-5 4-5 8 0 2 1 3 3 3s4-2 4-5V8zM16 8c3 1 5 4 5 8 0 2-1 3-3 3s-4-2-4-5V8z" /></svg>;
    case "activity":
      return <svg {...props}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>;
    case "filter":
      return <svg {...props}><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg>;
    case "grid":
      return <svg {...props}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
    case "list":
      return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
    case "trending-up":
      return <svg {...props}><path d="m3 17 6-6 4 4 8-8M14 7h7v7" /></svg>;
    case "settings":
      return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.5-2.4.9a7 7 0 0 0-2.3-1.3L13.7 3h-3.4l-.5 2.3a7 7 0 0 0-2.3 1.3l-2.4-.9-2 3.5 2 1.5a7 7 0 0 0 0 2.6l-2 1.5 2 3.5 2.4-.9a7 7 0 0 0 2.3 1.3l.5 2.3h3.4l.5-2.3a7 7 0 0 0 2.3-1.3l2.4.9 2-3.5-2-1.5c.07-.4.1-.84.1-1.3z" /></svg>;
    case "globe":
      return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
    case "ear":
      return <svg {...props}><path d="M8 22c-2 0-3-1-3-3 0-2 2-3 2-5 0-1-2-2-2-5a7 7 0 0 1 14 0c0 3-3 5-5 6-1 1-1 3-3 4-1 1-1 3-3 3z"/></svg>;
    case "chat":
      return <svg {...props}><path d="M21 12a8 8 0 0 1-12.3 6.7L4 20l1.3-4.7A8 8 0 1 1 21 12z" /></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="8" /></svg>;
  }
};

window.Icon = Icon;
