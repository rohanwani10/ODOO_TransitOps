"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge, StatusType } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useVehicles } from "@/lib/api-hooks";
import { AddVehicleDialog } from "@/components/shared/entity-create-dialogs";

// Map DB enum → StatusBadge type
function mapVehicleStatus(status: string): StatusType {
  const map: Record<string, StatusType> = {
    AVAILABLE: "available",
    ON_TRIP: "on_trip",
    IN_USE: "active",
    MAINTENANCE: "in_shop",
    OUT_OF_SERVICE: "retired",
    RETIRED: "retired",
  };
  return map[status] ?? "inactive";
}

interface Vehicle {
  id: string;
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  type: string;
  fuelType: string;
  status: string;
  odometerKm: number;
  payloadCapacityKg: number | null;
  seatingCapacity: number | null;
  region: string | null;
}

export default function VehiclesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const filters = useMemo(() => {
    const f: Record<string, string> = { page: String(page), limit: String(limit) };
    if (search) f.q = search;
    if (statusFilter) f.status = statusFilter;
    if (typeFilter) f.type = typeFilter;
    return f;
  }, [search, statusFilter, typeFilter, page]);

  const { data: response, isLoading, isError } = useVehicles(filters);

  const vehicles: Vehicle[] = response?.data ?? [];
  const meta = response?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const columns: Column<Vehicle>[] = [
    {
      header: "Vehicle",
      cell: (v: Vehicle) => (
        <div>
          <div className="font-body-md text-on-surface font-semibold">{v.registrationNo}</div>
          <div className="font-caption text-caption text-on-surface-variant">{v.make} {v.model} ({v.year})</div>
        </div>
      )
    },
    {
      header: "Type",
      cell: (v: Vehicle) => (
        <span className="font-body-md text-on-surface capitalize">{v.type.toLowerCase()}</span>
      )
    },
    {
      header: "Status",
      cell: (v: Vehicle) => <StatusBadge status={mapVehicleStatus(v.status)} variant="table" />
    },
    {
      header: "Capacity",
      cell: (v: Vehicle) => (
        <span className="font-body-md text-on-surface">
          {v.payloadCapacityKg ? `${v.payloadCapacityKg} kg` : v.seatingCapacity ? `${v.seatingCapacity} seats` : "—"}
        </span>
      )
    },
    {
      header: "Odometer",
      cell: (v: Vehicle) => (
        <span className="font-body-md text-on-surface">{v.odometerKm.toLocaleString()} km</span>
      )
    },
    {
      header: "Region",
      cell: (v: Vehicle) => (
        <span className="font-body-md text-on-surface-variant">{v.region ?? "—"}</span>
      )
    },
  ];

  return (
    <>
      <PageHeader
        title="Fleet Vehicles"
        subtitle="Manage and track all company vehicles"
        actions={<AddVehicleDialog />}
        filters={
          <>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search vehicles..."
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
              <option value="AVAILABLE">Available</option>
              <option value="ON_TRIP">On Trip</option>
              <option value="MAINTENANCE">In Maintenance</option>
              <option value="OUT_OF_SERVICE">Out of Service</option>
              <option value="RETIRED">Retired</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-body-md focus:outline-none focus:border-primary h-9"
            >
              <option value="">All Types</option>
              <option value="BUS">Bus</option>
              <option value="MINIBUS">Minibus</option>
              <option value="VAN">Van</option>
              <option value="TRUCK">Truck</option>
              <option value="CAR">Car</option>
              <option value="MOTORCYCLE">Motorcycle</option>
            </select>
            <Button variant="outline" size="sm" className="bg-surface h-9 ml-2" onClick={() => { setSearch(""); setStatusFilter(""); setTypeFilter(""); setPage(1); }}>
              <Filter className="w-4 h-4 mr-2" /> Clear
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-on-surface-variant">Loading vehicles...</span>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-20 text-error">
          Failed to load vehicles. Please try again.
        </div>
      ) : (
        <>
          <DataTable data={vehicles} columns={columns} />
          
          {/* Pagination */}
          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-caption text-on-surface-variant">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, meta.total)} of {meta.total} vehicles
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-body-md text-on-surface px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="h-8"
                >
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
