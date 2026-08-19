'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertTriangle, ShieldCheck, Inbox, PlusCircle, Edit, Trash2, Search, Shield, Users, Lock, ArrowUp } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIZED_PERMISSIONS } from '@/config/permissions';
import { Role } from '@/types/rbac';

import { PageHero } from '@/components/dashboard/page-hero';
import { DashboardFilterBar } from '@/components/dashboard/dashboard-filter-bar';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

const roleFormSchema = z.object({
  name: z.string().min(2, { message: "Role name must be at least 2 characters." }),
  permissions: z.array(z.string()).default([]),
  description: z.string().optional(),
  priority: z.coerce.number().min(1, { message: "Priority must be at least 1" }).default(99),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

interface PermissionCategoryGroupProps {
  category: string;
  permissions: any[];
  selectedPermissions: string[];
  onTogglePermission: (id: string, checked: boolean) => void;
  onToggleGroup: (ids: string[], checked: boolean) => void;
}

const PermissionCategoryGroup = React.memo(({
  category,
  permissions,
  selectedPermissions,
  onTogglePermission,
  onToggleGroup
}: PermissionCategoryGroupProps) => {
  const permissionIds = useMemo(() => permissions.map(p => p.id), [permissions]);
  const allSelected = useMemo(() => permissionIds.every(id => selectedPermissions.includes(id)), [permissionIds, selectedPermissions]);

  return (
    <div className="bg-background border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed">
        <h4 className="font-semibold text-xs text-primary flex items-center gap-2 uppercase tracking-wider text-left">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {category}
          </span>
        </h4>
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`select-all-${category}`}
            checked={allSelected}
            onCheckedChange={(checked) => {
              onToggleGroup(permissionIds, !!checked);
            }}
          />
          <label htmlFor={`select-all-${category}`} className="text-[10px] text-muted-foreground cursor-pointer uppercase font-semibold select-none">Select Group</label>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-left">
        {permissions.map((permission) => {
          const isChecked = selectedPermissions.includes(permission.id);
          return (
            <div
              key={permission.id}
              className="flex flex-row items-start space-x-2 space-y-0 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer border border-transparent hover:border-muted-foreground/10"
              onClick={() => onTogglePermission(permission.id, !isChecked)}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => {
                  onTogglePermission(permission.id, !!checked);
                }}
                className="mt-0.5"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="space-y-0.5 leading-none select-none">
                <span className="text-sm font-medium cursor-pointer text-foreground block">
                  {permission.label}
                </span>
                <p className="text-[10px] text-muted-foreground/80 line-clamp-2">
                  {permission.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  const prevSelectedInCategory = prevProps.selectedPermissions.filter(id => prevProps.permissions.some(p => p.id === id));
  const nextSelectedInCategory = nextProps.selectedPermissions.filter(id => nextProps.permissions.some(p => p.id === id));
  return (
    prevProps.category === nextProps.category &&
    prevSelectedInCategory.length === nextSelectedInCategory.length &&
    prevSelectedInCategory.every(id => nextSelectedInCategory.includes(id))
  );
});
PermissionCategoryGroup.displayName = 'PermissionCategoryGroup';

export default function SystemRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToDeleteId, setRoleToDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManageRoles = hasPermission('MANAGE_SYSTEM_ROLES');

  useEffect(() => {
    if (!permLoading && !canManageRoles) {
      toast({ title: "Access Denied", description: "You do not have permission to manage system roles.", variant: "destructive" });
      router.push('/dashboard');
    }
  }, [permLoading, canManageRoles, router, toast]);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: '',
      permissions: [],
      description: '',
      priority: 99,
    }
  });

  const handleTogglePermission = useCallback((permId: string, checked: boolean) => {
    setSelectedPermissions(prev => {
      if (checked) {
        return prev.includes(permId) ? prev : [...prev, permId];
      } else {
        return prev.filter(id => id !== permId);
      }
    });
  }, []);

  const handleToggleGroup = useCallback((permIds: string[], checked: boolean) => {
    setSelectedPermissions(prev => {
      if (checked) {
        const toAdd = permIds.filter(id => !prev.includes(id));
        return [...prev, ...toAdd];
      } else {
        return prev.filter(id => !permIds.includes(id));
      }
    });
  }, []);

  const fetchRoles = useCallback(() => {
    setIsLoading(true);
    const fetchRolesFn = async () => {
      try {
        const { data, error: fetchError } = await supabase.from('system_roles').select('id,name,permissions,description,priority');
        if (fetchError) throw fetchError;
        if (data) {
          const rolesList: Role[] = data.map((r: any) => ({
            id: r.id,
            name: r.name,
            permissions: r.permissions || [],
            description: r.description,
            priority: r.priority || 99,
          })).sort((a, b) => (a.priority || 99) - (b.priority || 99));
          setRoles(rolesList);
        } else {
          setRoles([]);
        }
      } catch (err) {
        console.error("Error fetching system roles:", err);
        setError("Failed to fetch system roles.");
        toast({ title: "Error Fetching Data", description: (err as Error).message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchRolesFn();
    return () => { };
  }, [toast]);

  useEffect(() => {
    const unsubscribe = fetchRoles();
    return () => unsubscribe();
  }, [fetchRoles]);

  const handleFormSubmit: SubmitHandler<RoleFormValues> = useCallback(async (data) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name,
        permissions: selectedPermissions,
        description: data.description,
        priority: data.priority,
      };

      if (editingRole) {
        const { error: updateError } = await supabase.from('system_roles')
          .update(payload)
          .eq('id', editingRole.id);
        if (updateError) throw updateError;
        toast({ title: "Role Updated", description: `"${data.name}" has been successfully updated.` });
      } else {
        const { error: insertError } = await supabase.from('system_roles').insert([payload]);
        if (insertError) throw insertError;
        toast({ title: "Role Added", description: `"${data.name}" has been successfully added.` });
      }
      setIsDialogOpen(false);
      setEditingRole(null);
      form.reset({ name: '', permissions: [], description: '', priority: 99 });
      
      // Force refresh roles list
      fetchRoles();
      
      // Force refresh global user permissions cache so the sidebar updates
      queryClient.invalidateQueries({ queryKey: ['userPermissions'] });
    } catch (err) {
      console.error("Error saving role:", err);
      toast({ title: "Save Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [editingRole, fetchRoles, form, toast, selectedPermissions, queryClient]);

  const openAddDialog = useCallback(() => {
    setEditingRole(null);
    form.reset({ name: '', permissions: [], description: '', priority: 99 });
    setSelectedPermissions([]);
    setIsDialogOpen(true);
  }, [form]);

  const openEditDialog = useCallback((role: Role) => {
    if (role.priority === 1) {
      toast({ title: "Action Denied", description: "The Super Admin role cannot be edited.", variant: "destructive" });
      return;
    }
    setEditingRole(role);
    form.reset({
      name: role.name,
      permissions: role.permissions || [],
      description: role.description || '',
      priority: role.priority || 99,
    });
    setSelectedPermissions(role.permissions || []);
    setIsDialogOpen(true);
  }, [form, toast]);

  const handleDeleteClick = useCallback((role: Role) => {
    if (role.priority === 1) {
      toast({ title: "Action Denied", description: "The Super Admin role cannot be deleted.", variant: "destructive" });
      return;
    }
    setRoleToDeleteId(role.id);
    setShowDeleteConfirm(true);
  }, [toast]);

  const executeDelete = useCallback(async () => {
    if (!roleToDeleteId) return;
    setIsSubmitting(true);
    try {
      const { error: deleteError } = await supabase.from('system_roles').delete().eq('id', roleToDeleteId);
      if (deleteError) throw deleteError;
      await fetchRoles();
      toast({ title: "Role Deleted", description: "The system role has been successfully deleted." });
      setRoleToDeleteId(null);
    } catch (err) {
      console.error("Error deleting role:", err);
      toast({ title: "Delete Failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  }, [roleToDeleteId, fetchRoles, toast]);

  const filteredRoles = useMemo(() => {
    return roles.filter(role =>
      role.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [roles, searchQuery]);

  if (permLoading || !canManageRoles) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Verifying permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HERO SECTION */}
      <PageHero
        pattern="pattern-4"
        icon={ShieldCheck}
        badge="ACCESS CONTROL"
        title="System Roles"
        description="Define roles and permissions to secure application access."
      >
        <Button 
          onClick={openAddDialog} 
          className="font-semibold h-11 px-6 rounded-xl transition-transform duration-150 hover:-translate-y-px hover:shadow-md shadow-sm"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </PageHero>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search roles..."
          className="pl-10 max-w-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Content Section */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center h-60 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Loading system roles...</p>
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && filteredRoles.length === 0 && (
        <div className="text-center py-16 bg-muted/10 rounded-xl border-2 border-dashed border-muted-foreground/20">
          <div className="bg-muted/20 p-4 rounded-full inline-block mb-4">
            <Inbox className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No Roles Found</h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            {searchQuery ? "Try adjusting your search terms." : "Get started by creating your first system role to manage user permissions."}
          </p>
          {!searchQuery && (
            <Button onClick={openAddDialog} variant="outline" className="mt-6">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Role
            </Button>
          )}
        </div>
      )}

      {!isLoading && !error && filteredRoles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoles.map((role) => (
            <Card key={role.id} className="group hover:shadow-md transition-all duration-300 border-muted/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/0 group-hover:bg-primary transition-all duration-300" />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <Badge variant="outline" className="w-fit mb-2 text-xs font-normal">
                      Priority: {role.priority || 99}
                    </Badge>
                  </div>
                  <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(role)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteClick(role)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="bg-primary/10 p-1.5 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{role.name}</CardTitle>
                </div>
                <CardDescription className="line-clamp-2 min-h-[40px] mt-2">
                  {role.description || "No description provided for this role."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {role.permissions ? role.permissions.length : 0} Permissions
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 h-[60px] overflow-hidden content-start">
                  {role.permissions && role.permissions.length > 0 ? (
                    role.permissions.map((permId) => {
                      // Find category for visual coloring? For now just simplified badges
                      return (
                        <Badge key={permId} variant="secondary" className="px-2 py-0.5 text-[10px] font-normal border-transparent bg-muted/60 text-muted-foreground hover:bg-muted">
                          {/* Simplified logic to show label would need lookup, for now showing ID or we can optimize */}
                          {permId.replace(/_/g, ' ')}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> No permissions assigned
                    </span>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0 pb-4">
                {/* Footer content if needed, like 'Last updated' */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-muted to-transparent opacity-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            // Guard state syncs
            setEditingRole(null);
            setSelectedPermissions([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border/60 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:zoom-in-[0.995] duration-200" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes systemRoleTrace {
              0% { stroke-dashoffset: 2000; opacity: 1; }
              60% { opacity: 1; }
              100% { stroke-dashoffset: 0; opacity: 0; }
            }
            .system-role-trace-path {
              stroke-dasharray: 2000;
              stroke-dashoffset: 2000;
              animation: systemRoleTrace 1050ms cubic-bezier(0.22, 1, 0.36, 1) forwards 120ms;
            }
            @media (prefers-reduced-motion: reduce) {
              .system-role-trace-path { animation: none; opacity: 0; }
            }
          `}} />
          {/* Subtle One-Time Border Trace (Blue -> Cyan) */}
          <div className="absolute inset-0 pointer-events-none z-50 rounded-[inherit] overflow-hidden">
             <svg width="100%" height="100%" className="absolute inset-0" xmlns="http://www.w3.org/2000/svg">
                <defs>
                   <linearGradient id="systemRoleTraceGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="50%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#38BDF8" />
                   </linearGradient>
                   <filter id="systemRoleTraceGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                   </filter>
                </defs>
                <rect 
                   x="1" y="1" 
                   width="calc(100% - 2px)" height="calc(100% - 2px)" 
                   rx="7" ry="7" 
                   fill="none" 
                   stroke="url(#systemRoleTraceGrad)" 
                   strokeWidth="2.5"
                   filter="url(#systemRoleTraceGlow)"
                   className="system-role-trace-path opacity-0"
                   style={{ strokeLinecap: 'round' }}
                />
             </svg>
          </div>

          <DialogHeader className="p-6 pb-4 border-b border-border/40 relative z-10 bg-background/50 backdrop-blur-sm">
            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2 bg-primary/[0.08] text-primary rounded-xl border border-primary/10 transition-colors">
                {editingRole ? <Edit className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
              </div>
              {editingRole ? `Editing "${editingRole.name}"` : 'Adding New System Role'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1 ml-[52px]">
              {editingRole ? 'Update the details of this item.' : 'Enter the details for System Role.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
                <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-2 mb-4 p-1 bg-muted/40 rounded-xl">
                    <TabsTrigger value="details" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-150">Role Details</TabsTrigger>
                    <TabsTrigger value="permissions" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-150">Permissions</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="flex-1 overflow-y-auto space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-200">
                    <div className="border border-border/60 rounded-xl p-5 bg-card shadow-sm space-y-5 transition-shadow hover:shadow-md duration-300">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-md bg-primary/10">
                          <Edit className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm">Role Details</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-medium text-foreground">Role Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. HR Manager" className="h-11 bg-background border-border/60 focus-visible:ring-2 focus-visible:ring-primary/10 focus-visible:border-primary/40 transition-all duration-150 rounded-lg" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-medium text-foreground">Priority Order</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" placeholder="e.g. 1" className="h-11 bg-background border-border/60 focus-visible:ring-2 focus-visible:ring-primary/10 focus-visible:border-primary/40 transition-all duration-150 rounded-lg" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel className="font-medium text-foreground">Description</FormLabel>
                              <FormControl>
                                <Input placeholder="Briefly describe the role..." className="h-11 bg-background border-border/60 focus-visible:ring-2 focus-visible:ring-primary/10 focus-visible:border-primary/40 transition-all duration-150 rounded-lg" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="permissions" className="flex-1 overflow-hidden flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 duration-200">
                    <div className="flex flex-col border border-border/60 rounded-xl bg-card flex-1 relative shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
                      <div className="p-3 border-b border-border/50 bg-muted/20 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-primary/10">
                            <Shield className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <FormLabel className="text-sm font-semibold block text-foreground">Permissions</FormLabel>
                            <p className="text-[10px] text-muted-foreground font-medium">Select access levels</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="select-all-global"
                              checked={Object.values(CATEGORIZED_PERMISSIONS).flat().every(p => selectedPermissions.includes(p.id))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  const allPermissionIds = Object.values(CATEGORIZED_PERMISSIONS).flat().map(p => p.id);
                                  setSelectedPermissions(allPermissionIds);
                                } else {
                                  setSelectedPermissions([]);
                                }
                              }}
                            />
                            <label htmlFor="select-all-global" className="text-xs font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none">
                              Select All
                            </label>
                          </div>
                          <Badge variant="outline" className="font-mono text-[10px] bg-background border-border/60">
                            {selectedPermissions.length} Selected
                          </Badge>
                        </div>
                      </div>

                      <ScrollArea
                        ref={scrollAreaRef}
                        className="h-[500px] bg-primary/[0.01] p-3"
                        type="always"
                        onScrollCapture={(e) => {
                          const viewport = e.target as HTMLElement;
                          setShowScrollTop(viewport.scrollTop > 100);
                        }}
                      >
                        <div className="space-y-4 p-1">
                          {Object.entries(CATEGORIZED_PERMISSIONS).map(([category, permissions]) => (
                            <PermissionCategoryGroup
                              key={category}
                              category={category}
                              permissions={permissions}
                              selectedPermissions={selectedPermissions}
                              onTogglePermission={handleTogglePermission}
                              onToggleGroup={handleToggleGroup}
                            />
                          ))}
                        </div>
                      </ScrollArea>
                      {showScrollTop && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute bottom-4 right-4 h-8 w-8 rounded-full shadow-lg z-10 opacity-90 hover:opacity-100 transition-opacity bg-primary text-primary-foreground hover:bg-primary/90"
                          onClick={() => {
                            const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                            if (viewport) {
                              viewport.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <DialogFooter className="p-4 border-t border-border/50 bg-background/95 backdrop-blur-sm mt-auto relative z-10 flex items-center justify-end gap-3">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="h-[44px] px-6 rounded-[10px] font-medium hover:bg-muted hover:-translate-y-px transition-all duration-150">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting} className="h-[44px] px-6 rounded-[10px] font-semibold bg-primary text-primary-foreground hover:-translate-y-px hover:shadow-md active:translate-y-0 transition-all duration-150 min-w-[150px]">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog >

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete System Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role? This action cannot be undone and will remove these permissions from any assigned users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
