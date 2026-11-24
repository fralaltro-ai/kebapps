"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  HardDrive,
  Trash2,
  Upload,
} from "lucide-react";
import { notifyLocalDataChanged } from "@/components/diary/DiaryEntryModal";
import { SectionInfoButton } from "@/components/ui/SectionInfoButton";
import { useToast } from "@/context/ToastContext";
import { triggerHaptic } from "@/lib/haptics";
import {
  estimateLocalStorageUsage,
  formatBytes,
  importBackupData,
  parseAndValidateBackupJson,
  resetAllLocalData,
  serializeBackupJson,
  type BackupImportMode,
  type LocalStorageUsageEstimate,
} from "@/lib/local-storage/backup";
import type { BackupBundle } from "@/lib/local-storage/schema";
import { cn } from "@/lib/utils";

interface PendingBackupPreview {
  rawJson: string;
  bundle: BackupBundle;
}

export default function ProfileDataClient() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [storageEstimate, setStorageEstimate] = useState<LocalStorageUsageEstimate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<PendingBackupPreview | null>(null);
  const [importMode, setImportMode] = useState<BackupImportMode>("replace");
  const [isImporting, setIsImporting] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadStorageUsage = useCallback(async () => {
    const usage = await estimateLocalStorageUsage();
    setStorageEstimate(usage);
  }, []);

  useEffect(() => {
    void loadStorageUsage();
    const handleSync = () => {
      void loadStorageUsage();
    };
    window.addEventListener("kebapps:local-data-changed", handleSync);
    return () => window.removeEventListener("kebapps:local-data-changed", handleSync);
  }, [loadStorageUsage]);

  const handleExportBackup = async () => {
    triggerHaptic("light");
    try {
      const json = await serializeBackupJson(new Date(), true);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `kebapps-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toastSuccess("Backup JSON esportato!");
    } catch {
      toastError("Errore durante l'esportazione del backup.");
    }
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseAndValidateBackupJson(text);
      if (!parsed.success) {
        toastError(parsed.error);
        return;
      }
      setImportMode("replace");
      setPendingBackup({ rawJson: text, bundle: parsed.data });
    } catch {
      toastError("Impossibile leggere il file selezionato.");
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingBackup || isImporting) return;
    setIsImporting(true);
    try {
      const res = await importBackupData(pendingBackup.rawJson, { mode: importMode });
      if (!res.success) {
        toastError(res.error || "Errore durante l'importazione.");
        return;
      }
      setPendingBackup(null);
      notifyLocalDataChanged();
      await loadStorageUsage();
      toastSuccess(
        `Backup importato: ${res.imported?.diaryCount ?? 0} visite e ${res.imported?.wishlistCount ?? 0} in wishlist.`
      );
    } catch {
      toastError("Errore durante l'importazione del backup.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmResetAll = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await resetAllLocalData();
      setShowResetConfirm(false);
      notifyLocalDataChanged();
      await loadStorageUsage();
      toastSuccess("Tutti i dati locali sono stati cancellati.");
    } catch {
      toastError("Errore durante la cancellazione dei dati locali.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <section className="bg-card p-6 rounded-3xl border border-border shadow-flat space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <HardDrive className="size-5 text-primary" />
          <h2 className="text-lg font-black text-foreground uppercase tracking-tight">
            Dati &amp; Privacy Locale
          </h2>
        </div>
        <SectionInfoButton
          title="Dati & Privacy Locale"
          subtitle="Archiviazione IndexedDB, esportazione e ripristino sicuro."
          buttonSize="sm"
          items={[
            {
              label: "Spazio Occupato Stimato",
              description:
                "Calcolato analizzando i byte serializzati in IndexedDB per profilo, diario, wishlist e cache mappa locale.",
            },
            {
              label: "Unisci (Merge) vs Sostituisci (Replace)",
              description:
                "Unisci (Merge) conserva i record locali esistenti e aggiunge le nuove voci dal backup. Sostituisci (Replace) sovrascrive completamente il database locale con il contenuto del file.",
            },
            {
              label: "Cache Mappa Esclusa",
              description:
                "La cache delle ricerche mappa ha validità effimera di 24 ore e viene sempre esclusa dai file di backup JSON per minimizzare il peso del file e rispettare i termini cartografici.",
            },
          ]}
        />
      </div>

      <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2">
        <div className="flex items-center justify-between text-xs font-black">
          <span className="uppercase tracking-wider text-muted-foreground">
            Spazio Occupato Stimato
          </span>
          <span data-testid="storage-usage-total" className="text-foreground">
            {storageEstimate ? formatBytes(storageEstimate.totalBytes) : "–"}
          </span>
        </div>
        {storageEstimate && (
          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground font-medium">
            <span>Diario ({storageEstimate.stores.diary.count}): {formatBytes(storageEstimate.stores.diary.bytes)}</span>
            <span>Wishlist ({storageEstimate.stores.wishlist.count}): {formatBytes(storageEstimate.stores.wishlist.bytes)}</span>
            <span>Profilo: {formatBytes(storageEstimate.stores.profile.bytes)}</span>
            <span>Cache Mappa ({storageEstimate.stores.mapCache.count}): {formatBytes(storageEstimate.stores.mapCache.bytes)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          data-testid="export-backup-btn"
          onClick={() => void handleExportBackup()}
          className="min-h-[44px] py-3 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-wider shadow-flat flat-press inline-flex items-center justify-center gap-2"
        >
          <Download className="size-4" />
          Esporta Backup JSON
        </button>

        <button
          type="button"
          data-testid="import-backup-trigger"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[44px] py-3 px-4 rounded-2xl bg-card hover:bg-muted border border-border text-foreground font-black text-xs uppercase tracking-wider shadow-sm flat-press inline-flex items-center justify-center gap-2"
        >
          <Upload className="size-4 text-primary" />
          Importa Backup JSON
        </button>

        <input
          ref={fileInputRef}
          data-testid="import-backup-input"
          type="file"
          accept=".json,application/json"
          onChange={(e) => void handleBackupFileSelected(e)}
          className="sr-only"
          aria-label="Seleziona file backup JSON"
        />
      </div>

      {/* Conferma Importazione */}
      {pendingBackup && (
        <div
          data-testid="import-confirm-box"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3"
        >
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-wider text-foreground">
              Conferma Importazione Backup
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              Profilo: <strong>{pendingBackup.bundle.data.profile.nickname}</strong> ·{" "}
              {pendingBackup.bundle.data.diary.length} visite ·{" "}
              {pendingBackup.bundle.data.wishlist.length} in wishlist.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="import-mode-replace"
              onClick={() => setImportMode("replace")}
              className={cn(
                "min-h-[40px] py-2 px-3 rounded-xl border text-[11px] font-black uppercase tracking-wider flat-press",
                importMode === "replace"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border"
              )}
            >
              Sovrascrivi Tutto
            </button>
            <button
              type="button"
              data-testid="import-mode-merge"
              onClick={() => setImportMode("merge")}
              className={cn(
                "min-h-[40px] py-2 px-3 rounded-xl border text-[11px] font-black uppercase tracking-wider flat-press",
                importMode === "merge"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border"
              )}
            >
              Unisci ai Dati
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              data-testid="confirm-import-btn"
              disabled={isImporting}
              onClick={() => void handleConfirmImport()}
              className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider flat-press"
            >
              {isImporting ? "Importazione..." : "Conferma Importazione"}
            </button>
            <button
              type="button"
              onClick={() => setPendingBackup(null)}
              className="min-h-[44px] py-2.5 px-3 rounded-xl bg-card border border-border text-xs font-bold text-muted-foreground"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Reset Dati Locali con conferma esplicita */}
      <div className="pt-2 border-t border-border space-y-2.5">
        {!showResetConfirm ? (
          <button
            type="button"
            data-testid="reset-all-data-btn"
            onClick={() => {
              triggerHaptic("medium");
              setShowResetConfirm(true);
            }}
            className="w-full min-h-[44px] flex items-center justify-between p-3.5 bg-destructive/10 hover:bg-destructive/15 rounded-2xl border border-destructive/25 text-destructive transition-all flat-press"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="size-4" />
              <span className="text-xs font-black uppercase tracking-wider">
                Cancella tutti i dati locali
              </span>
            </div>
            <ChevronRight className="size-4" />
          </button>
        ) : (
          <div
            data-testid="reset-confirm-box"
            className="p-4 rounded-2xl bg-destructive/10 border border-destructive/35 space-y-3"
          >
            <div className="flex items-start gap-2.5 text-destructive">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">
                Operazione irreversibile: verranno eliminati profilo locale, Diario, Wishlist, cache mappa e consensi (mantenendo solo il tema grafico del dispositivo e gli asset statici dell&apos;app).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="confirm-reset-all-btn"
                disabled={isResetting}
                onClick={() => void handleConfirmResetAll()}
                className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-destructive text-destructive-foreground text-xs font-black uppercase tracking-wider flat-press"
              >
                {isResetting ? "Cancellazione..." : "Conferma cancellazione totale"}
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="min-h-[44px] py-2.5 px-3 rounded-xl bg-card border border-border text-xs font-bold text-foreground"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
