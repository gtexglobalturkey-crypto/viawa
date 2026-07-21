import {
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  X,
} from "lucide-react";

import {
  ToastContext,
  type ToastType,
} from "./toastContext";

type Toast = {
  id: number;
  message: string;
  type: ToastType;
};

type Props = {
  children: ReactNode;
};

function getToastIcon(type: ToastType) {
  if (type === "success") {
    return <CheckCircle2 size={18} />;
  }

  if (type === "error") {
    return <CircleAlert size={18} />;
  }

  return <Info size={18} />;
}

export function ToastProvider({
  children,
}: Props) {
  const [toasts, setToasts] = useState<
    Toast[]
  >([]);

  const removeToast = useCallback(
    (id: number) => {
      setToasts((currentToasts) =>
        currentToasts.filter(
          (toast) => toast.id !== id,
        ),
      );
    },
    [],
  );

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
    ) => {
      const id = Date.now();

      setToasts((currentToasts) => [
        ...currentToasts,
        {
          id,
          message,
          type,
        },
      ]);

      window.setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast],
  );

  const contextValue = useMemo(
    () => ({
      showToast,
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider
      value={contextValue}
    >
      {children}

      <div
        className="toast-container"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
          >
            {getToastIcon(toast.type)}

            <span>{toast.message}</span>

            <button
              type="button"
              className="toast-close"
              aria-label="Close notification"
              onClick={() =>
                removeToast(toast.id)
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}