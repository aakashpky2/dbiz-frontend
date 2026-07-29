"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { RefreshCw, Check, ChevronsUpDown } from 'lucide-react';
import dynamic from 'next/dynamic';
const FieldBuilderTab = dynamic(() => import('./FieldBuilderTab').then(mod => mod.FieldBuilderTab), { ssr: false });
const FeeRulesTab = dynamic(() => import('./FeeRulesTab').then(mod => mod.FeeRulesTab), { ssr: false });
import { useToast } from '@/hooks/use-toast';

export default function GovernmentFeePage() {
  const [workTypes, setWorkTypes] = useState<any[]>([]);
  const [selectedWorkTypeId, setSelectedWorkTypeId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('fields');

  const fetchWorkTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/work-types', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const result = await response.json();
      if (result.success && result.data) {
        setWorkTypes(result.data);
      } else if (Array.isArray(result)) {
        setWorkTypes(result);
      } else {
        setWorkTypes([]);
      }
    } catch (e) {
      console.error('Failed to fetch work types', e);
      setWorkTypes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkTypes();
  }, [fetchWorkTypes]);

  return (
    <div className="w-full max-w-none space-y-6 pb-12">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pt-6 pb-4 border-b flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Government Fee Builder</h2>
          <p className="text-muted-foreground mt-1">Configure dynamic fields and government fee rules by work type.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchWorkTypes} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-5 pt-5 border-b bg-slate-50/50">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="w-full md:w-[480px] space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Work Type</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={isLoading || workTypes.length === 0}
                    className="w-full justify-between font-normal bg-white"
                  >
                    {isLoading ? "Loading work types..." : 
                     workTypes.length === 0 ? "No Work Types Available" :
                     selectedWorkTypeId
                      ? workTypes.find((wt) => wt.id === selectedWorkTypeId)?.name
                      : "Search and select work type..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] md:w-[480px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search work type..." />
                    <CommandList>
                      <CommandEmpty>No work type found.</CommandEmpty>
                      <CommandGroup>
                        {workTypes.map((wt) => (
                          <CommandItem
                            key={wt.id}
                            value={wt.name}
                            onSelect={() => {
                              setSelectedWorkTypeId(wt.id === selectedWorkTypeId ? '' : wt.id);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedWorkTypeId === wt.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {wt.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Select a work type to configure fields and fee rules.</p>
            </div>
            
            {selectedWorkTypeId && (
              <div className="shrink-0 bg-white border rounded-lg p-3 shadow-sm min-w-[200px] flex flex-col justify-center self-start mt-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Active Configuration</span>
                <div className="font-semibold text-primary truncate max-w-[250px]">
                  {workTypes.find((wt) => wt.id === selectedWorkTypeId)?.name}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {selectedWorkTypeId ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="fields">Field Builder</TabsTrigger>
                <TabsTrigger value="rules">Fee Rules</TabsTrigger>
              </TabsList>
              
              <TabsContent value="fields" className="mt-0">
                {activeTab === 'fields' && <FieldBuilderTab workTypeId={selectedWorkTypeId} />}
              </TabsContent>
              
              <TabsContent value="rules" className="mt-0">
                {activeTab === 'rules' && <FeeRulesTab workTypeId={selectedWorkTypeId} />}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="py-12 text-center text-muted-foreground bg-slate-50/50 rounded-lg border border-dashed">
              Please select a Work Type above to configure its dynamic fields and government fee rules.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

