"use client";

import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineListener() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  if (isOffline) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10001] animate-in slide-in-from-top-4 duration-300">
        <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-red-500/50 backdrop-blur-md">
          <WifiOff className="w-5 h-5 animate-pulse" />
          <span className="font-black uppercase tracking-widest text-xs">Connessione Persa</span>
        </div>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10001] animate-in fade-in zoom-in duration-300">
        <div className="bg-green-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-green-500/50 backdrop-blur-md">
          <Wifi className="w-5 h-5" />
          <span className="font-black uppercase tracking-widest text-xs">Connessione Ripristinata</span>
        </div>
      </div>
    );
  }

  return null;
}
