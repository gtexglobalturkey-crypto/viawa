/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

type TopbarSlotContextValue = {
  target: HTMLElement | null;
  setTarget: (target: HTMLElement | null) => void;
};

const TopbarSlotContext =
  createContext<TopbarSlotContextValue | null>(null);

export function TopbarSlotProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);

  return (
    <TopbarSlotContext.Provider value={value}>
      {children}
    </TopbarSlotContext.Provider>
  );
}

export function TopbarSlotOutlet() {
  const context = useContext(TopbarSlotContext);
  const setTarget = context?.setTarget;
  const registerTarget = useCallback(
    (target: HTMLDivElement | null) => setTarget?.(target),
    [setTarget],
  );

  return (
    <div
      className="topbar-route-slot"
      ref={registerTarget}
    />
  );
}

export function TopbarSlot({ children }: { children: ReactNode }) {
  const context = useContext(TopbarSlotContext);
  return context?.target ? createPortal(children, context.target) : null;
}
