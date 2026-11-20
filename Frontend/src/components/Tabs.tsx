import { motion } from "motion/react";
import { useId } from "react";

interface TabsProps<T extends string> {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/** Onglets en pastilles : le fond de l'onglet actif glisse de l'un à l'autre. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: TabsProps<T>) {
  const markerId = useId();
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1"
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`relative h-9 shrink-0 rounded-lg px-4 text-sm transition-colors duration-150 ${
              active ? "font-bold text-brand-strong" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId={markerId}
                className="absolute inset-0 rounded-lg bg-brand-soft"
                transition={{ duration: 0.25 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
