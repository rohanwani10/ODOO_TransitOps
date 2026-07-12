"use client";

"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchClient } from "./api-client";

// ---------------------------------------------------------------------------
// Types — API response envelope
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

export const queryKeys = {
  vehicles: {
    all: ["vehicles"] as const,
    list: (filters: Record<string, string>) => ["vehicles", "list", filters] as const,
    detail: (id: string) => ["vehicles", "detail", id] as const,
    stats: () => ["vehicles", "stats"] as const,
    available: () => ["vehicles", "available"] as const,
  },
  drivers: {
    all: ["drivers"] as const,
    list: (filters: Record<string, string>) => ["drivers", "list", filters] as const,
    detail: (id: string) => ["drivers", "detail", id] as const,
  },
  trips: {
    all: ["trips"] as const,
    list: (filters: Record<string, string>) => ["trips", "list", filters] as const,
    detail: (id: string) => ["trips", "detail", id] as const,
  },
  maintenance: {
    all: ["maintenance"] as const,
    list: (filters: Record<string, string>) => ["maintenance", "list", filters] as const,
    detail: (id: string) => ["maintenance", "detail", id] as const,
  },
  fuelLogs: {
    all: ["fuelLogs"] as const,
    list: (filters: Record<string, string>) => ["fuelLogs", "list", filters] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    list: (filters: Record<string, string>) => ["expenses", "list", filters] as const,
  },
  dashboard: {
    stats: (filters?: Record<string, string>) => (
      filters ? (["dashboard", "stats", filters] as const) : (["dashboard", "stats"] as const)
    ),
  },
};

// ---------------------------------------------------------------------------
// Helper: build query string from filters
// ---------------------------------------------------------------------------

function buildQueryString(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// VEHICLES
// ---------------------------------------------------------------------------

export function useVehicles(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: queryKeys.vehicles.list(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any[]>>(`/vehicles${buildQueryString(filters)}`),
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: queryKeys.vehicles.detail(id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any>>(`/vehicles/${id}`),
    enabled: !!id,
  });
}

export function useAvailableVehicles() {
  return useQuery({
    queryKey: queryKeys.vehicles.available(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any[]>>(`/vehicles/available`),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchClient(`/vehicles`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetchClient(`/vehicles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchClient(`/vehicles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
    },
  });
}

// ---------------------------------------------------------------------------
// VEHICLE STATS (Dashboard)
// ---------------------------------------------------------------------------

export function useVehicleStats() {
  return useQuery({
    queryKey: queryKeys.vehicles.stats(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any>>(`/vehicles/stats`),
  });
}

// ---------------------------------------------------------------------------
// DASHBOARD STATS (combined)
// ---------------------------------------------------------------------------

export function useDashboardStats(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any>>(`/dashboard/stats${buildQueryString(filters)}`),
  });
}

// ---------------------------------------------------------------------------
// DRIVERS
// ---------------------------------------------------------------------------

export function useDrivers(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: queryKeys.drivers.list(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any[]>>(`/drivers${buildQueryString(filters)}`),
  });
}

export function useDriver(id: string) {
  return useQuery({
    queryKey: queryKeys.drivers.detail(id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any>>(`/drivers/${id}`),
    enabled: !!id,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchClient(`/drivers`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetchClient(`/drivers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
    },
  });
}

// ---------------------------------------------------------------------------
// TRIPS
// ---------------------------------------------------------------------------

export function useTrips(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: queryKeys.trips.list(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any[]>>(`/trips${buildQueryString(filters)}`),
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: queryKeys.trips.detail(id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any>>(`/trips/${id}`),
    enabled: !!id,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchClient(`/trips`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.available() });
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

export function useDispatchTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchClient(`/trips/${id}/dispatch`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

export function useCompleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchClient(`/trips/${id}/complete`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

export function useCancelTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchClient(`/trips/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

// ---------------------------------------------------------------------------
// MAINTENANCE LOGS
// ---------------------------------------------------------------------------

export function useMaintenanceLogs(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: queryKeys.maintenance.list(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any[]>>(`/maintenance-logs${buildQueryString(filters)}`),
  });
}

export function useCreateMaintenanceLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchClient(`/maintenance-logs`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

// ---------------------------------------------------------------------------
// FUEL LOGS
// ---------------------------------------------------------------------------

export function useFuelLogs(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: queryKeys.fuelLogs.list(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any[]>>(`/fuel-logs${buildQueryString(filters)}`),
  });
}

export function useCreateFuelLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchClient(`/fuel-logs`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fuelLogs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}

// ---------------------------------------------------------------------------
// EXPENSES
// ---------------------------------------------------------------------------

export function useExpenses(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: queryKeys.expenses.list(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => fetchClient<ApiResponse<any[]>>(`/expenses${buildQueryString(filters)}`),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchClient(`/expenses`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
    },
  });
}
