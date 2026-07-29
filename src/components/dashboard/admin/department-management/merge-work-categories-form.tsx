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
import { Department, WorkCategory, mergeWorkCategories } from '@/lib/department-management';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface MergeWorkCategoriesFormProps {
  departments: Department[];
}

export const MergeWorkCategoriesForm: React.FC<MergeWorkCategoriesFormProps> = ({ departments }) => {
  const [sourceCategories, setSourceCategories] = useState<{ departmentId: string; categoryId: string }[]>([]);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | undefined>(undefined);
  const [targetCategoryId, setTargetCategoryId] = useState<string | undefined>(undefined);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { toast } = useToast();

  const handleMerge = async () => {
    if (sourceCategories.length < 2) {
      toast({ title: "Error", description: "Please select at least two source categories.", variant: "destructive" });
      return;
    }
    if (!targetDepartmentId) {
      toast({ title: "Error", description: "Please select a target department.", variant: "destructive" });
      return;
    }
    if (!targetCategoryId && !newCategoryName) {
      toast({ title: "Error", description: "Please select a target category or provide a name for a new one.", variant: "destructive" });
      return;
    }

    try {
      await mergeWorkCategories(sourceCategories, { departmentId: targetDepartmentId, categoryId: targetCategoryId, name: newCategoryName });
      toast({ title: "Success", description: "Work categories merged successfully." });
      setSourceCategories([]);
      setTargetDepartmentId(undefined);
      setTargetCategoryId(undefined);
      setNewCategoryName('');
      setIsCreatingNew(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const allCategories = departments.flatMap(d => (d.workCategories || []).map(c => ({...c, departmentId: d.id})));

  return (
    <div className="p-4 border rounded-lg mt-8">
      <h3 className="text-lg font-semibold mb-4">Merge Work Categories</h3>
      
      <div className="grid gap-4">
        <div>
            <label>Source Work Categories (select multiple)</label>
            <Select onValueChange={(value) => {
                const [departmentId, categoryId] = value.split(':');
                if (departmentId && categoryId && !sourceCategories.find(s => s.categoryId === categoryId)) {
                    setSourceCategories([...sourceCategories, { departmentId, categoryId }]);
                }
            }}>
                <SelectTrigger>
                    <SelectValue placeholder="Select source categories" />
                </SelectTrigger>
                <SelectContent>
                    {allCategories.map(cat => (
                        <SelectItem key={cat.id} value={`${cat.departmentId}:${cat.id}`}>{departments.find(d => d.id === cat.departmentId)?.name} - {cat.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <div>
                {sourceCategories.map(c => <div key={c.categoryId}>{departments.find(d => d.id === c.departmentId)?.name} - {allCategories.find(ac => ac.id === c.categoryId)?.name}</div>)}
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
                <div className="flex items-center gap-2">
                    <Select onValueChange={setTargetCategoryId} disabled={isCreatingNew}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select target category" />
                        </SelectTrigger>
                        <SelectContent>
                            {departments.find(d => d.id === targetDepartmentId)?.workCategories?.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <span className="text-sm">OR</span>

                    <Input 
                        placeholder="Create new target category"
                        value={newCategoryName}
                        onChange={(e) => {
                            setNewCategoryName(e.target.value)
                            setIsCreatingNew(!!e.target.value)
                        }}
                    />
                </div>
            </div>
        )}

        <Button onClick={handleMerge}>Merge Work Categories</Button>
      </div>
    </div>
  );
};
