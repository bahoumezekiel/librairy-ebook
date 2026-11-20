import { CircleAlert, CircleCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

type Tone = "success" | "error";
interface ToastMessage {
  id: number;
  tone: Tone;
  text: string;
}

const DISPLAY_MS = 4000;
const TONES = {
  success: { icon: CircleCheck, className: "text-leaf-strong" },
  error: { icon: CircleAlert, className: "text-danger" },
};

const ToastContext = createContext<(tone: Tone, text: string) => void>(() => {});

/** Affiche un message bref en bas de l'écran : `const toast = useToast(); toast("success", "…")`. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const show = useCallback((tone: Tone, text: string) => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current, { id, tone, text }]);
    setTimeout(() => setMessages((current) => current.filter((m) => m.id !== id)), DISPLAY_MS);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
        aria-live="polite"
      >
        <AnimatePresence>
          {messages.map(({ id, tone, text }) => {
            const { icon: Icon, className } = TONES[tone];
            return (
              <motion.p
                key={id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.25 }}
                className="flex max-w-sm items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold shadow-lg"
              >
                <Icon className={`size-5 shrink-0 ${className}`} aria-hidden />
                {text}
              </motion.p>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext>
  );
}
