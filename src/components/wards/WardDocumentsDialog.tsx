import { lazy, Suspense, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loading-snake";
import { useAuth } from "@/hooks/auth-context";
import { wardToCase, type WardRow } from "@/lib/care-logs";
const DocumentsHub = lazy(() => import("@/components/dashboard/DocumentsHub").then((module) => ({ default: module.DocumentsHub })));

export function WardDocumentsDialog({ ward, onClose, returnFocus }: { ward: WardRow; onClose: () => void; returnFocus: HTMLElement | null }) {
  const { user, region, isBehoerde } = useAuth();
  const [dirty, setDirty] = useState(false);
  const actor = {
    name: user?.displayName ?? "", region: region ?? "", tier: "S1" as const, joined: "", reactionMinutes: 0,
    contact: { email: user?.email ?? "", phone: "", address: "" }, capacity: { used: 0, total: 0 }, cases: [],
    certifications: [], enclosures: [], insurance: { policy: "", coverEur: 0, validUntil: "" }, vetOnCall: { name: "", phone: "" },
  };
  return <Dialog open onOpenChange={(open) => { if (!open && (!dirty || window.confirm("Nicht heruntergeladene Dokumentangaben verwerfen?"))) onClose(); }}>
    <DialogContent hideCloseButton className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0" aria-describedby={undefined}
      onCloseAutoFocus={(event) => { event.preventDefault(); (returnFocus?.isConnected ? returnFocus : document.querySelector<HTMLElement>("#main"))?.focus(); }}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background p-4">
        <DialogTitle className="min-w-0 break-words">Dokumente · {ward.case_code}</DialogTitle>
        <DialogClose asChild><Button type="button" variant="outline" size="sm">Schließen</Button></DialogClose>
      </div>
      <div data-document-scroll className="min-h-0 overflow-y-auto p-3 sm:p-6">
      <Suspense fallback={<PageLoader label="Lade Dokumente" />}>
        <DocumentsHub key={ward.id} onDirtyChange={setDirty} caseRecord={{ ...wardToCase(ward), ...(isBehoerde ? { authority: actor.name } : {}) }} sentinel={actor} />
      </Suspense>
      </div>
    </DialogContent>
  </Dialog>;
}
