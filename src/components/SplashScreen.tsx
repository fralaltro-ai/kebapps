"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    // Start fade out after 1.5s
    const timer = setTimeout(() => {
      setIsAnimatingOut(true);
      // Wait for fade out animation to finish before unmounting (500ms)
      setTimeout(() => {
        setIsVisible(false);
      }, 500);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${isAnimatingOut ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
    >
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700 ease-out">
        <div className="size-24 flex items-center justify-center">
          <Image 
            src="/logo.svg" 
            alt="KebApps Logo" 
            width={96} 
            height={96} 
            className="w-full h-full drop-shadow-sm"
            priority
          />
        </div>
        <span className="text-4xl font-black tracking-tight text-foreground font-quicksand whitespace-nowrap">
          Keb<span className="text-primary">Apps</span>
        </span>
      </div>
    </div>
  );
}
