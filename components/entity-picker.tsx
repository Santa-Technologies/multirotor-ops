"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_ENTITY_PAGE_SIZE,
  type EntityOption,
  type EntitySearchResult,
  type EntityType,
} from "@/lib/entities/types";

type EntityPickerProps = {
  type: EntityType;
  name: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  value?: string;
  /** Shown when a known option is preselected (e.g. deal prefill). */
  initialLabel?: string;
  companyId?: string;
  pipelineId?: number;
  placeholder?: string;
  onChange?: (option: EntityOption | null) => void;
};

/**
 * Searchable paginated entity combobox. Loads `/api/entities/{type}` on open
 * with q/page/pageSize=25 — never takes a full options array as props.
 */
export function EntityPicker({
  type,
  name,
  label,
  required = false,
  disabled = false,
  value: controlledValue,
  initialLabel = "",
  companyId,
  pipelineId,
  placeholder = "Search…",
  onChange,
}: EntityPickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<EntitySearchResult | null>(null);
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(
    controlledValue
      ? { id: controlledValue, label: initialLabel || controlledValue }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Prefer the latest controlled value when the parent drives selection (cascade).
  const selectedId = controlledValue !== undefined ? controlledValue : (picked?.id ?? "");
  const selectedLabel =
    controlledValue !== undefined && controlledValue === picked?.id
      ? picked.label || initialLabel || controlledValue
      : controlledValue !== undefined
        ? initialLabel || controlledValue
        : (picked?.label ?? "");

  const load = useCallback(
    (nextQ: string, nextPage: number) => {
      startTransition(async () => {
        setError(null);
        const params = new URLSearchParams({
          q: nextQ,
          page: String(nextPage),
          pageSize: String(DEFAULT_ENTITY_PAGE_SIZE),
        });
        if (companyId) params.set("companyId", companyId);
        if (pipelineId != null) params.set("pipelineId", String(pipelineId));
        try {
          const res = await fetch(`/api/entities/${type}?${params.toString()}`);
          if (!res.ok) {
            setError("Could not load options.");
            return;
          }
          const data = (await res.json()) as EntitySearchResult;
          setResult(data);
        } catch {
          setError("Could not load options.");
        }
      });
    },
    [companyId, pipelineId, type],
  );

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => load(q, page), 200);
    return () => window.clearTimeout(handle);
  }, [open, q, page, load]);

  function onQueryChange(next: string) {
    setQ(next);
    setPage(1);
  }

  function select(option: EntityOption) {
    setPicked({ id: option.id, label: option.label });
    setOpen(false);
    onChange?.(option);
  }

  function clear() {
    setPicked(null);
    onChange?.(null);
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor={`${listId}-trigger`}>{label}</Label>
      <input type="hidden" name={name} value={selectedId} required={required} />
      <Button
        id={`${listId}-trigger`}
        type="button"
        variant="outline"
        disabled={disabled}
        className="h-8 w-full justify-between font-normal"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setPage(1);
        }}
      >
        <span className="truncate text-left">
          {selectedLabel || placeholder}
        </span>
        <span className="text-xs text-muted-foreground">{open ? "▴" : "▾"}</span>
      </Button>
      {open ? (
        <div
          className="absolute top-full z-40 mt-1 w-full rounded-lg border bg-popover p-2 shadow-md"
          role="listbox"
          id={listId}
        >
          <Input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="mb-2"
          />
          {error ? <p className="px-1 text-xs text-destructive">{error}</p> : null}
          {pending && !result ? (
            <p className="px-1 text-xs text-muted-foreground">Loading…</p>
          ) : null}
          <ul className="max-h-48 overflow-y-auto">
            {!required ? (
              <li>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                  onClick={clear}
                >
                  — None —
                </button>
              </li>
            ) : null}
            {(result?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => select(item)}
                >
                  {item.label}
                </button>
              </li>
            ))}
            {result && result.items.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">No matches.</li>
            ) : null}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={page <= 1 || pending}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {result?.page ?? page}
              {result ? ` · ${result.total.toLocaleString("de-DE")}` : ""}
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={!result?.hasMore || pending}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
