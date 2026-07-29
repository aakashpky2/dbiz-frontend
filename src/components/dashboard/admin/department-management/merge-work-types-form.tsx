"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Department, WorkCategory, WorkType, mergeWorkTypes } from '@/lib/department-management';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface MergeWorkTypesFormProps {
  departments: Department[];
}

export const MergeWorkTypesForm: React.FC<MergeWorkTypesFormProps> = ({ departments }) => {
  const [sourceWorkTypes, setSourceWorkTypes] = useState<{ departmentId: string; categoryId: string; workTypeId: string }[]>([]);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | undefined>(undefined);
  const [targetCategoryId, setTargetCategoryId] = useState<string | undefined>(undefined);
  const [targetWorkTypeId, setTargetWorkTypeId] = useState<string | undefined>(undefined);
  const [newWorkTypeName, setNewWorkTypeName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { toast } = useToast();

  const handleMerge = async () => {
    if (sourceWorkTypes.length < 2) {
      toast({ title: "Error", description: "Please select at least two source work types.", variant: "destructive" });
      return;
    }
    if (!targetDepartmentId || !targetCategoryId) {
      toast({ title: "Error", description: "Please select a target department and category.", variant: "destructive" });
      return;
    }
    if (!targetWorkTypeId && !newWorkTypeName) {
      toast({ title: "Error", description: "Please select a target work type or provide a name for a new one.", variant: "destructive" });
      return;
    }

    try {
      await mergeWorkTypes(sourceWorkTypes, { departmentId: targetDepartmentId, categoryId: targetCategoryId, workTypeId: targetWorkTypeId, name: newWorkTypeName });
      toast({ title: "Success", description: "Work types merged successfully." });
      setSourceWorkTypes([]);
      setTargetDepartmentId(undefined);
      setTargetCategoryId(undefined);
      setTargetWorkTypeId(undefined);
      setNewWorkTypeName('');
      setIsCreatingNew(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const allWorkTypes = departments.flatMap(d => 
    (d.workCategories || []).flatMap(c => 
      (c.workTypes || []).map(wt => ({...wt, categoryId: c.id, departmentId: d.id}))
    )
  );
  
  const targetCategories = departments.find(d => d.id === targetDepartmentId)?.workCategories || [];

  return (
    <div className="p-4 border rounded-lg mt-8">
      <h3 className="text-lg font-semibold mb-4">Merge Work Types</h3>
      
      <div className="grid gap-4">
        <div>
            <label>Source Work Types (select multiple)</label>
            <Select onValueChange={(value) => {
                const [departmentId, categoryId, workTypeId] = value.split(':');
                if (departmentId && categoryId && workTypeId && !sourceWorkTypes.find(s => s.workTypeId === workTypeId)) {
                    setSourceWorkTypes([...sourceWorkTypes, { departmentId, categoryId, workTypeId }]);
                }
            }}>
                <SelectTrigger>
                    <SelectValue placeholder="Select source work types" />
                </SelectTrigger>
                <SelectContent>
                    {allWorkTypes.map(wt => (
                        <SelectItem key={wt.id} value={`${wt.departmentId}:${wt.categoryId}:${wt.id}`}>{departments.find(d => d.id === wt.departmentId)?.name} - {departments.find(d => d.id === wt.departmentId)?.workCategories.find(c => c.id === wt.categoryId)?.name} - {wt.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 mt-2">
                {sourceWorkTypes.map(c => (
                    <div key={c.workTypeId} className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-md border border-slate-200">
                        {allWorkTypes.find(w => w.id === c.workTypeId)?.name || "Unknown Work Type"}
                    </div>
                ))}
            </div>
        </div>

        <div>
            <label>Target Department</label>
            <Select onValueChange={setTargetDepartmentId}>
                <SelectTrigger>
                    <SelectValue placeholder="Select target department" />
                </SelectTrigger>
                <SelectContent>
                    {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {targetDepartmentId && (
            <div>
                <label>Target Work Category</label>
                <Select onValueChange={setTargetCategoryId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select target category" />
                    </SelectTrigger>
                    <SelectContent>
                        {targetCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        )}

        {targetCategoryId && (
            <div>
                <label>Target Work Type</label>
                <div className="flex items-center gap-2">
                    <Select onValueChange={setTargetWorkTypeId} disabled={isCreatingNew}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select target work type" />
                        </SelectTrigger>
                        <SelectContent>
                            {targetCategories.find(c => c.id === targetCategoryId)?.workTypes?.map(wt => (
                                <SelectItem key={wt.id} value={wt.id}>{wt.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <span className="text-sm">OR</span>

                    <Input 
                        placeholder="Create new target work type"
                        value={newWorkTypeName}
                        onChange={(e) => {
                            setNewWorkTypeName(e.target.value)
                            setIsCreatingNew(!!e.target.value)
                        }}
                    />
                </div>
            </div>
        )}

        <Button onClick={handleMerge}>Merge Work Types</Button>
      </div>
    </div>
  );
};
