import Link from "next/link";
import { Compass, Home, Map } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 animate-in fade-in duration-500 font-quicksand">
      <div className="max-w-md w-full bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-flat text-center space-y-6">
        {/* Visual Badge */}
        <div className="size-16 sm:size-20 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Compass className="size-8 sm:size-10 animate-pulse" />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-muted text-muted-foreground border border-border">
            Errore 404 • Fuori Rotta 🥙
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Kebab non trovato!
          </h1>
          <p className="text-sm text-muted-foreground font-medium max-w-sm mx-auto">
            Sembra che questo spiedo non sia sulla griglia. La pagina richiesta potrebbe essere stata spostata, rimossa o non è mai esistita.
          </p>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest py-3.5 px-4 rounded-xl shadow-flat transition-all flat-press hover:bg-primary/90"
          >
            <Home className="size-4" />
            Torna alla Home
          </Link>
          <Link
            href="/map"
            className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground font-black text-xs uppercase tracking-widest py-3.5 px-4 rounded-xl border border-border transition-all flat-press hover:bg-secondary/80"
          >
            <Map className="size-4" />
            Mappa Locali
          </Link>
        </div>
      </div>
    </div>
  );
}
