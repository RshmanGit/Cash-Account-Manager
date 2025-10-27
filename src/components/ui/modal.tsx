"use client";

import * as React from "react";
import { X } from "lucide-react";

interface ModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export function Modal({ open, onOpenChange, title, description, children, footer }: ModalProps) {
    React.useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onOpenChange(false);
        }
        if (open) document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onOpenChange]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
            <div className="relative z-10 w-full h-full md:h-auto md:max-w-lg md:rounded-lg bg-white dark:bg-neutral-900 shadow-lg flex flex-col md:max-h-[90vh]">
                <div className="p-4 border-b flex items-start justify-between gap-4 shrink-0">
                    <div className="flex-1 min-w-0">
                        {title && <h2 className="text-lg font-semibold truncate">{title}</h2>}
                        {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="shrink-0 rounded-md p-2 hover:bg-muted transition-colors touch-manipulation"
                        aria-label="Close"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto flex-1">{children}</div>
                {footer && <div className="p-4 border-t flex justify-end gap-2 shrink-0">{footer}</div>}
            </div>
        </div>
    );
}


