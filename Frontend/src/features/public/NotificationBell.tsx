import { Bell } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router";

import { Dropdown } from "@/components/Dropdown";
import { formatDate } from "@/lib/format";

import { useMarkNotificationsRead, useNotifications } from "./data";

/** Cloche des nouveautés : pastille du nombre de livres non vus, liste au clic. */
export function NotificationBell() {
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = notifications.filter((notification) => !notification.is_read).length;

  return (
    <Dropdown
      label={unread ? `Nouveautés : ${unread} non lues` : "Nouveautés"}
      className="w-80 max-w-[calc(100vw-2rem)]"
      // Ouvrir la liste vaut lecture : la pastille disparaît.
      onOpen={() => unread && markRead.mutate()}
      trigger={(open) => (
        <span
          className={`relative grid size-10 place-items-center rounded-xl transition-colors duration-150 ${
            open ? "bg-canvas text-ink" : "text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          <Bell className="size-5" aria-hidden />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-bold text-ink ring-2 ring-white"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
              >
                {unread}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      )}
    >
      {(close) => (
        <>
          <p className="border-b border-line px-5 py-4 text-sm font-bold">Nouveaux livres</p>
          {notifications.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              Aucune nouveauté ces 30 derniers jours.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map(({ book, published_at, is_read }) => (
                <li key={book.slug}>
                  <Link
                    to={`/livres/${book.slug}`}
                    onClick={close}
                    className="flex items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-canvas"
                  >
                    <img src={book.cover} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{book.title}</span>
                      <span className="block text-xs text-muted">
                        Publié le {formatDate(published_at)}
                      </span>
                    </span>
                    {!is_read && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label="Non lu" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Dropdown>
  );
}
