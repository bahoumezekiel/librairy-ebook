import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CircleAlert, RefreshCw, ShoppingBag, Target, UserPlus, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { api } from "@/api/client";
import type { DashboardStats, PeriodDays } from "@/api/types";
import { Button, IconButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { cascade, fadeUp } from "@/components/motion";
import { PageHeader } from "@/components/PageHeader";
import { Tabs } from "@/components/Tabs";
import { CatalogueCard } from "@/features/admin/dashboard/CatalogueCard";
import { KpiCard } from "@/features/admin/dashboard/KpiCard";
import { OrdersStatusCard } from "@/features/admin/dashboard/OrdersStatusCard";
import { RecentOrdersCard } from "@/features/admin/dashboard/RecentOrdersCard";
import { RevenueChart } from "@/features/admin/dashboard/RevenueChart";
import { TopBooksCard } from "@/features/admin/dashboard/TopBooksCard";
import { TopRatedCard } from "@/features/admin/dashboard/TopRatedCard";
import { useSession } from "@/features/auth/session";
import { formatMoney, formatNumber, formatTime, percentOf } from "@/lib/format";

/** Les indicateurs se mettent à jour seuls, sans recharger la page. */
const REFRESH_INTERVAL_MS = 60_000;

const PERIODS: { value: `${PeriodDays}`; label: string }[] = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
];

const formatRate = (value: number) => `${formatNumber(value)} %`;
const strong = (text: string) => <span className="font-bold text-ink">{text}</span>;

/** Écran « squelette » affiché pendant le premier chargement. */
function DashboardSkeleton() {
  const block = "animate-pulse rounded-2xl bg-line/60";
  return (
    <div className="space-y-6" role="status" aria-label="Chargement des indicateurs">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`h-48 ${block}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={`h-96 xl:col-span-2 ${block}`} />
        <div className={`h-96 ${block}`} />
      </div>
    </div>
  );
}

/** Les quatre indicateurs clés de la période, chacun comparé à la période précédente. */
function KpiRow({ stats }: { stats: DashboardStats }) {
  const { revenue, paid_orders, new_clients, conversion, period } = stats;
  const rate = percentOf(conversion.paid.current, conversion.created.current);
  const previousRate = percentOf(conversion.paid.previous, conversion.created.previous);
  const periodLabel = `sur ${period.days} jours`;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <motion.div variants={fadeUp}>
        <KpiCard
          icon={Wallet}
          tone="brand"
          label={`Chiffre d'affaires ${periodLabel}`}
          value={revenue.current}
          format={formatMoney}
          trend={revenue}
          legend={<>{strong(formatMoney(revenue.total))} au total</>}
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <KpiCard
          icon={ShoppingBag}
          tone="leaf"
          label={`Commandes payées ${periodLabel}`}
          value={paid_orders.current}
          format={formatNumber}
          trend={paid_orders}
          legend={<>{strong(formatNumber(paid_orders.total))} au total depuis le lancement</>}
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <KpiCard
          icon={Target}
          tone="brand"
          label="Taux de conversion"
          value={rate}
          format={formatRate}
          trend={{ current: rate, previous: previousRate, unit: "points" }}
          legend={
            <>
              {strong(formatNumber(conversion.paid.current))} payées sur{" "}
              {formatNumber(conversion.created.current)} lancées
            </>
          }
        />
      </motion.div>
      <motion.div variants={fadeUp}>
        <KpiCard
          icon={UserPlus}
          tone="leaf"
          label={`Nouveaux clients ${periodLabel}`}
          value={new_clients.current}
          format={formatNumber}
          trend={new_clients}
          legend={<>{strong(formatNumber(new_clients.total))} clients inscrits au total</>}
        />
      </motion.div>
    </div>
  );
}

export function DashboardPage() {
  const { data: user } = useSession();
  const [days, setDays] = useState<`${PeriodDays}`>("30");
  const stats = useQuery({
    queryKey: ["admin", "stats", days],
    queryFn: () => api<DashboardStats>(`/admin/stats/?days=${days}`),
    refetchInterval: REFRESH_INTERVAL_MS,
    placeholderData: keepPreviousData,
  });
  const { data } = stats;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={
          <>
            Bonjour <span className="capitalize">{user?.first_name}</span>, voici l'activité de{" "}
            <span className="font-bold text-ink">
              Faso<span className="text-brand-strong">Lib</span>
            </span>
            . Chaque indicateur est comparé à la période précédente.
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-3">
            {data && (
              <p className="text-xs text-muted">Mis à jour à {formatTime(stats.dataUpdatedAt)}</p>
            )}
            <span className={stats.isFetching ? "animate-spin" : ""}>
              <IconButton
                icon={RefreshCw}
                label="Actualiser"
                disabled={stats.isFetching}
                onClick={() => stats.refetch()}
              />
            </span>
            <Tabs label="Période analysée" tabs={PERIODS} value={days} onChange={setDays} />
          </div>
        }
      />

      {stats.isError && (
        <Card className="mb-6 flex h-auto flex-wrap items-center gap-4">
          <CircleAlert className="size-6 shrink-0 text-danger" aria-hidden />
          <p className="flex-1 text-sm font-bold">
            {data
              ? "La mise à jour a échoué : les données affichées sont les dernières reçues."
              : "Impossible de charger les indicateurs."}
          </p>
          <Button variant="secondary" onClick={() => stats.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {stats.isPending && <DashboardSkeleton />}

      {data && (
        <motion.div
          className={`space-y-6 transition-opacity duration-150 ${stats.isPlaceholderData ? "opacity-60" : ""}`}
          variants={cascade}
          initial="hidden"
          animate="visible"
        >
          <KpiRow stats={data} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <motion.div variants={fadeUp} className="xl:col-span-2">
              <RevenueChart days={data.daily_revenue} periodTotal={data.revenue.current} />
            </motion.div>
            <motion.div variants={fadeUp}>
              <OrdersStatusCard orders={data.orders_by_status} periodDays={data.period.days} />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <motion.div variants={fadeUp}>
              <TopBooksCard books={data.top_books} periodDays={data.period.days} />
            </motion.div>
            <motion.div variants={fadeUp}>
              <TopRatedCard books={data.top_rated} />
            </motion.div>
            <motion.div variants={fadeUp}>
              <CatalogueCard books={data.books} />
            </motion.div>
          </div>

          <motion.div variants={fadeUp}>
            <RecentOrdersCard orders={data.recent_orders} />
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
