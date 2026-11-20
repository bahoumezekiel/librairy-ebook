import { ArrowLeft, BookX, CloudOff, LoaderCircle, Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router";

import { Logo } from "@/components/Logo";
import { EpubViewer } from "@/features/reader/EpubViewer";
import { PdfViewer } from "@/features/reader/PdfViewer";
import { ReaderError, useReadableBook } from "@/features/reader/readableBook";

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2];
const BAR_BUTTON =
  "grid size-10 place-items-center text-white transition-colors duration-150 hover:bg-white/10 disabled:opacity-30";

/** Filigrane nominatif répété en diagonale par-dessus un EPUB (les PDF ont le leur dans le fichier). */
function Watermark({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-wrap content-start gap-x-24 gap-y-28 opacity-[0.07]">
        {Array.from({ length: 60 }, (_, index) => (
          <span key={index} className="whitespace-nowrap text-sm font-bold text-ink">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

function Message({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const known = error instanceof ReaderError ? error : null;
  const Icon = known?.retryable ? CloudOff : BookX;
  return (
    <div className="grid h-full place-items-center px-6 text-center text-white">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center bg-brand text-ink">
          <Icon className="size-8" aria-hidden />
        </span>
        <h1 className="mt-6 text-2xl font-bold">{known?.title ?? "Ouverture impossible"}</h1>
        <p className="mt-3 text-white/70">
          {known?.text ?? "Le livre n'a pas pu être ouvert. Réessayez dans un instant."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {(known?.retryable ?? true) && (
            <button type="button" onClick={onRetry} className="h-12 bg-brand px-6 text-sm font-bold text-ink hover:bg-brand-hover">
              Réessayer
            </button>
          )}
          <Link to="/bibliotheque" className="grid h-12 place-items-center border border-white/25 px-6 text-sm font-bold text-white hover:bg-white/10">
            Retour à ma bibliothèque
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Lecteur intégré : un livre acheté s'ouvre ici, déchiffré en mémoire.
 * Aucun bouton de téléchargement, menu contextuel désactivé, impression bloquée.
 */
export function ReaderPage() {
  const { slug = "" } = useParams();
  const readable = useReadableBook(slug);
  const [zoom, setZoom] = useState(1);
  const [progress, setProgress] = useState("");
  const [failed, setFailed] = useState(false);

  const onPdfProgress = useCallback((page: number, pages: number) => setProgress(`Page ${page} / ${pages}`), []);
  const onEpubProgress = useCallback((percent: number) => setProgress(`${percent} %`), []);
  const onViewerError = useCallback(() => setFailed(true), []);

  const book = readable.data?.book;
  const zoomIndex = ZOOM_STEPS.indexOf(zoom);

  return (
    <div
      className="fixed inset-0 flex select-none flex-col bg-[#1b2230] print:hidden"
      onContextMenu={(event) => event.preventDefault()}
    >
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-ink px-3 text-white sm:px-5">
        <Link to="/bibliotheque" className={BAR_BUTTON} aria-label="Retour à ma bibliothèque" title="Retour à ma bibliothèque">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        {book ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{book.title}</p>
            <p className="truncate text-xs text-white/60">
              {book.author}
              {readable.data?.offline && " · lecture hors ligne"}
            </p>
          </div>
        ) : (
          <div className="flex-1">
            <Logo onDark className="text-xl" />
          </div>
        )}
        {progress && <p className="hidden shrink-0 text-sm tabular-nums text-white/75 sm:block">{progress}</p>}
        {book?.format === "pdf" && (
          <div className="flex shrink-0 items-center border border-white/15">
            <button type="button" className={BAR_BUTTON} disabled={zoomIndex <= 0} onClick={() => setZoom(ZOOM_STEPS[zoomIndex - 1])} aria-label="Réduire">
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="w-14 text-center text-xs tabular-nums">{Math.round(zoom * 100)} %</span>
            <button type="button" className={BAR_BUTTON} disabled={zoomIndex >= ZOOM_STEPS.length - 1} onClick={() => setZoom(ZOOM_STEPS[zoomIndex + 1])} aria-label="Agrandir">
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </header>

      <main className="relative min-h-0 flex-1">
        {readable.isError || failed ? (
          <Message
            error={failed ? null : readable.error}
            onRetry={() => {
              setFailed(false);
              readable.retry();
            }}
          />
        ) : !readable.data ? (
          <div className="grid h-full place-items-center text-white" role="status">
            <div className="text-center">
              <LoaderCircle className="mx-auto size-10 animate-spin text-brand" aria-hidden />
              <p className="mt-4 text-sm text-white/70">Ouverture de votre exemplaire…</p>
            </div>
          </div>
        ) : (
          <motion.div className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
            {readable.data.book.format === "pdf" ? (
              <PdfViewer data={readable.data.content} zoom={zoom} onProgress={onPdfProgress} onError={onViewerError} />
            ) : (
              <>
                <EpubViewer data={readable.data.content} onProgress={onEpubProgress} onError={onViewerError} />
                <Watermark text={readable.data.book.watermark} />
              </>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
