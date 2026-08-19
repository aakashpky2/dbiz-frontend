'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building, LibraryBig, FileSpreadsheet, ShieldCheck, FileText, Handshake, Network, User, IndianRupee } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionsTab } from "@/components/dashboard/admin/PermissionsTab";
import { PageHero } from "@/components/dashboard/page-hero";

const adminLinks: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  {
    href: '/dashboard/settings',
    label: 'Profile Details',
    description: 'Manage business profiles, addresses, and signatories.',
    icon: Building,
  },
  {
    href: '/dashboard/admin/department-management',
    label: 'Department Management',
    description: 'Organize work categories and types within departments.',
    icon: Network,
  },
  {
    href: '/dashboard/admin/forms-and-fees',
    label: 'Forms & Fees',
    description: 'Define official forms and their associated dynamic fees.',
    icon: FileSpreadsheet,
  },
  {
    href: '/dashboard/admin/system-roles',
    label: 'System Roles',
    description: 'Manage the roles available for employees in the system.',
    icon: ShieldCheck,
  },
  {
    href: '/dashboard/admin/templates',
    label: 'Templates',
    description: 'Create and manage document templates for PDF and Word.',
    icon: FileText,
  },
  {
    href: '/dashboard/admin/business-constitutions',
    label: 'Constitution',
    description: 'Define business types, their roles, and required data fields.',
    icon: LibraryBig,
  },
  {
    href: '/dashboard/admin/associates',
    label: 'Associates',
    description: 'Manage sales associates and their commission rules.',
    icon: Handshake,
  },
  {
    href: '/dashboard/admin/master-data',
    label: 'Master Data',
    description: 'Manage Priority, Occurrence, Period, and Reference Type.',
    icon: LibraryBig,
  },
  {
    href: '/dashboard/admin/temporary-clients',
    label: 'Temporary Clients',
    description: 'Review and convert temporary clients from queries to permanent.',
    icon: User,
  },
  {
    href: '/dashboard/admin/rate-card',
    label: 'Rate Card',
    description: 'Define and manage pricing for services and associates.',
    icon: IndianRupee,
  },
  {
    href: '/dashboard/admin/permissions',
    label: 'Permissions',
    description: 'Configure system-wide automated workflows and assignments.',
    icon: ShieldCheck,
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHero
                pattern="pattern-1"
          icon={ShieldCheck}
          badge="ADMINISTRATIVE HUB"
          title="Admin Panel"
          description="This is the central hub for managing core business settings, templates, and configurations."
      />

      <Tabs defaultValue="modules" className="space-y-6">
        <div className="flex items-center justify-between border-b pb-1">
            <TabsList className="bg-transparent h-auto p-0 gap-8">
                <TabsTrigger 
                    value="modules" 
                    className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-3 font-bold uppercase text-[11px] tracking-widest text-slate-400"
                >
                    Administrative Modules
                </TabsTrigger>
                <TabsTrigger 
                    value="permissions" 
                    className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-0 pb-3 font-bold uppercase text-[11px] tracking-widest text-slate-400"
                >
                    System Permissions
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="modules" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {adminLinks.map((link) => (
                <Card key={link.href} className="group flex flex-col border-slate-200/60 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-primary/5 transition-colors">
                            <link.icon className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                        <CardTitle className="group-hover:text-primary transition-colors text-lg">{link.label}</CardTitle>
                        <CardDescription className="line-clamp-2 min-h-[40px] mt-1">{link.description}</CardDescription>
                        </div>
                    </div>
                    </CardHeader>
                    <CardContent className="flex-grow"></CardContent>
                    <div className="p-6 pt-0">
                        <Button asChild className="w-full bg-slate-900 hover:bg-primary transition-all font-bold uppercase text-[10px] tracking-widest h-11 rounded-xl">
                            <Link href={link.href}>
                                Manage Module <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </Card>
                ))}
            </div>
        </TabsContent>

        <TabsContent value="permissions" className="animate-in fade-in slide-in-from-right-4 duration-500">
            <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

