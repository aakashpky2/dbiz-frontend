"use client";

import React, { useState } from "react";
import { PageHero } from "@/components/dashboard/page-hero";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Shield, Copy, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RbacAdminProvider, useRbacAdmin } from "@/contexts/RbacAdminContext";
import { TemplateDialog } from "./components/TemplateDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

function ResponsibilitiesPageContent() {
  const { templates, isLoading } = useRbacAdmin();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const filtered = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.category && t.category.toLowerCase().includes(search.toLowerCase()))
  );

  const handleEdit = (t: any) => {
    setSelectedTemplate(t);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      <PageHero
                pattern="pattern-7"
        icon={Shield}
        badge="PERMISSIONS"
        title="Responsibility Templates"
        description="Create and manage grouped permissions for delegation."
      >
        <div className="flex gap-2">
          <Button className="font-bold" onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>
      </PageHero>

      <div className="flex-1 p-6 pt-0 space-y-6">
        <div className="bg-card border rounded-lg shadow-sm">
          <div className="p-4 border-b flex gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="p-0">
            {isLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground h-8 w-8" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No templates found.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Template</th>
                    <th className="px-6 py-3 font-medium">Category</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{t.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                        <div className="text-[10px] text-slate-500 mt-1 flex gap-2">
                          <span>{t.permissions?.length || 0} perms</span>
                          <span>{t.child_templates?.length || 0} deps</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-slate-100">{t.category || "General"}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        {t.status === 'ACTIVE' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Draft</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(t)}>
                              <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" /> Duplicate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <TemplateDialog 
        isOpen={isDialogOpen} 
        setIsOpen={setIsDialogOpen} 
        template={selectedTemplate} 
      />
    </div>
  );
}

export default function ResponsibilitiesPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { loading: permissionsLoading, hasPermission } = usePermissions();

  const canManageRBAC = hasPermission("MANAGE_RBAC") || hasPermission("OWNER_SUPER_ADMIN_CONTROLS");

  if (permissionsLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  if (!currentUser || (!canManageRBAC && !hasPermission("MANAGE_EMPLOYEES"))) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <RbacAdminProvider>
      <ResponsibilitiesPageContent />
    </RbacAdminProvider>
  );
}
