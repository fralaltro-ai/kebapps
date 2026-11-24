"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((msg: string) => toast(msg, "success"), [toast]);
  const error = useCallback((msg: string) => toast(msg, "error"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div 
        className="fixed z-[200] flex flex-col gap-3 w-full max-w-[92%] sm:max-w-sm px-4 pointer-events-none 
        left-1/2 -translate-x-1/2 
        sm:bottom-8 sm:top-auto sm:right-8 sm:left-auto sm:translate-x-0"
        style={{ bottom: "calc(5rem + var(--safe-b, 0px))" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              p-4 rounded-2xl shadow-dropdown border pointer-events-auto bg-white
              animate-in fade-in slide-in-from-bottom-8 duration-300 ease-out
              ${t.type === "success" ? "border-emerald-200 text-stone-900" : ""}
              ${t.type === "error" ? "border-red-200 text-stone-900" : ""}
              ${t.type === "info" ? "border-gray-200 text-stone-900" : ""}
              ${t.type === "warning" ? "border-amber-200 text-stone-900" : ""}
            `}
          >
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 flex items-center justify-center size-8 rounded-xl border
                ${t.type === "success" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : ""}
                ${t.type === "error" ? "bg-red-50 text-red-600 border-red-100" : ""}
                ${t.type === "info" ? "bg-gray-50 text-gray-500 border-gray-100" : ""}
                ${t.type === "warning" ? "bg-amber-50 text-amber-600 border-amber-100" : ""}
              `}>
                {t.type === "success" && <CheckCircle className="size-4" />}
                {t.type === "error" && <XCircle className="size-4" />}
                {t.type === "info" && <Info className="size-4" />}
                {t.type === "warning" && <AlertTriangle className="size-4" />}
              </div>
              <p className="font-bold text-sm leading-tight font-quicksand">{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
