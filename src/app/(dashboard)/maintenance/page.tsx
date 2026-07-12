"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { StatusBadge, StatusType } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, Wrench, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMaintenanceLogs } from "@/lib/api-hooks";
import { AddMaintenanceDialog } from "@/components/shared/entity-create-dialogs";

function mapMaintenanceStatus(status: string): StatusType {
  const map: Record<string, StatusType> = {
    SCHEDULED: "pending",
    IN_PROGRESS: "active",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  };
  return map[status] ?? "inactive";
}

interface MaintenanceLog {
  id: string;
  vehicleId: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  vendor: string | null;
  odometerKm: number | null;
  scheduledAt: string;
  completedAt: string | null;
  cost: number | string | null;
  vehicle: {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
  };
}

export default function MaintenancePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const filters = useMemo(() => {
    const f: Record<string, string> = { page: String(page), limit: String(limit) };
    if (search) f.q = search;
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [search, statusFilter, page]);

  const { data: response, isLoading, isError } = useMaintenanceLogs(filters);

  const logs: MaintenanceLog[] = response?.data ?? [];
  const meta = response?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const columns: Column<MaintenanceLog>[] = [
    {
      header: "Log ID",
      cell: (m: MaintenanceLog) => (
        <span className="font-label-md text-label-md text-primary">{m.id.slice(0, 12)}</span>
      )
    },
    {
      header: "Vehicle",
      cell: (m: MaintenanceLog) => (
        <div>
          <div className="font-body-md text-on-surface font-semibold">{m.vehicle.registrationNo}</div>
          <div className="font-caption text-caption text-on-surface-variant">{m.vehicle.make} {m.vehicle.model}</div>
        </div>
      )
    },
    {
      header: "Service Details",
      cell: (m: MaintenanceLog) => (
        <div>
          <div className="font-body-md text-on-surface flex items-center gap-2">
            {m.type === "EMERGENCY" && <Wrench className="w-3 h-3 text-error" />}
            {m.type.charAt(0) + m.type.slice(1).toLowerCase()}
          </div>
          <div className="font-caption text-caption text-on-surface-variant">{m.title}</div>
        </div>
      )
    },
    {
      header: "Date",
      cell: (m: MaintenanceLog) => (
        <span className="font-body-md text-on-surface">
          {new Date(m.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      )
    },
    {
      header: "Cost",
      cell: (m: MaintenanceLog) => (
        <span className="font-body-md text-on-surface font-semibold">
          {m.cost != null ? `$${Number(m.cost).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
        </span>
      )
    },
    {
      header: "Status",
      cell: (m: MaintenanceLog) => <StatusBadge status={mapMaintenanceStatus(m.status)} variant="table" />
    }
  ];

  return (
    <>
      <PageHeader
        title="Maintenance Log"
        subtitle="Track vehicle service and repairs"
        actions={<AddMaintenanceDialog />}
        filters={
          <>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search logs..."
                value={search}
                onChange={handleSearchChange}
                className="w-full bg-surface border border-outline-variant rounded-lg py-1.5 pl-9 pr-3 text-body-md focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-body-md focus:outline-none focus:border-primary h-9"
            >
              <option value="">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <Button variant="outline" size="sm" className="bg-surface h-9 ml-2" onClick={() => { setSearch(""); setStatusFilter(""); setPage(1); }}>
              <Filter className="w-4 h-4 mr-2" /> Clear
            </Button>
          </>
        }
      />
      
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-on-surface-variant">Loading maintenance logs...</span>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-20 text-error">
          Failed to load maintenance logs. Please try again.
        </div>
      ) : (
        <>
          <DataTable data={logs} columns={columns} />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-caption text-on-surface-variant">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, meta.total)} of {meta.total} logs
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-8">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-body-md text-on-surface px-2">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
