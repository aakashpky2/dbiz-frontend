import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationControlsProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

export function PaginationControls({
    currentPage,
    totalPages,
    onPageChange,
    className
}: PaginationControlsProps) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) {
                pages.push('...');
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            if (currentPage <= 3) {
                for (let i = 2; i <= 4; i++) pages.push(i);
            } else if (currentPage >= totalPages - 2) {
                for (let i = totalPages - 3; i < totalPages; i++) pages.push(i);
            } else {
                for (let i = start; i <= end; i++) pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className={cn("flex items-center justify-center space-x-2 py-4", className)}>
            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8"
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center space-x-1">
                {getPageNumbers().map((page, index) => (
                    typeof page === 'number' ? (
                        <Button
                            key={index}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => onPageChange(page)}
                            className="h-8 w-8 text-xs font-semibold"
                        >
                            {page}
                        </Button>
                    ) : (
                        <div key={index} className="flex h-8 w-8 items-center justify-center text-muted-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                        </div>
                    )
                ))}
            </div>

            <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8"
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
