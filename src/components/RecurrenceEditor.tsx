import type { Freq, Recurrence } from "../lib/types";

interface Props {
  value: Recurrence;
  onChange: (next: Recurrence) => void;
}

const FREQ_OPTIONS: { id: Freq; label: string }[] = [
  { id: "once", label: "Once" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const DAYS: { id: string; label: string }[] = [
  { id: "mon", label: "M" },
  { id: "tue", label: "T" },
  { id: "wed", label: "W" },
  { id: "thu", label: "T" },
  { id: "fri", label: "F" },
  { id: "sat", label: "S" },
  { id: "sun", label: "S" },
];

function fieldLabelStyle(): React.CSSProperties {
  return {
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: "var(--ink-soft)",
    textTransform: "uppercase",
    display: "block",
    marginBottom: 6,
  };
}

export default function RecurrenceEditor({ value, onChange }: Props) {
  function set<K extends keyof Recurrence>(key: K, val: Recurrence[K]) {
    onChange({ ...value, [key]: val });
  }

  function toggleDay(day: string) {
    const has = value.days.includes(day);
    set("days", has ? value.days.filter((d) => d !== day) : [...value.days, day]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={fieldLabelStyle()}>Repeats</label>
        <div style={{ display: "flex", gap: 6 }}>
          {FREQ_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => set("freq", opt.id)}
              style={{
                padding: "7px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--hairline-strong)",
                background: value.freq === opt.id ? "var(--clay)" : "var(--paper-raised)",
                color: value.freq === opt.id ? "#fff" : "var(--ink)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {value.freq === "weekly" && (
        <div>
          <label style={fieldLabelStyle()}>On these days</label>
          <div style={{ display: "flex", gap: 4 }}>
            {DAYS.map((d) => {
              const active = value.days.includes(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDay(d.id)}
                  title={d.id}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "1px solid var(--hairline-strong)",
                    background: active ? "var(--clay)" : "var(--paper-raised)",
                    color: active ? "#fff" : "var(--ink)",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.freq !== "once" && (
        <div>
          <label style={fieldLabelStyle()}>
            Every N {value.freq === "daily" ? "day(s)" : value.freq === "weekly" ? "week(s)" : "month(s)"}
          </label>
          <input
            type="number"
            min={1}
            value={value.interval}
            onChange={(e) => set("interval", Math.max(1, Number(e.target.value) || 1))}
            style={{
              width: 80,
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--hairline-strong)",
              fontSize: 14,
              background: "var(--paper-raised)",
              color: "var(--ink)",
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle()}>Start date</label>
          <input
            type="date"
            value={value.start_date ?? ""}
            onChange={(e) => set("start_date", e.target.value || null)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--hairline-strong)",
              fontSize: 14,
              fontFamily: "var(--font-mono)",
              background: "var(--paper-raised)",
              color: "var(--ink)",
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabelStyle()}>End date (optional)</label>
          <input
            type="date"
            value={value.end_date ?? ""}
            onChange={(e) => set("end_date", e.target.value || null)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--hairline-strong)",
              fontSize: 14,
              fontFamily: "var(--font-mono)",
              background: "var(--paper-raised)",
              color: "var(--ink)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
