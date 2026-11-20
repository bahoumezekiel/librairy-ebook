interface LogoProps {
  className?: string;
  /** Sur fond bleu nuit : « Faso » passe en blanc. */
  onDark?: boolean;
}

/** Logo FasoLib : le nom en gras, « Faso » en bleu nuit (ou blanc) et « Lib » en orange. */
export function Logo({ className = "text-2xl", onDark = false }: LogoProps) {
  return (
    <span className={`font-bold tracking-tight ${className}`} aria-label="FasoLib">
      <span className={onDark ? "text-white" : "text-ink"}>Faso</span>
      <span className="text-brand">Lib</span>
    </span>
  );
}
