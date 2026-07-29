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
import { Department, transferWorkType } from '@/lib/department-management';
import { useToast } from '@/hooks/use-toast';

interface TransferWorkTypeFormProps {
  departments: Department[];
}

export const TransferWorkTypeForm: React.FC<TransferWorkTypeFormProps> = ({ departments }) => {
  const [sourceDepartmentId, setSourceDepartmentId] = useState<string | undefined>(undefined);
  const [sourceCategoryId, setSourceCategoryId] = useState<string | undefined>(undefined);
  const [sourceWorkTypeId, setSourceWorkTypeId] = useState<string | undefined>(undefined);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | undefined>(undefined);
  const [targetCategoryId, setTargetCategoryId] = useState<string | undefined>(undefined);
  const { toast } = useToast();

  const handleTransfer = async () => {
    if (!sourceDepartmentId || !sourceCategoryId || !sourceWorkTypeId || !targetDepartmentId || !targetCategoryId) {
      toast({ title: "Error", description: "Please fill all the fields.", variant: "destructive" });
      return;
    }

    try {
      await transferWorkType(
        { departmentId: sourceDepartmentId, categoryId: sourceCategoryId, workTypeId: sourceWorkTypeId },
        { departmentId: targetDepartmentId, categoryId: targetCategoryId }
      );
      toast({ title: "Success", description: "Work type transferred successfully." });
      setSourceDepartmentId(undefined);
      setSourceCategoryId(undefined);
      setSourceWorkTypeId(undefined);
      setTargetDepartmentId(undefined);
      setTargetCategoryId(undefined);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const sourceCategories = departments.find(d => d.id === sourceDepartmentId)?.workCategories || [];
  const sourceWorkTypes = sourceCategories.find(c => c.id === sourceCategoryId)?.workTypes || [];
  const targetCategories = departments.find(d => d.id === targetDepartmentId)?.workCategories || [];

  return (
    <div className="p-4 border rounded-lg mt-8">
      <h3 className="text-lg font-semibold mb-4">Transfer Work Type</h3>
      
      <div className="grid gap-4">
        <div>
            <label>Source</label>
            <div className="grid grid-cols-3 gap-2">
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
                <Select onValueChange={setSourceWorkTypeId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select work type" />
                    </SelectTrigger>
                    <SelectContent>
                        {sourceWorkTypes.map(wt => (
                            <SelectItem key={wt.id} value={wt.id}>{wt.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div>
            <label>Target</label>
            <div className="grid grid-cols-2 gap-2">
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
                <Select onValueChange={setTargetCategoryId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                        {targetCategories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>


        <Button onClick={handleTransfer}>Transfer Work Type</Button>
      </div>
    </div>
  );
};
