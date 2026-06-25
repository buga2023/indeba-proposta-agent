"use client";

/**
 * Sistema de toast (design app.html): provider + hook + viewport.
 * Montado no layout para ficar disponível em toda a app.
 */

import * as React from "react";

type Tone = "success" | "info" | "warning" | "danger";
type Toast = { id: number; msg: string; tone: Tone };

const ToastCtx = React.createContext<(msg: string, tone?: Tone) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toast = React.useCallback((msg: string, tone: Tone = "success") => {
    const id = ++_id;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <Toaster toasts={toasts} />
    </ToastCtx.Provider>
  );
}

const COR: Record<Tone, string> = {
  success: "#16A34A",
  info: "#1257C4",
  warning: "#D97706",
  danger: "#DC2626",
};

function Toaster({ toasts }: { toasts: Toast[] }) {
  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 2000, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => {
        const c = COR[t.tone] ?? COR.success;
        return (
          <div
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: 11, background: "white", border: "1px solid var(--gray-200)", borderLeft: `3px solid ${c}`, borderRadius: 12, padding: "12px 16px", boxShadow: "0 12px 32px rgba(14,40,58,.18)", minWidth: 240, maxWidth: 360, animation: "toast-in .3s var(--ease-spring) both", fontSize: 13.5, color: "var(--gray-800)" }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flex: "none" }} />
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}
