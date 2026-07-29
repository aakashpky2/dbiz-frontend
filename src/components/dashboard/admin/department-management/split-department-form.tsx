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
import { Department, splitDepartment } from '@/lib/department-management';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { PlusCircle } from 'lucide-react';

interface SplitDepartmentFormProps {
  departments: Department[];
}

export const SplitDepartmentForm: React.FC<SplitDepartmentFormProps> = ({ departments }) => {
  const [sourceDepartmentId, setSourceDepartmentId] = useState<string | undefined>(undefined);
  const [newDepartments, setNewDepartments] = useState<{ name: string; workCategoryIds: string[] }[]>([]);
  const { toast } = useToast();
  
  const handleSplit = async () => {
    if (!sourceDepartmentId || newDepartments.length < 2) {
      toast({ title: "Error", description: "Please select a source department and define at least two new departments.", variant: "destructive" });
      return;
    }

    try {
      await splitDepartment(sourceDepartmentId, newDepartments);
      toast({ title: "Success", description: "Department split successfully." });
      setSourceDepartmentId(undefined);
      setNewDepartments([]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const sourceDepartment = departments.find(d => d.id === sourceDepartmentId);
  const workCategories = sourceDepartment?.workCategories || [];
  
  const handleAddNewDepartment = () => {
      setNewDepartments([...newDepartments, {name: '', workCategoryIds: []}])
  }
  
  const handleNewDepartmentNameChange = (index: number, name: string) => {
      const updated = [...newDepartments];
      updated[index].name = name;
      setNewDepartments(updated);
  }
  
  const handleCategorySelection = (depIndex: number, catId: string) => {
      const updated = [...newDepartments];
      const department = updated[depIndex];
      if (department.workCategoryIds.includes(catId)) {
          department.workCategoryIds = department.workCategoryIds.filter(id => id !== catId);
      } else {
          department.workCategoryIds.push(catId)
      }
      setNewDepartments(updated);
  }

  return (
    <div className="p-4 border rounded-lg mt-8">
      <h3 className="text-lg font-semibold mb-4">Split Department</h3>
      
      <div className="grid gap-4">
        <Select onValueChange={setSourceDepartmentId}>
            <SelectTrigger>
                <SelectValue placeholder="Select source department" />
            </SelectTrigger>
            <SelectContent>
                {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        
        {sourceDepartmentId && (
            <div>
                <Button onClick={handleAddNewDepartment}><PlusCircle className="mr-2 h-4 w-4" /> Add New Department</Button>
                
                <div className="grid gap-4 mt-4">
                    {newDepartments.map((dep, depIndex) => (
                        <div key={depIndex} className="p-2 border rounded">
                            <Input 
                                placeholder="New department name"
                                value={dep.name}
                                onChange={e => handleNewDepartmentNameChange(depIndex, e.target.value)}
                            />
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {workCategories.map(cat => (
                                    <div key={cat.id} className="flex items-center">
                                        <input 
                                            type="checkbox"
                                            checked={dep.workCategoryIds.includes(cat.id)}
                                            onChange={() => handleCategorySelection(depIndex, cat.id)}
                                        />
                                        <label className="ml-2">{cat.name}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <Button onClick={handleSplit}>Split Department</Button>
      </div>
    </div>
  );
};
