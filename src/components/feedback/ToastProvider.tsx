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
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
    ) => {
      const id = Date.now();

      setToasts((current) => [
        ...current,
        {
          id,
          message,
          type,
        },
      ]);

      window.setTimeout(() => {
        setToasts((current) =>
          current.filter(
            (toast) => toast.id !== id,
          ),
        );
      }, 3500);
    },
    [],
  );

  const value = useMemo(
    () => ({
      showToast,
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
          >
            {getToastIcon(toast.type)}

            <span>{toast.message}</span>

            <button
              type="button"
              onClick={() =>
                setToasts((current) =>
                  current.filter(
                    (item) =>
                      item.id !== toast.id,
                  ),
                )
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}