import { useEffect, useRef } from "react";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

export default function Dialog({ open, title, onClose, children, footer, maxWidth = 420 }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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
        background: "rgba(15, 18, 15, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        animation: "fade-in-fast 0.12s ease",
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
          width: `min(${maxWidth}px, calc(100vw - 32px))`,
          padding: "22px 24px",
          boxShadow: "var(--shadow-lg)",
          fontFamily: "var(--font-display)",
          border: "1px solid var(--hairline)",
          animation: "scale-in 0.15s ease",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px",
            fontSize: 17,
            fontWeight: 600,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h3>
        <div style={{ color: "var(--ink)", fontSize: 14 }}>{children}</div>
        {footer && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--hairline)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
