import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface ProfileSubpageHeaderProps {
  title: string;
  subtitle?: string;
}

export function ProfileSubpageHeader({ title, subtitle }: ProfileSubpageHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        href="/profile"
        className="inline-flex items-center min-h-[40px] text-sm font-bold text-muted-foreground hover:text-primary gap-2 transition-colors flat-press"
      >
        <ArrowLeft className="size-4" />
        <span>Torna al Profilo</span>
      </Link>
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
