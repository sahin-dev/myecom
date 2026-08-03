"use client";

import { AlertTriangle, HelpCircle, Trash2 } from "lucide-react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

export type ConfirmTone = "default" | "danger";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Promise-based replacement for `window.confirm`.
 *
 * Semantics deliberately mirror the native call — it resolves to a boolean and
 * the dialog closes on choice — so a call site swaps in one line:
 *
 *   if (!window.confirm("...")) return;      →      if (!(await confirm({...}))) return;
 *
 * Rendering goes through <Modal>, so it inherits the focus trap, Escape
 * handling, focus restoration and scroll lock the native dialog gave us for
 * free and a hand-rolled div would not.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    // A second call while one is open supersedes it; settle the first as false
    // so its awaiting caller never hangs.
    resolverRef.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const tone = options?.tone ?? "default";
  const isDanger = tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(options)}
        onClose={() => settle(false)}
        title={options?.title ?? ""}
        description={options?.description}
        size="sm"
        icon={
          <span className={`ui-modal__icon-glyph${isDanger ? " is-danger" : ""}`}>
            {isDanger ? <AlertTriangle size={19} /> : <HelpCircle size={19} />}
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={isDanger ? "danger" : "primary"}
              onClick={() => settle(true)}
              leadingIcon={isDanger ? <Trash2 size={16} /> : undefined}
            >
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used inside a ConfirmProvider.");
  return context;
}
