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
import { Department, transferWorkCategory } from '@/lib/department-management';
import { useToast } from '@/hooks/use-toast';

interface TransferWorkCategoryFormProps {
  departments: Department[];
}

export const TransferWorkCategoryForm: React.FC<TransferWorkCategoryFormProps> = ({ departments }) => {
  const [sourceDepartmentId, setSourceDepartmentId] = useState<string | undefined>(undefined);
  const [sourceCategoryId, setSourceCategoryId] = useState<string | undefined>(undefined);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  const handleTransfer = async () => {
    if (!sourceDepartmentId || !sourceCategoryId || !targetDepartmentId) {
      toast({ title: "Error", description: "Please fill all the fields.", variant: "destructive" });
      return;
    }

    try {
      await transferWorkCategory(
        sourceDepartmentId,
        sourceCategoryId,
        targetDepartmentId
      );
      toast({ title: "Success", description: "Work category transferred successfully." });
      setSourceDepartmentId(undefined);
      setSourceCategoryId(undefined);
      setTargetDepartmentId(undefined);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const sourceCategories = departments.find(d => d.id === sourceDepartmentId)?.workCategories || [];

  return (
    <div className="p-4 border rounded-lg mt-8">
      <h3 className="text-lg font-semibold mb-4">Transfer Work Category</h3>
      
      <div className="grid gap-4">
        <div>
            <label>Source</label>
            <div className="grid grid-cols-2 gap-2">
                <Select onValueChange={setSourceDepartmentId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.map(dept => (
                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select onValueChange={setSourceCategoryId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                        {sourceCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div>
            <label>Target Department</label>
            <Select onValueChange={setTargetDepartmentId}>
                <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                    {departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>


        <Button onClick={handleTransfer}>Transfer Work Category</Button>
      </div>
    </div>
  );
};
