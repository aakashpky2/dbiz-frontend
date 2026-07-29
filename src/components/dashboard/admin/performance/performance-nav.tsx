'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function PerformanceNav() {
    const pathname = usePathname();

    const links = [
        { href: '/dashboard/admin/performance', label: 'Dashboard' },
        { href: '/dashboard/admin/performance/reviews', label: 'Employee Reviews' },
        { href: '/dashboard/admin/performance/analytics', label: 'Analytics' },
        { href: '/dashboard/admin/performance/settings', label: 'Performance Settings' }
    ];

    return (
        <div className="flex space-x-2 border-b pb-4 mb-4">
            {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                    <Link 
                        key={link.href}
                        href={link.href} 
                        className={`px-4 py-2 font-medium rounded-md text-sm transition-colors ${
                            isActive 
                            ? 'bg-primary text-primary-foreground' 
                            : 'text-muted-foreground hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                        {link.label}
                    </Link>
                );
            })}
        </div>
    );
}
