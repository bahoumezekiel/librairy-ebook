/**
 * Lecteur EPUB (epub.js), en pages tournées par boutons, flèches du clavier ou balayage.
 * Les scripts contenus dans le livre ne sont jamais exécutés.
 */

import ePub, { type Rendition } from "epubjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

/** Nombre de caractères par repère de progression : un compromis entre précision et calcul. */
const LOCATION_SIZE = 1200;

interface EpubViewerProps {
  data: ArrayBuffer;
  /** Progression en pourcentage, une fois les repères calculés. */
  onProgress: (percent: number) => void;
  onError: () => void;
}

const NAV_BUTTON =
  "absolute top-1/2 z-10 grid size-12 -translate-y-1/2 place-items-center bg-ink/80 text-white transition-colors duration-150 hover:bg-brand hover:text-ink";

export function EpubViewer({ data, onProgress, onError }: EpubViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const rendition = useRef<Rendition | null>(null);

  useEffect(() => {
    const book = ePub(data.slice(0));
    const view = book.renderTo(host.current!, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "auto",
      allowScriptedContent: false,
    });
    rendition.current = view;
    view.themes.default({
      body: { "font-family": "'Inter Variable', system-ui, sans-serif", "line-height": "1.65", color: "#0b1b3a" },
      // Comme pour les PDF : le texte ne se sélectionne pas.
      "*": { "user-select": "none", "-webkit-user-select": "none" },
    });

    const turn = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") void view.next();
      if (event.key === "ArrowLeft") void view.prev();
    };
    // Les touches sont reçues dans la page et dans le cadre du livre.
    document.addEventListener("keyup", turn);
    view.on("keyup", turn);
    view.on("relocated", (location: { start: { percentage: number } }) => {
      if (book.locations.length()) onProgress(Math.round(location.start.percentage * 100));
    });

    // `stopped` distingue un vrai échec de l'annulation déclenchée par le nettoyage ci-dessous :
    // `book.destroy()` fait échouer les promesses en cours, ce qui afficherait une erreur à tort.
    let stopped = false;

    view.display().catch(() => stopped || onError());
    void book.ready
      .then(() => book.locations.generate(LOCATION_SIZE))
      .then(() => {
        const location = view.currentLocation() as unknown as { start?: { percentage: number } };
        if (!stopped && location?.start) onProgress(Math.round(location.start.percentage * 100));
      })
      .catch(() => {}); // livre fermé avant la fin du calcul des repères

    return () => {
      stopped = true;
      document.removeEventListener("keyup", turn);
      book.destroy();
      rendition.current = null;
    };
  }, [data, onProgress, onError]);

  return (
    <div className="relative h-full bg-white">
      <div ref={host} className="mx-auto h-full max-w-5xl px-14 py-8 sm:px-20" />
      <button type="button" onClick={() => rendition.current?.prev()} aria-label="Page précédente" className={`${NAV_BUTTON} left-0`}>
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <button type="button" onClick={() => rendition.current?.next()} aria-label="Page suivante" className={`${NAV_BUTTON} right-0`}>
        <ChevronRight className="size-6" aria-hidden />
      </button>
    </div>
  );
}
