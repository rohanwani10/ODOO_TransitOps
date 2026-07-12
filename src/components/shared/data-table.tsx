"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
}

export function DataTable<T>({ data, columns, className }: DataTableProps<T>) {
  return (
    <div className={cn("bg-white rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden", className)}>
      <Table>
        <TableHeader className="bg-surface-container-low border-b border-outline-variant/30">
          <TableRow className="hover:bg-transparent">
            {columns.map((col, i) => (
              <TableHead 
                key={i} 
                className={cn("px-xl py-4 font-label-md text-label-md text-on-surface-variant uppercase whitespace-nowrap", col.className)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-on-surface-variant">
                No results.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, i) => (
              <TableRow 
                key={i}
                className="hover:bg-surface-container-lowest transition-colors border-b border-outline-variant/10 group"
              >
                {columns.map((col, j) => (
                  <TableCell key={j} className={cn("px-xl py-4", col.className)}>
                    {col.cell ? col.cell(row) : (col.accessorKey ? String(row[col.accessorKey]) : null)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
