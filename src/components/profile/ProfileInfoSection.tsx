import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  HelpCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { SupportEmailGate } from "@/components/support/SupportEmailGate";

export function ProfileInfoSection() {
  const repoUrl = process.env.NEXT_PUBLIC_REPOSITORY_URL || "";

  return (
    <div className="space-y-6">
      <section
        data-testid="profile-support-docs-section"
        className="bg-card p-6 rounded-3xl border border-border shadow-flat space-y-5"
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle className="size-5 text-primary shrink-0" />
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
              Supporto, Info &amp; Documenti
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Canali statici di contatto e informative legali dell&apos;app.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-primary shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Supporto &amp; Segnalazione Problemi
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Nessun form server né raccolta automatica di dati: completa la rapida verifica anti-bot su richiesta per sbloccare il recapito email di assistenza.
              </p>
            </div>

            <div className="space-y-3">
              <SupportEmailGate variant="card" />
              {repoUrl && (
                <div>
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-card hover:bg-muted border border-border text-foreground text-xs font-black uppercase tracking-wider flat-press inline-flex items-center gap-1.5"
                  >
                    Repository <ExternalLink className="size-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Documentazione Legale
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { href: "/privacy-policy", label: "Privacy Policy" },
              { href: "/cookie-policy", label: "Cookie & Storage Policy" },
              { href: "/terms", label: "Termini di Servizio" },
            ].map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className="min-h-[44px] flex items-center justify-between p-3.5 bg-muted/50 hover:bg-primary/10 border border-border hover:border-primary/30 rounded-2xl transition-colors group flat-press"
              >
                <span className="text-xs font-bold text-foreground">{doc.label}</span>
                <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-label="Informazioni su privacy e backup locale"
        className="bg-card p-5 rounded-3xl border border-border shadow-flat flex items-start gap-3"
      >
        <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="size-4" />
        </div>
        <p className="text-xs text-muted-foreground font-medium leading-relaxed">
          Tutti i dati di KebApps restano sul tuo dispositivo: nessun account, nessun tracciamento, export/import completo in JSON e revoca immediata dei consensi mappa o GPS.
        </p>
      </section>
    </div>
  );
}
