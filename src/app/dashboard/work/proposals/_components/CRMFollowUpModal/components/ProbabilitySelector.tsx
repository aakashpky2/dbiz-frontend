'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface ProbabilitySelectorProps {
    value: number;
    onChange: (val: number) => void;
}

export const ProbabilitySelector: React.FC<ProbabilitySelectorProps> = ({ value, onChange }) => {
    // 0-30 Cold (1-2 stars), 31-70 Warm (3 stars), 71-100 Hot (4-5 stars)
    const rating = Math.max(1, Math.min(5, Math.ceil(value / 20)));
    
    const getLabel = () => {
        if (value <= 30) return { text: 'Cold', color: 'text-blue-500 bg-blue-50' };
        if (value <= 70) return { text: 'Warm', color: 'text-amber-500 bg-amber-50' };
        return { text: 'Hot', color: 'text-red-500 bg-red-50' };
    };

    const label = getLabel();

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deal Intelligence (Probability)</Label>
                <div className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors", label.color)}>
                    {label.text} ({value}%)
                </div>
            </div>
            <div className="flex gap-2 items-center p-3 border border-slate-100 bg-slate-50/50 rounded-2xl w-full justify-center">
                {[1, 2, 3, 4, 5].map(star => (
                    <button 
                        type="button" 
                        key={star} 
                        onClick={() => onChange(star * 20)} 
                        className={cn(
                            "transition-all duration-300 transform active:scale-90",
                            star <= rating ? "text-amber-400 scale-110" : "text-slate-200 hover:text-slate-300"
                        )}
                    >
                        <Star className={cn("h-7 w-7", star <= rating ? "fill-current" : "")} />
                    </button>
                ))}
            </div>
        </div>
    );
};
