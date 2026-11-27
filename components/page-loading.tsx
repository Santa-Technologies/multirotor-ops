import { Loader2Icon } from "lucide-react";

/** Route-level loading shell shown immediately on navigation via loading.tsx. */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center gap-3 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2Icon className="size-6 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}
