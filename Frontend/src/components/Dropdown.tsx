import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface DropdownProps {
  /** Bouton qui ouvre le menu ; il reçoit l'état ouvert / fermé. */
  trigger: (open: boolean) => ReactNode;
  label: string;
  /** Contenu du menu ; `close` le referme, par exemple après un clic sur un lien. */
  children: (close: () => void) => ReactNode;
  onOpen?: () => void;
  className?: string;
}

/** Menu déroulant aligné à droite, fermé par un clic à l'extérieur ou la touche Échap. */
export function Dropdown({ trigger, label, children, onOpen, className = "w-64" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) =>
      !container.current?.contains(event.target as Node) && setOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen(!open);
  };

  return (
    <div ref={container} className="relative">
      <button type="button" onClick={toggle} aria-label={label} aria-expanded={open} className="block rounded-xl">
        {trigger(open)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`absolute right-0 top-full z-30 mt-3 origin-top-right overflow-hidden rounded-2xl border border-line bg-white shadow-lift ${className}`}
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
