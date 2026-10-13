"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Laptop, Moon, Sun } from "lucide-react";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun, desc: "Tema terang bersih" },
  { value: "dark", label: "Dark", icon: Moon, desc: "Tema gelap lembut" },
  { value: "system", label: "System", icon: Laptop, desc: "Ikuti tema perangkat" },
];

/**
 * Theme toggle supporting Light, Dark, and System (auto-adapt to device).
 * - `variant="dropdown"` (default) renders a button with a floating menu.
 * - `variant="segmented"` renders a full-width 3-way toggle (ideal for mobile menu).
 */
export default function ThemeToggle({ variant = "dropdown", className = "" }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Avoid hydration mismatch by rendering a stable placeholder
  if (!mounted) {
    if (variant === "segmented") {
      return (
        <div className={`grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/50 p-1 ${className}`}>
          {THEME_OPTIONS.map((opt) => (
            <div
              key={opt.value}
              className="flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground"
            >
              <opt.icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground ${className}`}
        aria-hidden="true"
      >
        <Sun className="h-4 w-4 opacity-50" />
      </div>
    );
  }

  // Segmented mode (mobile menu)
  if (variant === "segmented") {
    return (
      <div
        role="radiogroup"
        aria-label="Pilih tema tampilan"
        className={`grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/60 p-1 ${className}`}
      >
        {THEME_OPTIONS.map((opt) => {
          const isSelected = theme === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setTheme(opt.value)}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                isSelected
                  ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 ${
                  isSelected ? "text-primary" : "text-muted-foreground"
                }`}
                aria-hidden="true"
              />
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Active icon determination for dropdown trigger button
  const ActiveIcon =
    theme === "system"
      ? Laptop
      : resolvedTheme === "dark"
      ? Moon
      : Sun;

  const currentLabel =
    THEME_OPTIONS.find((opt) => opt.value === theme)?.label || "Theme";

  return (
    <div ref={menuRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Ganti tema tampilan (saat ini: ${currentLabel})`}
        title={`Tema: ${currentLabel}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ActiveIcon className="h-4 w-4 text-foreground transition-transform duration-200" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="animate-in fade-in zoom-in-95 absolute right-0 z-50 mt-1.5 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg backdrop-blur-sm focus:outline-none"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tema Tampilan
          </div>
          {THEME_OPTIONS.map((opt) => {
            const isSelected = theme === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(opt.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors duration-150 ${
                  isSelected
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`h-4 w-4 ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{opt.label}</span>
                </div>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
