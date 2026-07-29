"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { rbacService } from "../services/rbacService";

interface RbacAdminContextType {
  roles: any[];
  templates: any[];
  isLoading: boolean;
  error: string | null;
  refreshRoles: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  clearError: () => void;
}

const RbacAdminContext = createContext<RbacAdminContextType | null>(null);

export function RbacAdminProvider({ children }: { children: React.ReactNode }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshRoles = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await rbacService.getRoles();
      setRoles(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await rbacService.getTemplates();
      setTemplates(res.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch initial data when provider mounts
  useEffect(() => {
    Promise.all([refreshRoles(), refreshTemplates()]);
  }, [refreshRoles, refreshTemplates]);

  return (
    <RbacAdminContext.Provider
      value={{
        roles,
        templates,
        isLoading,
        error,
        refreshRoles,
        refreshTemplates,
        clearError,
      }}
    >
      {children}
    </RbacAdminContext.Provider>
  );
}

export function useRbacAdmin() {
  const ctx = useContext(RbacAdminContext);
  if (!ctx) {
    throw new Error("useRbacAdmin must be used within an RbacAdminProvider");
  }
  return ctx;
}
