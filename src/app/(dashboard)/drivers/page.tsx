"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { StatusBadge, StatusType } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, ChevronLeft, ChevronRight, Loader2, Filter } from "lucide-react";
import Link from "next/link";
import { useDrivers } from "@/lib/api-hooks";

// Map DB enum → StatusBadge type
function mapDriverStatus(status: string): StatusType {
  const map: Record<string, StatusType> = {
    AVAILABLE: "available",
    ON_TRIP: "on_trip",
    ACTIVE: "active",
    INACTIVE: "inactive",
    SUSPENDED: "suspended",
  };
  return map[status] ?? "inactive";
}

// Compute license expiry status from date
function getLicenseExpiryStatus(expiryDate: string): { status: StatusType; label: string } {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  if (expiry < now) {
    return { status: "expired", label: "Expired" };
  }
  if (expiry <= thirtyDaysFromNow) {
    return { status: "expiring_soon", label: "Expiring Soon" };
  }
  return { status: "valid", label: "Valid" };
}

interface Driver {
  id: string;
  licenseNo: string;
  licenseExpiry: string;
  phone: string;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function DriversPage() {
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

  const { data: response, isLoading, isError } = useDrivers(filters);

  const drivers: Driver[] = response?.data ?? [];
  const meta = response?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const columns: Column<Driver>[] = [
    {
      header: "Driver",
      cell: (d: Driver) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs ring-2 ring-surface-container-high shadow-sm">
            {d.user.name.charAt(0)}
          </div>
          <div>
            <div className="font-body-md text-on-surface font-semibold">{d.user.name}</div>
            <div className="font-caption text-caption text-on-surface-variant">{d.user.email}</div>
          </div>
        </div>
      )
    },
    { 
      header: "License", 
      cell: (d: Driver) => {
        const expiry = getLicenseExpiryStatus(d.licenseExpiry);
        return (
          <div className="flex items-center gap-2">
            <span className="font-body-md text-on-surface">{d.licenseNo}</span>
            <StatusBadge status={expiry.status} variant="table" label={expiry.label} />
          </div>
        );
      }
    },
    {
      header: "License Expiry",
      cell: (d: Driver) => (
        <span className="font-body-md text-on-surface">
          {new Date(d.licenseExpiry).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </span>
      )
    },
    {
      header: "Status",
      cell: (d: Driver) => <StatusBadge status={mapDriverStatus(d.status)} variant="table" />
    },
    { header: "Contact", accessorKey: "phone" as keyof Driver },
  ];

  return (
    <>
      <PageHeader
        title="Drivers"
        subtitle="Manage fleet personnel and compliance"
        actions={
          <Link href="/drivers/new">
            <Button className="bg-primary text-on-primary hover:bg-primary-container shadow-none h-10 rounded-lg">
              <Plus className="w-4 h-4 mr-2" /> Add Driver
            </Button>
          </Link>
        }
        filters={
          <>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search drivers..."
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
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
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
          <span className="ml-3 text-on-surface-variant">Loading drivers...</span>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-20 text-error">
          Failed to load drivers. Please try again.
        </div>
      ) : (
        <>
          <DataTable data={drivers} columns={columns} />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-caption text-on-surface-variant">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, meta.total)} of {meta.total} drivers
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
