import React from 'react';
import { Input } from '@/components/ui/input';

export interface MissingValueRequirement {
    mapping_id: string;
    display_name: string;
    data_type: string;
    required_for: string;
}

interface GovernmentFeeInputsProps {
    missingValues: MissingValueRequirement[];
    values: Record<string, any>;
    onChange: (mapping_id: string, value: any) => void;
    className?: string;
}

export function GovernmentFeeInputs({ missingValues, values, onChange, className = '' }: GovernmentFeeInputsProps) {
    if (!missingValues || missingValues.length === 0) return null;

    return (
        <div className={`bg-amber-50 border border-amber-200 rounded-md p-4 ${className}`}>
            <label className="text-sm font-bold text-amber-900 mb-1 block flex items-center gap-1">
                Additional Information Required
            </label>
            <p className="text-xs text-amber-700 mb-4">
                Please provide the following values to calculate the final government fees dynamically.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {missingValues.map((missing) => (
                    <div key={missing.mapping_id} className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-amber-900">
                            {missing.display_name} <span className="text-red-500">*</span>
                        </label>
                        <Input 
                            type={missing.data_type === 'number' ? 'number' : missing.data_type === 'date' ? 'date' : 'text'}
                            className="h-9 text-sm bg-white border-amber-300 focus-visible:ring-amber-500" 
                            placeholder={`Enter ${missing.display_name}`}
                            value={values[missing.mapping_id] || ''} 
                            onChange={e => onChange(missing.mapping_id, e.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
