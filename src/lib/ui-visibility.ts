type VisibilityMode = "hide" | "disable" | "show-empty-state";

export function hasItems(items: unknown): boolean {
  return Array.isArray(items) && items.length > 0;
}

export function cleanOptions<T>(items: T[], getValue?: (item: T) => unknown): T[] {
  if (!Array.isArray(items)) return [];
  
  const seen = new Set<unknown>();
  return items.filter(item => {
    if (item === null || item === undefined || item === '') return false;
    
    const val = getValue ? getValue(item) : item;
    if (val === null || val === undefined || val === '') return false;
    
    const key = typeof val === 'object' ? JSON.stringify(val) : val;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function shouldShowTab(count: number, mode: VisibilityMode, alwaysShow = false): boolean {
  if (alwaysShow) return true;
  if (mode === "hide") return count > 0;
  return true;
}

export function isTabDisabled(count: number, mode: VisibilityMode): boolean {
  return mode === "disable" && count <= 0;
}

export function shouldShowDropdown(items: unknown[], mode: VisibilityMode): boolean {
  if (mode === "hide") return items.length > 0;
  if (mode === "show-empty-state") return true;
  return true;
}

export function getFirstVisibleTab<T extends { value: string; count?: number; alwaysShow?: boolean; mode?: VisibilityMode }>(tabs: T[]): string {
  return tabs.find(tab => tab.alwaysShow || (tab.count ?? 0) > 0)?.value || tabs[0]?.value || "";
}
