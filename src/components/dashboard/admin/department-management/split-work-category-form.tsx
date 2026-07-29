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
import { Department, WorkType, splitWorkCategory } from '@/lib/department-management';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2 } from 'lucide-react';

interface SplitWorkCategoryFormProps {
  departments: Department[];
}

export const SplitWorkCategoryForm: React.FC<SplitWorkCategoryFormProps> = ({ departments }) => {
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [sourceCategoryId, setSourceCategoryId] = useState<string | undefined>(undefined);
  const [newCategories, setNewCategories] = useState<{ name: string; workTypeIds: string[] }[]>([]);
  const { toast } = useToast();
  
  const handleSplit = async () => {
    if (!departmentId || !sourceCategoryId || newCategories.length < 2) {
      toast({ title: "Error", description: "Please select a department, a source category and define at least two new categories.", variant: "destructive" });
      return;
    }

    try {
      await splitWorkCategory(departmentId, sourceCategoryId, newCategories);
      toast({ title: "Success", description: "Work category split successfully." });
      setDepartmentId(undefined);
      setSourceCategoryId(undefined);
      setNewCategories([]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const categories = departments.find(d => d.id === departmentId)?.workCategories || [];
  const workTypes = categories.find(c => c.id === sourceCategoryId)?.workTypes || [];
  
  const handleAddNewCategory = () => {
      setNewCategories([...newCategories, {name: '', workTypeIds: []}])
  }
  
  const handleNewCategoryNameChange = (index: number, name: string) => {
      const updated = [...newCategories];
      updated[index].name = name;
      setNewCategories(updated);
  }
  
  const handleWorkTypeSelection = (catIndex: number, workTypeId: string) => {
      const updated = [...newCategories];
      const category = updated[catIndex];
      if (category.workTypeIds.includes(workTypeId)) {
          category.workTypeIds = category.workTypeIds.filter(id => id !== workTypeId);
      } else {
          category.workTypeIds.push(workTypeId)
      }
      setNewCategories(updated);
  }

  return (
    <div className="p-4 border rounded-lg mt-8">
      <h3 className="text-lg font-semibold mb-4">Split Work Category</h3>
      
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2">
            <Select onValueChange={setDepartmentId}>
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
                    <SelectValue placeholder="Select source category" />
                </SelectTrigger>
                <SelectContent>
                    {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        
        {sourceCategoryId && (
            <div>
                <Button onClick={handleAddNewCategory}><PlusCircle className="mr-2 h-4 w-4" /> Add New Category</Button>
                
                <div className="grid gap-4 mt-4">
                    {newCategories.map((cat, catIndex) => (
                        <div key={catIndex} className="p-2 border rounded">
                            <Input 
                                placeholder="New category name"
                                value={cat.name}
                                onChange={e => handleNewCategoryNameChange(catIndex, e.target.value)}
                            />
                            <div className="grid grid-cols-3 gap-2 mt-2">
                                {workTypes.map(wt => (
                                    <div key={wt.id} className="flex items-center">
                                        <input 
                                            type="checkbox"
                                            checked={cat.workTypeIds.includes(wt.id)}
                                            onChange={() => handleWorkTypeSelection(catIndex, wt.id)}
                                        />
                                        <label className="ml-2">{wt.name}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <Button onClick={handleSplit}>Split Work Category</Button>
      </div>
    </div>
  );
};
