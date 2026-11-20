/**
 * Lecteur PDF : les pages sont dessinées dans des `canvas` au fil du défilement.
 *
 * Seules les pages proches de l'écran sont dessinées ; les autres sont libérées pour
 * ménager la mémoire des téléphones. Aucune couche de texte n'est créée : le texte
 * ne peut pas être sélectionné ni copié.
 */

import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { memo, useCallback, useEffect, useRef, useState } from "react";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Marge autour de l'écran dans laquelle une page est dessinée à l'avance. */
const PRELOAD_MARGIN = "1200px 0px";

interface PageProps {
  document: PDFDocumentProxy;
  number: number;
  /** Largeur d'affichage de la page, en pixels CSS. */
  width: number;
  /** Proportion hauteur / largeur, pour réserver la place avant le dessin. */
  ratio: number;
  onVisible: (number: number) => void;
}

/** Mémorisée : changer de page lue ne redessine pas les autres pages. */
const Page = memo(function Page({ document, number, width, ratio, onVisible }: PageProps) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [nearScreen, setNearScreen] = useState(false);

  // Dessin à l'approche de l'écran, libération quand la page s'en éloigne.
  useEffect(() => {
    const element = frame.current!;
    const preload = new IntersectionObserver(([entry]) => setNearScreen(entry.isIntersecting), {
      rootMargin: PRELOAD_MARGIN,
    });
    // Page « en cours » : celle qui occupe le milieu de l'écran.
    const current = new IntersectionObserver(([entry]) => entry.isIntersecting && onVisible(number), {
      rootMargin: "-50% 0px -50% 0px",
    });
    preload.observe(element);
    current.observe(element);
    return () => {
      preload.disconnect();
      current.disconnect();
    };
  }, [number, onVisible]);

  useEffect(() => {
    const target = canvas.current!;
    if (!nearScreen || !width) {
      target.width = target.height = 0;
      return;
    }
    let cancel = () => {};
    let stopped = false;
    void document.getPage(number).then((page) => {
      if (stopped) return;
      const scale = width / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale: scale * window.devicePixelRatio });
      target.width = Math.floor(viewport.width);
      target.height = Math.floor(viewport.height);
      const task = page.render({ canvas: target, viewport });
      cancel = () => task.cancel();
      task.promise.catch(() => {}); // rendu annulé par un changement de zoom ou un défilement rapide
    });
    return () => {
      stopped = true;
      cancel();
    };
  }, [document, number, width, nearScreen]);

  return (
    <div
      ref={frame}
      className="relative mx-auto bg-white shadow-lift"
      style={{ width, height: width * ratio }}
      data-page={number}
    >
      <canvas ref={canvas} className="block size-full" />
      {!nearScreen && (
        <span className="absolute inset-0 grid place-items-center text-sm text-muted">Page {number}</span>
      )}
    </div>
  );
});

interface PdfViewerProps {
  data: ArrayBuffer;
  /** 1 = largeur de lecture confortable ; plus grand pour zoomer. */
  zoom: number;
  onProgress: (page: number, pages: number) => void;
  onError: () => void;
}

/** Mémorisé : la barre du lecteur se met à jour à chaque page sans redessiner le livre. */
export const PdfViewer = memo(function PdfViewer({ data, zoom, onProgress, onError }: PdfViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [width, setWidth] = useState(0);
  const pages = document?.numPages ?? 0;
  const onVisible = useCallback((page: number) => onProgress(page, pages), [onProgress, pages]);

  useEffect(() => {
    // Copie : PDF.js transfère les octets à son processus de travail, le tampon d'origine serait vidé.
    const task = getDocument({ data: new Uint8Array(data.slice(0)) });
    // `stopped` distingue un vrai échec de l'annulation déclenchée par le nettoyage ci-dessous :
    // `task.destroy()` fait rejeter la promesse, ce qui afficherait une erreur à tort.
    let stopped = false;
    task.promise
      .then(async (loaded) => {
        if (stopped) return;
        const first = (await loaded.getPage(1)).getViewport({ scale: 1 });
        setRatio(first.height / first.width);
        setDocument(loaded);
        onProgress(1, loaded.numPages);
      })
      .catch(() => stopped || onError());
    return () => {
      stopped = true;
      void task.destroy();
    };
  }, [data, onProgress, onError]);

  // La largeur de page suit celle de l'écran : 820 px au plus avant zoom.
  useEffect(() => {
    const element = container.current!;
    const resize = new ResizeObserver(([entry]) =>
      setWidth(Math.min(entry.contentRect.width - 32, 820) * zoom),
    );
    resize.observe(element);
    return () => resize.disconnect();
  }, [zoom]);

  return (
    <div ref={container} className="h-full overflow-auto">
      <div className="flex min-w-fit flex-col items-center gap-6 px-4 py-8">
        {document &&
          Array.from({ length: pages }, (_, index) => (
            <Page
              key={index}
              document={document}
              number={index + 1}
              width={width}
              ratio={ratio}
              onVisible={onVisible}
            />
          ))}
      </div>
    </div>
  );
});
