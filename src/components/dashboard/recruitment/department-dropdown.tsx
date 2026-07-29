"use client";

import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/lib/supabase";
import { AddDepartmentDialog } from "@/components/dashboard/admin/department-management/add-department-dialog";

interface DepartmentDropdownProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function DepartmentDropdown({
    value,
    onChange,
    placeholder = "Select department...",
}: DepartmentDropdownProps) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");

    const fetchOptions = async () => {
        setIsLoading(true);
        try {
            // Fetch only active/validated departments if possible, 
            // but usually for dropdown we show all that are not deleted.
            const { data, error } = await supabase
                .from('department_master')
                .select('id, department_name')
                .eq('is_deleted', false)
                .order('department_name');

            if (error) throw error;
            setOptions(data.map((d: any) => ({ value: d.department_name, label: d.department_name })));
        } catch (err) {
            console.error(`Error fetching departments:`, err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOptions();
    }, []);

    const handleSelect = (currentValue: string) => {
        onChange(currentValue);
        setOpen(false);
    };

    const handleCreateSuccess = () => {
        // AddDepartmentDialog in this project doesn't have a callback for success in props,
        // but it dispatches 'department_updated' event or we can just refresh on close.
    };

    useEffect(() => {
        if (!isModalOpen) {
            fetchOptions();
        }
    }, [isModalOpen]);

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-auto min-h-10 py-2"
                    >
                        {value ? options.find((o) => o.value === value)?.label || value : placeholder}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-xl border-t-4 border-t-primary">
                    <Command shouldFilter={true}>
                        <CommandInput placeholder="Search departments..." onValueChange={setSearch} />
                        <CommandList>
                            <CommandEmpty className="py-2 px-4 text-sm text-center">
                                <p className="mb-2">No department found.</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs"
                                    onClick={() => setIsModalOpen(true)}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Create "{search}"
                                </Button>
                            </CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        onSelect={() => handleSelect(option.value)}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === option.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {option.label}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                                <CommandItem
                                    onSelect={() => setIsModalOpen(true)}
                                    className="text-primary font-medium"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create New Department
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <AddDepartmentDialog
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
            />
        </>
    );
}
