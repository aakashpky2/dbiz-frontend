'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function DevIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    setIsSpinning(true);
    const timeout = setTimeout(() => {
      setIsSpinning(false);
    }, 1200);

    return () => clearTimeout(timeout);
  }, [pathname, searchParams]);
  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div 
      className="fixed bottom-5 left-5 z-[9999] pointer-events-none flex items-center justify-center transition-opacity duration-700"
      style={{
        width: '46px',
        height: '46px',
        opacity: isSpinning ? 1 : 0.6,
      }}
    >
      {/* Outer spinning ring */}
      <div 
        className={`absolute inset-0 rounded-full motion-reduce:animate-none ${isSpinning ? 'animate-[spin_1.1s_linear_infinite]' : ''}`}
        style={{
          background: 'conic-gradient(rgba(255,255,255,0.95), #60A5FA, #2563EB, #1E3A8A, transparent 68%)',
          maskImage: 'radial-gradient(transparent 17.5px, white 18.5px)',
          WebkitMaskImage: 'radial-gradient(transparent 17.5px, white 18.5px)',
        }}
      >
        {/* Glowing leading edge dot */}
        <div 
          className="absolute rounded-full bg-white"
          style={{
            width: '5px',
            height: '5px',
            top: '0',
            left: '50%',
            transform: 'translate(-50%, 0)',
            boxShadow: '0 0 4px 1px rgba(255,255,255,0.7)',
          }}
        />
      </div>

      {/* Center disc */}
      <div className="absolute w-[36px] h-[36px] bg-card/95 border border-primary/15 rounded-full shadow flex items-center justify-center backdrop-blur-sm">
        <span className="text-primary font-bold text-lg leading-none select-none tracking-tighter" style={{ marginLeft: '1px' }}>
          D
        </span>
      </div>
    </div>
  );
}
