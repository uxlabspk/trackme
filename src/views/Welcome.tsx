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
      <div
        aria-hidden
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          marginBottom: 18,
        }}
      >
        MyVault/
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--ink-soft)",
          }}
        >
          notes/ &nbsp;meetings/ &nbsp;todos/
        </span>
      </div>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 56,
          fontWeight: 600,
          margin: "18px 0 12px",
          color: "var(--ink)",
          letterSpacing: "-0.01em",
        }}
      >
        TrackMe
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 17,
          color: "var(--ink-soft)",
          maxWidth: 460,
          lineHeight: 1.55,
          marginBottom: 40,
        }}
      >
        Notes, recurring meetings, and todos — as plain files in a folder you
        choose. Nothing locked away, nothing to export.
      </p>

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
          padding: "13px 28px",
          cursor: "pointer",
          boxShadow: "var(--shadow-md)",
          transition: "transform 0.15s ease, background 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--moss-deep)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--moss)")}
      >
        Get Started
      </button>
    </div>
  );
}
