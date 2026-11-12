import { Button } from "@/components/ui/button";

export function AppFeedback({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return <div role="alert" className="my-6 border border-destructive/40 bg-surface p-6">
    <p className="font-display text-xl">{title}</p>
    <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Erneut versuchen</Button>}
  </div>;
}
