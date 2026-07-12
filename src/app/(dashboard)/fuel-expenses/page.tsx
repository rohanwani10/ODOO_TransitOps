"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, Column } from "@/components/shared/data-table";
import { StatusBadge, StatusType } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Search, Filter, Receipt, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useExpenses } from "@/lib/api-hooks";
import { AddExpenseDialog } from "@/components/shared/entity-create-dialogs";

function mapExpenseStatus(status: string): StatusType {
  const map: Record<string, StatusType> = {
    PENDING: "pending",
    APPROVED: "completed",
    REJECTED: "cancelled",
  };
  return map[status] ?? "inactive";
}

function mapExpenseStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return map[status] ?? status;
}

interface Expense {
  id: string;
  vehicleId: string;
  tripId: string | null;
  category: string;
  amount: number | string;
  description: string;
  status: string;
  incurredAt: string;
  vehicle: {
    id: string;
    registrationNo: string;
    make: string;
    model: string;
  };
  submittedBy: {
    id: string;
    name: string;
    email: string;
  };
  trip: {
    id: string;
    origin: string;
    destination: string;
    status: string;
  } | null;
}

export default function FuelExpensesPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const filters = useMemo(() => {
    const f: Record<string, string> = { page: String(page), limit: String(limit) };
    if (search) f.q = search;
    if (categoryFilter) f.category = categoryFilter;
    if (statusFilter) f.status = statusFilter;
    return f;
  }, [search, categoryFilter, statusFilter, page]);

  const { data: response, isLoading, isError } = useExpenses(filters);

  const expenses: Expense[] = response?.data ?? [];
  const meta = response?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const columns: Column<Expense>[] = [
    {
      header: "Expense ID",
      cell: (e: Expense) => (
        <span className="font-label-md text-label-md text-primary">{e.id.slice(0, 12)}</span>
      )
    },
    {
      header: "Date",
      cell: (e: Expense) => (
        <span className="font-body-md text-on-surface">
          {new Date(e.incurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      )
    },
    {
      header: "Assignment",
      cell: (e: Expense) => (
        <div>
          <div className="font-body-md text-on-surface">{e.vehicle.registrationNo}</div>
          <div className="font-caption text-caption text-on-surface-variant">{e.submittedBy.name}</div>
        </div>
      )
    },
    {
      header: "Category",
      cell: (e: Expense) => (
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-on-surface-variant" />
          <span className="capitalize">{e.category.toLowerCase()}</span>
        </div>
      )
    },
    {
      header: "Amount",
      className: "font-semibold text-right",
      cell: (e: Expense) => (
        <span className="font-body-md text-on-surface font-semibold">
          ${Number(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      header: "Status",
      cell: (e: Expense) => (
        <StatusBadge
          status={mapExpenseStatus(e.status)}
          variant="table"
          label={mapExpenseStatusLabel(e.status)}
        />
      )
    }
  ];

  return (
    <>
      <PageHeader
        title="Fuel & Expenses"
        subtitle="Manage fleet expenditures and fuel logs"
        actions={<AddExpenseDialog />}
        filters={
          <>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={search}
                onChange={handleSearchChange}
                className="w-full bg-surface border border-outline-variant rounded-lg py-1.5 pl-9 pr-3 text-body-md focus:outline-none focus:border-primary"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-body-md focus:outline-none focus:border-primary h-9"
            >
              <option value="">All Categories</option>
              <option value="FUEL">Fuel</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="TOLL">Toll</option>
              <option value="INSURANCE">Insurance</option>
              <option value="REGISTRATION">Registration</option>
              <option value="CLEANING">Cleaning</option>
              <option value="MISCELLANEOUS">Miscellaneous</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-surface border border-outline-variant rounded-lg py-1.5 px-3 text-body-md focus:outline-none focus:border-primary h-9"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <Button variant="outline" size="sm" className="bg-surface h-9 ml-2" onClick={() => { setSearch(""); setCategoryFilter(""); setStatusFilter(""); setPage(1); }}>
              <Filter className="w-4 h-4 mr-2" /> Clear
            </Button>
          </>
        }
      />
      
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-on-surface-variant">Loading expenses...</span>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-20 text-error">
          Failed to load expenses. Please try again.
        </div>
      ) : (
        <>
          <DataTable data={expenses} columns={columns} />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between mt-4 px-2">
              <span className="text-caption text-on-surface-variant">
                Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, meta.total)} of {meta.total} expenses
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
