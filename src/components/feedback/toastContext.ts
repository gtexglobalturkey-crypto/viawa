import {
  createContext,
  useContext,
} from "react";

export type ToastType =
  | "success"
  | "error"
  | "info";

type ToastContextValue = {
  showToast: (
    message: string,
    type?: ToastType,
  ) => void;
};

export const ToastContext =
  createContext<ToastContextValue>({
    showToast: () => {},
  });

export function useToast() {
  return useContext(ToastContext);
}