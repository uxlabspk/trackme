interface Props {
  onGetStarted: () => void;
}

export default function Welcome({ onGetStarted }: Props) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse 900px 500px at 50% -10%, var(--moss-soft), transparent 60%), var(--paper)",
        padding: "40px",
        textAlign: "center",
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "var(--moss)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 52,
          fontWeight: 600,
          margin: "0 0 12px",
          color: "var(--ink)",
          letterSpacing: "-0.015em",
          lineHeight: 1.1,
        }}
      >
        TrackMe
      </h1>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 16.5,
          color: "var(--ink-soft)",
          maxWidth: 420,
          lineHeight: 1.6,
          marginBottom: 36,
          margin: "0 0 36px",
        }}
      >
        Notes, recurring meetings, and todos — stored as plain files in a
        folder you own. Nothing locked away.
      </p>

      {/* Feature pills */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 40,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {["📄 Notes", "📅 Meetings", "✅ Todos", "🗂 Projects", "🤖 AI"].map((f) => (
          <span
            key={f}
            style={{
              fontSize: 12.5,
              fontFamily: "var(--font-body)",
              padding: "5px 12px",
              borderRadius: 100,
              background: "var(--paper-raised)",
              border: "1px solid var(--hairline-strong)",
              color: "var(--ink-soft)",
            }}
          >
            {f}
          </span>
        ))}
      </div>

      <button
        onClick={onGetStarted}
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          background: "var(--moss)",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "13px 32px",
          cursor: "pointer",
          boxShadow: "var(--shadow-md)",
          transition: "transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
          letterSpacing: "0.01em",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--moss-deep)";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "var(--shadow-lg)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--moss)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "var(--shadow-md)";
        }}
      >
        Get Started →
      </button>
    </div>
  );
}
