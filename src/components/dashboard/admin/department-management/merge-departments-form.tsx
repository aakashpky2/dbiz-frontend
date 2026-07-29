"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Department } from '@/lib/department-management';
import { mergeDepartments } from '@/lib/department-management';
import { useToast } from '@/hooks/use-toast';

interface MergeDepartmentsFormProps {
  departments: Department[];
}

export const MergeDepartmentsForm: React.FC<MergeDepartmentsFormProps> = ({ departments }) => {
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | undefined>(undefined);
  const [newTargetName, setNewTargetName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const { toast } = useToast();

  const handleMerge = async () => {
    if (sourceIds.length === 0) {
      toast({ title: "Error", description: "Please select at least one source department.", variant: "destructive" });
      return;
    }
    if (!targetId && !newTargetName) {
      toast({ title: "Error", description: "Please select a target department or provide a name for a new one.", variant: "destructive" });
      return;
    }
    if (targetId && sourceIds.includes(targetId)) {
        toast({ title: "Error", description: "Cannot merge a department into itself.", variant: "destructive" });
        return;
    }


    try {
      await mergeDepartments(sourceIds, { id: targetId, name: newTargetName });
      toast({ title: "Success", description: "Departments merged successfully." });
      setSourceIds([]);
      setTargetId(undefined);
      setNewTargetName('');
      setIsCreatingNew(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 border rounded-lg mt-8">
      <h3 className="text-lg font-semibold mb-4">Merge Departments</h3>
      
      <div className="grid gap-4">
        <div>
            <label>Source Departments</label>
             <Select onValueChange={(value) => setSourceIds(value ? [value] : [])}>
                <SelectTrigger>
                    <SelectValue placeholder="Select source departments" />
                </SelectTrigger>
                <SelectContent>
                    {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <div>
            <label>Target Department</label>
            <div className="flex items-center gap-2">
                <Select onValueChange={setTargetId} disabled={isCreatingNew}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select target department" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.filter(d => !sourceIds.includes(d.id)).map(dept => (
                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <span className="text-sm">OR</span>

                <Input 
                    placeholder="Create new target department"
                    value={newTargetName}
                    onChange={(e) => {
                        setNewTargetName(e.target.value)
                        setIsCreatingNew(!!e.target.value)
                    }}
                />
            </div>
        </div>

        <Button onClick={handleMerge}>Merge Departments</Button>
      </div>
    </div>
  );
};
