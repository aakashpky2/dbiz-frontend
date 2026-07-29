"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Role, Department } from "../constants";

// The tabs will be imported here
import { BasicDetailsTab } from "./tabs/BasicDetailsTab";
import { RolesTab } from "./tabs/RolesTab";
import { ResponsibilitiesTab } from "./tabs/ResponsibilitiesTab";
import { OverridesTab } from "./tabs/OverridesTab";
import { EffectivePermissionsTab } from "./tabs/EffectivePermissionsTab";
import { AuditTab } from "./tabs/AuditTab";
import { RbacAdminProvider } from "@/contexts/RbacAdminContext";

interface UserAccessDialogProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  user: User | null;
  roles: Role[];
  departments: Department[];
  allowedRoles: Role[];
  isSuperAdminByPermissions: boolean;
  isSuperAdminRole: (r: Role) => boolean;
  onBasicDetailsSubmit: (data: any) => Promise<void>;
  editForm: any;
  isSubmitting: boolean;
}

export function UserAccessDialog(props: UserAccessDialogProps) {
  if (!props.user) return null;

  return (
    <RbacAdminProvider>
      <Dialog open={props.isOpen} onOpenChange={props.setIsOpen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-50/50">
          <DialogHeader className="p-6 pb-2 border-b bg-background">
            <DialogTitle className="text-xl">Update User Access</DialogTitle>
            <DialogDescription>
              Manage access for {props.user.displayName}.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-2 bg-background border-b">
              <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-muted/50">
                <TabsTrigger value="basic" className="py-2 text-xs md:text-sm">Details</TabsTrigger>
                <TabsTrigger value="roles" className="py-2 text-xs md:text-sm">Roles</TabsTrigger>
                <TabsTrigger value="responsibilities" className="py-2 text-xs md:text-sm">Responsibilities</TabsTrigger>
                <TabsTrigger value="overrides" className="py-2 text-xs md:text-sm">Overrides</TabsTrigger>
                <TabsTrigger value="effective" className="py-2 text-xs md:text-sm">Effective Access</TabsTrigger>
                <TabsTrigger value="audit" className="py-2 text-xs md:text-sm">Audit Log</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <TabsContent value="basic" className="mt-0 h-full">
                <BasicDetailsTab {...props} />
              </TabsContent>
              <TabsContent value="roles" className="mt-0 h-full">
                <RolesTab user={props.user} />
              </TabsContent>
              <TabsContent value="responsibilities" className="mt-0 h-full">
                <ResponsibilitiesTab user={props.user} />
              </TabsContent>
              <TabsContent value="overrides" className="mt-0 h-full">
                <OverridesTab user={props.user} />
              </TabsContent>
              <TabsContent value="effective" className="mt-0 h-full">
                <EffectivePermissionsTab user={props.user} />
              </TabsContent>
              <TabsContent value="audit" className="mt-0 h-full">
                <AuditTab user={props.user} />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </RbacAdminProvider>
  );
}
