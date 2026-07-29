"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface MultiSelectComboboxProps {
  options: { value: string; label: string; description?: string }[];
  value?: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  triggerLabel?: string;
  selectedItemsLabel?: string;
  maxDisplay?: number;
  selectAllLabel?: string;
  selectAllMode?: 'empty-array' | 'all-ids';
  onSearchChange?: (search: string) => void;
  loading?: boolean;
}

export function MultiSelectCombobox({
  options,
  value = [],
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  triggerLabel,
  selectedItemsLabel = "items selected",
  maxDisplay = 2,
  selectAllLabel,
  selectAllMode = 'empty-array',
  onSearchChange,
  loading = false,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const cleanedOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return options.filter((opt) => {
      const val = opt.value?.trim();
      const lab = opt.label?.trim();
      if (!val || !lab) return false;
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }, [options]);

  const handleSearchChange = React.useCallback((val: string) => {
    setSearch(val)
    if (onSearchChange) {
      onSearchChange(val)
    }
  }, [onSearchChange])

  const filteredOptions = cleanedOptions.filter((option) => {
    return (
      option.label.toLowerCase().includes(search.toLowerCase()) ||
      option.value.toLowerCase().includes(search.toLowerCase()) ||
      (option.description && option.description.toLowerCase().includes(search.toLowerCase()))
    )
  })

  const allOption = selectAllLabel ? { value: "__ALL__", label: selectAllLabel, description: undefined } : null;
  const showAllOption = allOption && (!search || allOption.label.toLowerCase().includes(search.toLowerCase()));
  const displayOptions = showAllOption ? [allOption, ...filteredOptions] : filteredOptions;

  const isAllSelected = React.useMemo(() => {
    if (!selectAllLabel) return false;
    if (selectAllMode === 'all-ids') {
      return cleanedOptions.length > 0 && cleanedOptions.every((opt) => value.includes(opt.value));
    } else {
      return value.length === 0 || value.includes("__ALL__");
    }
  }, [value, cleanedOptions, selectAllLabel, selectAllMode]);

  const handleSelect = (val: string) => {
    if (!selectAllLabel) {
      if (value.includes(val)) {
        onChange(value.filter((v) => v !== val))
      } else {
        onChange([...value, val])
      }
      return;
    }

    if (val === "__ALL__") {
      if (selectAllMode === 'all-ids') {
        if (isAllSelected) {
          onChange([]);
        } else {
          onChange(cleanedOptions.map((opt) => opt.value));
        }
      } else {
        onChange([]); // Use empty array to represent "All"
      }
    } else {
      if (isAllSelected) {
        // If "All" is selected and user clicks a specific item, select ONLY that item
        onChange([val]);
      } else {
        let newValue: string[];
        if (value.includes(val)) {
          newValue = value.filter((v) => v !== val);
        } else {
          newValue = [...value, val];
        }

        // If user manually selected all options, optionally convert to "All"
        const hasAllSelected = cleanedOptions.length > 0 && cleanedOptions.every((opt) => newValue.includes(opt.value));
        if (hasAllSelected) {
          onChange(selectAllMode === 'all-ids' ? cleanedOptions.map(opt => opt.value) : []);
        } else if (newValue.length === 0) {
          onChange([]);
        } else {
          onChange(newValue);
        }
      }
    }
  }

  // Determine what label to show inside the closed trigger
  const displayLabel = React.useMemo(() => {
    if (cleanedOptions.length === 0) return "No options available";
    if (triggerLabel) return triggerLabel;

    if (selectAllLabel && isAllSelected) {
      return selectAllLabel;
    }

    if (!value || value.length === 0) return placeholder;

    // Map selected values to their labels
    const selectedLabels = value
      .map((val) => cleanedOptions.find((opt) => opt.value === val)?.label)
      .filter(Boolean);

    if (selectedLabels.length === 0) {
      return selectAllLabel || placeholder;
    }
    if (selectedLabels.length === 1) {
      return selectedLabels[0];
    }
    return `${selectedLabels.length} Selected`;
  }, [value, cleanedOptions, placeholder, triggerLabel, selectAllLabel, isAllSelected]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal min-w-0 h-auto min-h-10 py-2"
          disabled={disabled || cleanedOptions.length === 0}
        >
          <span className="truncate flex-1 text-left mr-2 leading-tight text-sm">
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 mt-0.5 self-start" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={handleSearchChange}
          />
          <CommandList>
            {loading && <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>}
            {!loading && displayOptions.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
            {!loading && (
            <CommandGroup>
              {displayOptions.map((option) => {
                const isSelected = option.value === "__ALL__"
                  ? isAllSelected
                  : (!isAllSelected && value.includes(option.value));
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    onSelect={() => handleSelect(option.value)}
                    title={option.label}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1 py-1">
                      <span className="whitespace-normal break-words leading-tight text-sm">{option.label}</span>
                      {option.description && (
                        <span className="text-[10px] text-muted-foreground whitespace-normal break-words leading-tight mt-0.5">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
