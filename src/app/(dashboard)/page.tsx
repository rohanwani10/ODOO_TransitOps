"use client";

import { KPICard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshCcw, Calendar, ChevronDown, CheckCircle2, Wrench, Navigation, Clock, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/lib/api-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api-hooks";

export default function DashboardPage() {
  const { data: response, isLoading, isError, dataUpdatedAt } = useDashboardStats();
  const queryClient = useQueryClient();
  const stats = response?.data;

  const lastUpdated = dataUpdatedAt
    ? `Last updated ${Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago`
    : "";

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
  };

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        badge={<span className="text-label-md font-label-md bg-primary/10 text-primary px-2 py-0.5 rounded">LIVE DATA</span>}
        subtitle="/ ops_dashboard_v4.2"
        filters={
          <>
            <div className="flex items-center gap-xs px-3 py-1.5 bg-surface rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors">
              <Calendar className="w-4 h-4 text-on-surface-variant" />
              <span className="font-label-md text-label-md">Last 30 Days</span>
            </div>
            <div className="h-6 w-px bg-outline-variant/30"></div>
            <div className="flex items-center gap-xs px-3 py-1.5 bg-surface rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors">
              <span className="font-label-md text-label-md">All Vehicles</span>
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            </div>
            <div className="flex items-center gap-xs px-3 py-1.5 bg-surface rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors">
              <span className="font-label-md text-label-md">All Regions</span>
              <ChevronDown className="w-4 h-4 text-on-surface-variant" />
            </div>
            <Button
              size="sm"
              className="ml-2 bg-primary text-on-primary hover:bg-primary-container shadow-none h-8 rounded-lg"
              onClick={handleRefresh}
            >
              <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <span className="text-caption font-caption text-outline ml-2 hidden lg:block">{lastUpdated}</span>
          </>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-on-surface-variant">Loading dashboard data...</span>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-20 text-error">
          Failed to load dashboard data. Please try again.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-md">
            <KPICard
              title="Active"
              value={String(stats?.activeVehicles ?? 0)}
              progress={stats?.activeVehicles && stats?.availableVehicles ? Math.round((stats.availableVehicles / stats.activeVehicles) * 100) : 0}
            />
            <KPICard
              title="Available"
              value={String(stats?.availableVehicles ?? 0)}
              trendLabel="Ready"
              icon={CheckCircle2}
            />
            <KPICard
              title="In Service"
              value={String(stats?.vehiclesInMaintenance ?? 0)}
              trendLabel="In Shop"
              icon={Wrench}
            />
            <KPICard
              title="Live Trips"
              value={String(stats?.activeTrips ?? 0)}
              trendLabel="En route"
              icon={Navigation}
              className="border-l-4 border-primary"
            />
            <KPICard
              title="Pending"
              value={String(stats?.pendingTrips ?? 0).padStart(2, "0")}
              trendLabel="Draft"
              icon={Clock}
            />
            <KPICard
              title="Drivers"
              value={String(stats?.totalDrivers ?? 0)}
              icon={Users}
              trendLabel={`${stats?.driversOnDuty ?? 0} on duty`}
            />
            <KPICard
              title="Utilization"
              value={`${stats?.fleetUtilizationPct ?? 0}%`}
              trend={stats?.fleetUtilizationPct > 50 ? 3 : -2}
            />
            <KPICard
              title="Completed"
              value={String(stats?.completedTrips ?? 0)}
              trendLabel="Total"
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md mt-xl">
            <div className="lg:col-span-2 bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/20 min-h-[400px] flex items-center justify-center">
              <p className="text-on-surface-variant">Fleet Utilization Chart Placeholder</p>
            </div>
            <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/20 min-h-[400px] flex items-center justify-center">
              <p className="text-on-surface-variant">Trip Status Donut Placeholder</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
