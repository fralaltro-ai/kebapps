import type { Metadata } from "next";
import OfflineClient from "./OfflineClient";

export const metadata: Metadata = {
  description: "Consultazione offline dei dati locali salvati su KebApps.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflinePage() {
  return <OfflineClient />;
}
