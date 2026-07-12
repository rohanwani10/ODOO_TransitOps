"use client";

import { useEffect, useState } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import { Download, TrendingUp, AlertTriangle, Activity, Briefcase } from "lucide-react";
import { fetchClient } from "@/lib/api-client";

interface DashboardStats {
  fuelEfficiency: number;
  fleetUtilizationPct: number;
  operationalCost: number;
  vehicleROIPct: number;
  totalRevenue: number;
  activeVehicles: number;
  vehiclesOnTrip: number;
  vehiclesInMaintenance: number;
}

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("startDate", new Date(startDate).toISOString());
      if (endDate) queryParams.append("endDate", new Date(endDate).toISOString());

      const data = await fetchClient<{ success: boolean; data: DashboardStats }>(`/dashboard/stats?${queryParams.toString()}`);
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append("startDate", new Date(startDate).toISOString());
      if (endDate) queryParams.append("endDate", new Date(endDate).toISOString());

      window.location.href = `/api/dashboard/export?${queryParams.toString()}`;
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  // Mock data for the chart since we don't have historical snapshot endpoints in the backend yet
  const chartData = [
    { name: 'Jan', fuel: 4000, maintenance: 2400, expenses: 2400 },
    { name: 'Feb', fuel: 3000, maintenance: 1398, expenses: 2210 },
    { name: 'Mar', fuel: 2000, maintenance: 9800, expenses: 2290 },
    { name: 'Apr', fuel: 2780, maintenance: 3908, expenses: 2000 },
    { name: 'May', fuel: 1890, maintenance: 4800, expenses: 2181 },
    { name: 'Jun', fuel: 2390, maintenance: 3800, expenses: 2500 },
    { name: 'Jul', fuel: 3490, maintenance: 4300, expenses: 2100 },
  ];

  return (
    <div className="w-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-xl">
        <div>
          <h1 className="font-display-md text-display-md text-on-surface mb-xs">
            Reports & Analytics
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Overview of fleet performance, costs, and utilization.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-sm">
          <div className="flex items-center gap-xs bg-surface-container-low border border-outline-variant rounded-lg p-1">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-body-sm px-2 py-1 outline-none text-on-surface"
            />
            <span className="text-on-surface-variant text-body-sm">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-body-sm px-2 py-1 outline-none text-on-surface"
            />
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-xs bg-primary text-on-primary px-md py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="font-label-md">Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-lg mb-xl">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md mb-xl">
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-sm">
            <h3 className="font-label-lg text-on-surface-variant">Fuel Efficiency</h3>
            <div className="p-2 bg-primary-container text-on-primary-container rounded-lg">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="font-display-md text-display-sm text-on-surface">
            {loading ? "..." : `${stats?.fuelEfficiency.toFixed(2) || 0} km/L`}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-sm">
            <h3 className="font-label-lg text-on-surface-variant">Fleet Utilization</h3>
            <div className="p-2 bg-tertiary-container text-on-tertiary-container rounded-lg">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <div className="font-display-md text-display-sm text-on-surface">
            {loading ? "..." : `${stats?.fleetUtilizationPct.toFixed(1) || 0}%`}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-sm">
            <h3 className="font-label-lg text-on-surface-variant">Operational Cost</h3>
            <div className="p-2 bg-error-container text-on-error-container rounded-lg">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="font-display-md text-display-sm text-on-surface">
            {loading ? "..." : `₹${stats?.operationalCost.toLocaleString() || 0}`}
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-sm">
            <h3 className="font-label-lg text-on-surface-variant">Vehicle ROI</h3>
            <div className="p-2 bg-secondary-container text-on-secondary-container rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="font-display-md text-display-sm text-on-surface">
            {loading ? "..." : `${stats?.vehicleROIPct.toFixed(1) || 0}%`}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
        {/* Main Cost Chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
          <h3 className="font-title-md text-on-surface mb-xl">Operational Costs Breakdown</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                <RechartsTooltip 
                  cursor={{fill: '#F1F5F9'}} 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                />
                <Legend />
                <Bar dataKey="fuel" name="Fuel" stackId="a" fill="#6366F1" radius={[0, 0, 4, 4]} />
                <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill="#10B981" />
                <Bar dataKey="expenses" name="Other Expenses" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Current Snapshot */}
        <div className="bg-surface-container-lowest border border-outline-variant p-lg rounded-xl shadow-sm">
          <h3 className="font-title-md text-on-surface mb-lg">Fleet Status</h3>
          <div className="space-y-md">
            <div>
              <div className="flex justify-between font-label-md mb-xs">
                <span className="text-on-surface-variant">Active Vehicles</span>
                <span className="text-on-surface font-semibold">{loading ? "-" : stats?.activeVehicles}</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between font-label-md mb-xs">
                <span className="text-on-surface-variant">On Trip</span>
                <span className="text-on-surface font-semibold">{loading ? "-" : stats?.vehiclesOnTrip}</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-tertiary h-full" 
                  style={{ width: `${stats?.activeVehicles ? (stats.vehiclesOnTrip / stats.activeVehicles) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-label-md mb-xs">
                <span className="text-on-surface-variant">In Maintenance</span>
                <span className="text-on-surface font-semibold">{loading ? "-" : stats?.vehiclesInMaintenance}</span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-error h-full" 
                  style={{ width: `${stats?.activeVehicles ? (stats.vehiclesInMaintenance / stats.activeVehicles) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
