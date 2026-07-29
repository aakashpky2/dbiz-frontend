"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { CreateMasterValueModal } from "./create-master-value-modal";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface SearchableMasterDropdownProps {
    categoryName: string;
    value: string | string[];
    onChange: (value: any) => void;
    placeholder?: string;
    isMulti?: boolean;
    optionValueType?: 'name' | 'id';
}

export function SearchableMasterDropdown({
    categoryName,
    value,
    onChange,
    placeholder = "Select option...",
    isMulti = false,
    optionValueType = 'name',
}: SearchableMasterDropdownProps) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState("");

    const fetchOptions = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('recruitment_master_values')
                .select(`
          id,
          name,
          category:recruitment_master_categories!inner(name)
        `)
                .eq('category.name', categoryName)
                .order('name');

            if (error) throw error;
            setOptions(data.map((d: any) => ({
                value: optionValueType === 'id' ? d.id : d.name,
                label: d.name
            })));
        } catch (err) {
            console.error(`Error fetching ${categoryName}:`, err);
        } finally {
            setIsLoading(false);
        }
    }, [categoryName, optionValueType]);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    const handleSelect = (currentValue: string) => {
        if (isMulti) {
            const selected = Array.isArray(value) ? value : [];
            const newValue = selected.includes(currentValue)
                ? selected.filter((v) => v !== currentValue)
                : [...selected, currentValue];
            onChange(newValue);
        } else {
            onChange(currentValue);
            setOpen(false);
        }
    };

    const handleCreateSuccess = (newName: string) => {
        fetchOptions();
        if (isMulti) {
            const selected = Array.isArray(value) ? value : [];
            onChange([...selected, newName]);
        } else {
            onChange(newName);
        }
    };

    const selectedLabels = isMulti
        ? (Array.isArray(value) ? value : [])
        : (typeof value === 'string' ? [value] : []);

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className={cn("w-full justify-between h-auto min-h-10 py-2", isMulti && "px-3")}
                    >
                        <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                            {isMulti ? (
                                selectedLabels.length > 0 ? (
                                    selectedLabels.map((label) => (
                                        <Badge key={label} variant="secondary" className="mr-1">
                                            {label}
                                            <X
                                                className="ml-1 h-3 w-3 cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelect(label);
                                                }}
                                            />
                                        </Badge>
                                    ))
                                ) : (
                                    <span className="text-muted-foreground">{placeholder}</span>
                                )
                            ) : (
                                value ? options.find((o) => o.value === value)?.label || value : placeholder
                            )}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-xl border-t-4 border-t-primary">
                    <Command shouldFilter={true}>
                        <CommandInput placeholder={`Search ${categoryName}...`} onValueChange={setSearch} />
                        <CommandList>
                            <CommandEmpty className="py-2 px-4 text-sm text-center">
                                <p className="mb-2">No {categoryName.toLowerCase()} found.</p>
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
                                                selectedLabels.includes(option.value) ? "opacity-100" : "opacity-0"
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
                                    Create New {categoryName}
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <CreateMasterValueModal
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                categoryName={categoryName}
                onSuccess={handleCreateSuccess}
                title={`Add New ${categoryName}`}
            />
        </>
    );
}
