
/**
 * Sorts hierarchical department data alphabetically at all levels
 * (Department > Category > Work Type)
 */
export function sortDepartmentHierarchy<T extends { 
    name: string; 
    workCategories?: { 
        name: string; 
        workTypes?: { name: string }[] 
    }[] 
}>(data: T[]): T[] {
    return [...data].sort((a, b) => a.name.localeCompare(b.name)).map(d => ({
        ...d,
        workCategories: (d.workCategories || [])
            .sort((ca, cb) => ca.name.localeCompare(cb.name))
            .map(c => ({
                ...c,
                workTypes: (c.workTypes || [])
                    .sort((wa, wb) => wa.name.localeCompare(wb.name))
            }))
    }));
}
