import { ShieldAlert, UserCheck } from "lucide-react";

const PLACEHOLDER_CONTROLLER_NAMES = new Set([
  "",
  "kebapps",
  "team kebapps",
  "nome cognome",
]);

export function getControllerIdentityConfig() {
  const rawName = (process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME || "").trim();
  const location = (process.env.NEXT_PUBLIC_DATA_CONTROLLER_LOCATION || "Italia").trim();
  const supportEmail = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@kebapps.app").trim();
  const isConfigured =
    Boolean(rawName) && !PLACEHOLDER_CONTROLLER_NAMES.has(rawName.toLowerCase());

  return {
    controllerName: rawName,
    location,
    supportEmail,
    isConfigured,
  };
}

export function ControllerIdentityNotice() {
  const { controllerName, location, supportEmail, isConfigured } = getControllerIdentityConfig();

  return (
    <div
      data-testid="controller-identity-notice"
      className="mb-6 rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-foreground font-quicksand"
    >
      <div className="flex items-start gap-2.5">
        {isConfigured ? (
          <UserCheck className="size-4 text-primary shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <p className="font-black uppercase tracking-wider text-[11px] text-foreground">
            Titolare del Trattamento — Istanza Ufficiale (Art. 13 GDPR)
          </p>
          {isConfigured ? (
            <p className="text-muted-foreground font-medium">
              <strong className="text-foreground">{controllerName}</strong> ({location}) · Contatto diretto:{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="text-primary font-bold hover:underline"
              >
                {supportEmail}
              </a>
            </p>
          ) : (
            <p className="text-muted-foreground font-medium">
              Istanza locale/open-source senza titolare pubblico configurato. Prima del deploy online su dominio pubblico è obbligatorio impostare{" "}
              <code>NEXT_PUBLIC_DATA_CONTROLLER_NAME</code> con nome e cognome reali del titolare e{" "}
              <code>NEXT_PUBLIC_DATA_CONTROLLER_LOCATION</code> con città e provincia di residenza (es. &quot;Milano (MI), Italia&quot;). Contatto:{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="text-primary font-bold hover:underline"
              >
                {supportEmail}
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
