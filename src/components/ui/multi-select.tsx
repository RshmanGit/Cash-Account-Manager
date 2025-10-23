"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

export function MultiSelect({ options, value, onChange, placeholder, disabled }: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const selectedSet = new Set(value);
    const filtered = options.filter((o) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q);
    });

    function toggle(val: string) {
        const next = new Set(selectedSet);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        onChange(Array.from(next));
    }

    function remove(val: string) {
        if (!selectedSet.has(val)) return;
        const next = value.filter((v) => v !== val);
        onChange(next);
    }

    const selectedOptions = options.filter((o) => selectedSet.has(o.value));

    return (
        <div ref={containerRef} className={`relative ${disabled ? "opacity-50" : ""}`} aria-disabled={disabled}>
            <div
                className={`flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border px-2 py-1 ${disabled ? "pointer-events-none" : ""}`}
                onClick={() => {
                    if (!disabled) {
                        setOpen(true);
                        inputRef.current?.focus();
                    }
                }}
            >
                {selectedOptions.length === 0 && (
                    <span className="text-sm text-muted-foreground">{disabled ? "Loading..." : (placeholder ?? "Select...")}</span>
                )}
                {selectedOptions.map((opt) => (
                    <span key={opt.value} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                        {opt.label}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                remove(opt.value);
                            }}
                            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/10"
                            aria-label={`Remove ${opt.label}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    className="flex-1 bg-transparent outline-none text-sm min-w-[6ch]"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => !disabled && setOpen(true)}
                    placeholder={selectedOptions.length ? "" : placeholder}
                    disabled={disabled}
                />
            </div>

            {open && !disabled && (
                <div className="absolute left-0 right-0 z-50 mt-2 max-h-60 overflow-auto rounded-md border bg-white p-1 text-sm shadow dark:bg-neutral-900">
                    {filtered.length === 0 && (
                        <div className="px-2 py-2 text-muted-foreground">No results</div>
                    )}
                    {filtered.map((opt) => {
                        const active = selectedSet.has(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggle(opt.value)}
                                className={`flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-muted ${active ? "bg-muted" : ""}`}
                            >
                                <span>{opt.label}</span>
                                {active && <span className="text-xs text-muted-foreground">Selected</span>}
                            </button>
                        );
                    })}
                    {selectedOptions.length > 0 && (
                        <div className="mt-1 flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onChange([])}
                            >
                                Clear
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


