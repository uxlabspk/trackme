import { useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Dialog({ open, title, onClose, children, footer }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 24, 20, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: "var(--paper-raised)",
          borderRadius: "var(--radius-lg)",
          width: "min(420px, calc(100vw - 32px))",
          padding: "20px 22px",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.3)",
          fontFamily: "var(--font-display)",
          border: "1px solid var(--hairline)",
        }}
      >
        <h3
          style={{
            margin: "0 0 14px",
            fontSize: 18,
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          {title}
        </h3>
        <div style={{ color: "var(--ink)", fontSize: 14 }}>{children}</div>
        {footer ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 20,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
