"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge, StatusType } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, ChevronLeft, ChevronRight, Loader2, MapPin, Play, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useTrips, useDispatchTrip, useCompleteTrip, useCancelTrip } from "@/lib/api-hooks";

function mapTripStatus(status: string): StatusType {
  const map: Record<string, StatusType> = {
    DRAFT: "draft",
    DISPATCHED: "dispatched",
    SCHEDULED: "pending",
    IN_PROGRESS: "active",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  };
  return map[status] ?? "inactive";
}

interface Trip {
  id: string;
  origin: string;
  destination: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  cargoWeightKg: number | null;
  distanceKm: number | null;
  vehicle: {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
  };
  driver: {
    id: string;
    licenseNo: string;
    user: { id: string; name: string };
  };
}

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Dispatched", value: "DISPATCHED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function TripsPage() {
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

  const { data: response, isLoading, isError } = useTrips(filters);
  const dispatchTrip = useDispatchTrip();
  const completeTrip = useCompleteTrip();
  const cancelTrip = useCancelTrip();

  const trips: Trip[] = response?.data ?? [];
  const meta = response?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleDispatch = useCallback((id: string) => {
    if (confirm("Are you sure you want to dispatch this trip? Vehicle and driver will be marked as On Trip.")) {
      dispatchTrip.mutate(id);
    }
  }, [dispatchTrip]);

  const handleComplete = useCallback((id: string) => {
    if (confirm("Mark this trip as completed? Vehicle and driver will be freed.")) {
      completeTrip.mutate(id);
    }
  }, [completeTrip]);

  const handleCancel = useCallback((id: string) => {
    if (confirm("Cancel this trip? This action cannot be undone.")) {
      cancelTrip.mutate(id);
    }
  }, [cancelTrip]);

  const columns = [
    {
      header: "Trip",
      cell: (t: Trip) => (
        <span className="font-label-md text-label-md text-primary">{t.id.slice(0, 12)}</span>
      )
    },
    {
      header: "Route",
      cell: (t: Trip) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-on-surface-variant shrink-0" />
          <div className="flex flex-col">
            <span className="font-body-md text-on-surface font-semibold">{t.origin}</span>
            <span className="font-caption text-caption text-on-surface-variant">to {t.destination}</span>
          </div>
        </div>
      )
    },
    {
      header: "Assignment",
      cell: (t: Trip) => (
        <div>
          <div className="font-body-md text-on-surface">{t.driver?.user?.name ?? "—"}</div>
          <div className="font-caption text-caption text-on-surface-variant">{t.vehicle?.registrationNo ?? "—"}</div>
        </div>
      )
    },
    {
      header: "Schedule",
      cell: (t: Trip) => {
        const date = new Date(t.scheduledStart);
        return (
          <div>
            <div className="font-body-md text-on-surface">
              {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="font-caption text-caption text-on-surface-variant">
              {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        );
      }
    },
    {
      header: "Status",
      cell: (t: Trip) => <StatusBadge status={mapTripStatus(t.status)} variant="table" />
    },
    {
      header: "Actions",
      className: "w-[180px]",
      cell: (t: Trip) => (
        <div className="flex items-center gap-1">
          {t.status === "DRAFT" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-primary hover:bg-primary-container"
                onClick={() => handleDispatch(t.id)}
                disabled={dispatchTrip.isPending}
              >
                <Play className="w-3 h-3 mr-1" /> Dispatch
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-error hover:bg-error-container"
                onClick={() => handleCancel(t.id)}
                disabled={cancelTrip.isPending}
              >
                <XCircle className="w-3 h-3 mr-1" /> Cancel
              </Button>
            </>
          )}
          {t.status === "DISPATCHED" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-green-700 hover:bg-green-100"
                onClick={() => handleComplete(t.id)}
                disabled={completeTrip.isPending}
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-error hover:bg-error-container"
                onClick={() => handleCancel(t.id)}
                disabled={cancelTrip.isPending}
              >
                <XCircle className="w-3 h-3 mr-1" /> Cancel
              </Button>
            </>
          )}
          {(t.status === "COMPLETED" || t.status === "CANCELLED") && (
            <span className="text-caption text-on-surface-variant">—</span>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Trips"
        subtitle="Schedule and monitor fleet routes"
        actions={
          <Link href="/trips/new">
            <Button className="bg-primary text-on-primary hover:bg-primary-container shadow-none h-10 rounded-lg">
              <Plus className="w-4 h-4 mr-2" /> Create Trip
            </Button>
          </Link>
        }
        filters={
          <>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search trips..."
                value={search}
                onChange={handleSearchChange}
                className="w-full bg-surface border border-outline-variant rounded-lg py-1.5 pl-9 pr-3 text-body-md focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                  className={`px-4 py-1.5 rounded-full font-label-md text-label-md transition-colors ${
                    statusFilter === tab.value
                      ? "bg-primary-container text-on-primary-container"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        }
      />
      
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-on-surface-variant">Loading trips...</span>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-20 text-error">
          Failed to load trips. Please try again.
        </div>
      ) : (
        <>
          <DataTable data={trips} columns={columns} />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-caption text-on-surface-variant">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, meta.total)} of {meta.total} trips
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
