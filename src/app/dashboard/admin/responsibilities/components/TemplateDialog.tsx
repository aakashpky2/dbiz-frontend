"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useRbacAdmin } from "@/contexts/RbacAdminContext";
import { rbacService } from "@/services/rbacService";
import { Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function TemplateDialog({ isOpen, setIsOpen, template }: { isOpen: boolean, setIsOpen: (o: boolean) => void, template: any }) {
  const { templates, refreshTemplates } = useRbacAdmin();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [selectedDeps, setSelectedDeps] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name || "");
      setDescription(template.description || "");
      setCategory(template.category || "General");
      setSelectedPerms(new Set(template.permissions || []));
      setSelectedDeps(new Set(template.child_templates || []));
    } else {
      setName("");
      setDescription("");
      setCategory("General");
      setSelectedPerms(new Set());
      setSelectedDeps(new Set());
    }
  }, [template, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (template) {
        await rbacService.updateTemplate(template.id, {
          name, description, category,
          permissions: Array.from(selectedPerms),
          childTemplates: Array.from(selectedDeps)
        });
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await rbacService.createTemplate({
          name, description, category,
          permissions: Array.from(selectedPerms),
          childTemplates: Array.from(selectedDeps)
        });
        toast({ title: "Success", description: "Template created successfully" });
      }
      refreshTemplates();
      setIsOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b bg-background">
          <DialogTitle>{template ? 'Editing "Responsibility Template"' : 'Adding New Responsibility Template'}</DialogTitle>
          <DialogDescription>
            {template ? 'Update the details of this item.' : 'Enter the details for Responsibility Template.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-2 bg-background border-b">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50">
              <TabsTrigger value="general" className="py-2">General Info</TabsTrigger>
              <TabsTrigger value="permissions" className="py-2">Permissions</TabsTrigger>
              <TabsTrigger value="dependencies" className="py-2">Dependencies</TabsTrigger>
              <TabsTrigger value="preview" className="py-2">Impact Preview</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <TabsContent value="general" className="mt-0 h-full">
              <div className="space-y-4 bg-card border rounded-md p-6">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HR Manager" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Human Resources" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief explanation of this responsibility" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="permissions" className="mt-0 h-full">
              <div className="bg-card border rounded-md p-6 text-sm">
                <p className="text-muted-foreground mb-4">Select the specific permissions included in this template.</p>
                <div className="text-muted-foreground italic border p-4 rounded bg-slate-50">
                  (Permission catalogue selection UI placeholder)
                </div>
              </div>
            </TabsContent>

            <TabsContent value="dependencies" className="mt-0 h-full">
              <div className="bg-card border rounded-md p-6 text-sm">
                <p className="text-muted-foreground mb-4">Nest other templates inside this one. Avoid circular dependencies.</p>
                <div className="space-y-2">
                  {templates.filter(t => t.id !== template?.id).map(t => (
                    <div key={t.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-slate-50">
                      <Checkbox 
                        checked={selectedDeps.has(t.id)} 
                        onCheckedChange={(c) => {
                          const next = new Set(selectedDeps);
                          if (c) next.add(t.id);
                          else next.delete(t.id);
                          setSelectedDeps(next);
                        }} 
                      />
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.category}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-0 h-full">
              <div className="bg-card border rounded-md p-6 text-sm space-y-4">
                <div className="flex items-start gap-3 bg-amber-50 text-amber-800 p-4 border border-amber-200 rounded-md">
                  <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-bold mb-1">Impact Preview</h4>
                    <p className="text-xs">
                      When you save this template, all users currently assigned to it will immediately inherit the changes.
                    </p>
                  </div>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="w-full mt-4">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm & Save Template
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
