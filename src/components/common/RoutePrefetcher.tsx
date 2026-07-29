'use client';

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    // Manually prefetch critical dashboard routes for "near-instant" navigation
    const criticalRoutes = [
      "/dashboard/work/queries",
      "/dashboard/work/clients",
      "/dashboard/work/proposals",
      "/dashboard/employee-directory",
      "/dashboard/work-register/my-tasks",
      "/dashboard/attendance"
    ];

    criticalRoutes.forEach(route => {
      router.prefetch(route);
    });
  }, [router]);

  return null;
}
