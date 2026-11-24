"use client";

/**
 * Google Maps Platform Attribution — Google ToS Compliance
 *
 * Light surfaces use the official white-surface logo (`google_on_white.png`).
 * Dark surfaces use the official reverse dark-surface logo (`google_on_dark.png`).
 * Reference: https://developers.google.com/maps/documentation/javascript/policies
 */
export function GoogleAttribution({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-medium ${className}`}>
      <span>Powered by</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/google_on_white.png"
        alt="Google"
        className="h-3 inline-block dark:hidden"
        width={48}
        height={12}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/google_on_dark.png"
        alt="Google"
        className="h-3 hidden dark:inline-block"
        width={48}
        height={12}
      />
    </div>
  );
}

