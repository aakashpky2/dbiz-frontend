import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DataTableSkeletonProps {
  columnCount?: number;
  rowCount?: number;
  title?: string;
}

export function DataTableSkeleton({ columnCount = 5, rowCount = 5, title }: DataTableSkeletonProps) {
  return (
    <Card className="shadow-sm border-border/60">
      {title && (
        <CardHeader className="pb-3 border-b border-border bg-muted/50/50">
          <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50/50 hover:bg-muted/50/50">
              {Array.from({ length: columnCount }).map((_, i) => (
                <TableHead key={i} className="py-4">
                  <Skeleton className="h-4 w-24 rounded-sm" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-transparent">
                {Array.from({ length: columnCount }).map((_, colIndex) => (
                  <TableCell key={colIndex} className="py-4">
                    <Skeleton className={`h-4 rounded-sm ${colIndex === 0 ? 'w-32' : 'w-20'}`} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
