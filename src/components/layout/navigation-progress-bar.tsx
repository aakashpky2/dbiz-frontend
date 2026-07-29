
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When the path changes, we show the loading bar for a brief moment
    // since we use client-side navigation (Link), the actual page change
    // is often very fast, but this gives visual confirmation.
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timeout);
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-transparent pointer-events-none">
      <div className="h-full bg-primary animate-navigation-progress shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
      <style jsx>{`
        @keyframes nav-progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .animate-navigation-progress {
          animation: nav-progress 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
