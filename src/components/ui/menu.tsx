"use client";

import * as React from "react";

interface MenuProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
}

export function Menu({ trigger, children }: MenuProps) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!ref.current) return;
            if (!ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    return (
        <div ref={ref} className="relative inline-block text-left z-50">
            <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-muted">
                {trigger}
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-40 origin-top-right rounded-md border bg-white dark:bg-neutral-900 shadow focus:outline-none z-[60]">
                    <div className="py-1">{children}</div>
                </div>
            )}
        </div>
    );
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export function MenuItem({ children, className = "", ...rest }: MenuItemProps) {
    return (
        <button
            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}


