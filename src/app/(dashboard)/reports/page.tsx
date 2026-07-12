"use client";

import { PageHeader } from "@/components/shared/page-header";
import { KPICard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Download, Calendar, ChevronDown, DollarSign } from "lucide-react";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Fleet performance and financial overview"
        actions={
          <Button className="bg-white text-on-surface border border-outline-variant hover:bg-surface-container-low shadow-none h-10 rounded-lg">
            <Download className="w-4 h-4 mr-2" /> Export Report
          </Button>
        }
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
          </>
        }
      />
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-md mb-lg">
        <KPICard title="Total Revenue" value="$124,500" trend={8.2} icon={DollarSign} />
        <KPICard title="Net Profit" value="$42,300" trend={5.1} />
        <KPICard title="Total Expenses" value="$82,200" trend={-2.4} trendLabel="vs last month" />
        <KPICard title="Avg ROI" value="18.5%" trend={1.2} />
        <KPICard title="Fuel Efficiency" value="6.2 mpg" trend={0.5} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/20 min-h-[400px] flex items-center justify-center">
          <p className="text-on-surface-variant">Fleet Utilization Trend (Line Chart)</p>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/20 min-h-[400px] flex items-center justify-center">
          <p className="text-on-surface-variant">Revenue vs Expenses (Area Chart)</p>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/20 min-h-[400px] flex items-center justify-center">
          <p className="text-on-surface-variant">Cost Breakdown (Stacked Bar)</p>
        </div>
        <div className="bg-surface-container-lowest p-lg rounded-xl shadow-sm border border-outline-variant/20 min-h-[400px] flex items-center justify-center">
          <p className="text-on-surface-variant">Trip Status Distribution (Donut)</p>
        </div>
      </div>
    </>
  );
}
