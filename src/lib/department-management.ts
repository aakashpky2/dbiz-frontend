import { supabase } from './supabase';

export type EntityStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'VALIDATED' | 'DELETE_PENDING';
export type ChangeType = 'CREATE' | 'UPDATE' | 'DELETE_REQUEST';
export type EntityType = 'DEPARTMENT' | 'WORK_CATEGORY' | 'WORK_TYPE';

export interface BaseEntity {
  status: EntityStatus;
  isValidated?: boolean;
  isDeleted?: boolean;
  isIncomplete?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMember {
  role: 'Team Lead' | 'Team Member';
}

export interface ConstitutionRule {
  mode: 'ALL' | 'SELECT' | 'EXCEPT';
  ids: string[];
}

export interface WorkType extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  warningNote?: string | null;
  constitutionRule?: ConstitutionRule;
  departmentId: string;
  categoryId: string;
  departmentName: string;
  categoryName: string;
  constitutionApplicabilityType?: string;
  constitutionList?: string[];
  timeLimit?: number;
  timeLimitHours?: number;
  dueTimeConfig?: any;
  durationDays?: number; 
  financialYearLogic?: 'Previous' | 'Current';
  monthLogic?: 'Current' | 'Previous';
  defaultPriority?: string;
  defaultOccurrence?: string;
  durationHours?: number;
  allowOverride?: boolean;
  allowOccurrenceOverride?: boolean;
  allowDueDateOverride?: boolean;
  allowFinishByOverride?: boolean;
  finishByEnabled?: boolean;
  finishByMode?: 'days_based' | 'event_based';
  finishByDays?: number;
  finishByEvent?: 'work_start_date' | 'due_date' | 'period_start' | 'period_end';
  finishByDirection?: 'before' | 'after';
}

export interface WorkCategory extends BaseEntity {
  id: string;
  departmentId: string;
  departmentName: string;
  name: string;
  description?: string;
  workTypes: WorkType[];
}

export interface Department extends BaseEntity {
  id: string;
  name: string;
  description?: string;
  workCategories: WorkCategory[];
  members?: Record<string, TeamMember>;
}

// ─── MASTER LOG ENGINE ──────────────────────────────────────────────────────

async function logMasterChange(
  entityType: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE',
  entityId: string,
  actionType: 'ADD' | 'EDIT' | 'DELETE_SOFT' | 'DELETE_PERMANENT' | 'VALIDATE_APPROVE' | 'VALIDATE_REJECT' | 'VALIDATE_EDIT_APPROVE',
  oldValue: any,
  newValue: any,
  userId: string,
  userName: string,
  remarks?: string
) {
  const now = new Date();

  const { error } = await supabase.from('master_change_log').insert([{
    entity_type: entityType,
    entity_id: entityId,
    action_type: actionType,
    old_value_snapshot: oldValue || null,
    new_value_snapshot: newValue || null,
    performed_by_user_id: userId,
    performed_by_user_name: userName,
    performed_date: now.toISOString().split('T')[0],
    performed_time: now.toTimeString().split(' ')[0],
    validation_status_before: oldValue ? !!oldValue.is_validated : null,
    validation_status_after: newValue ? !!newValue.is_validated : null,
    deleted_status_before: oldValue ? !!oldValue.is_deleted : null,
    deleted_status_after: newValue ? !!newValue.is_deleted : null,
    incomplete_status_before: oldValue ? !!oldValue.is_incomplete : null,
    incomplete_status_after: newValue ? !!newValue.is_incomplete : null,
    remarks: remarks || null
  }]);



  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('department_updated'));
  }
}

// ─── MASTER DATA SINGLETON LISTENER ──────────────────────────────────────────
let globalMasterChannel: any = null;
let masterCallbacks: ((depts: Department[]) => void)[] = [];

export const fetchDeptsGlobal = async () => {
  try {
    const response = await fetch(`/api/departments?_t=${Date.now()}`);
    if (!response.ok) {
        let errMessage = 'Failed to fetch departments';
        try {
            const errData = await response.json();
            errMessage = errData.message || errData.error || errMessage;
        } catch (e) {
            // Ignored if not JSON
        }
        throw new Error(errMessage);
    }
    const parsed = await response.json();
    const deptsArray = Array.isArray(parsed) ? parsed : (parsed.data || parsed.departments || []);

    // Notify all listeners
    masterCallbacks.forEach(cb => cb(deptsArray as Department[]));
  } catch (error) {
    console.error("Master fetch error:", error);
  }
};

export const listenToDepartments = (callback: (departments: Department[]) => void) => {
  masterCallbacks.push(callback);
  
  // Initial fetch for this listener
  fetchDeptsGlobal();

  if (!globalMasterChannel) {

    globalMasterChannel = supabase
      .channel('realtime:master-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'department_master' }, fetchDeptsGlobal)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'category_master' }, fetchDeptsGlobal)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worktype_master' }, fetchDeptsGlobal)
      .subscribe((status) => {

      });
  }

  const handleCustomEvent = () => fetchDeptsGlobal();
  if (typeof window !== 'undefined') {
    window.addEventListener('department_updated', handleCustomEvent);
  }

  return () => {
    masterCallbacks = masterCallbacks.filter(cb => cb !== callback);
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('department_updated', handleCustomEvent);
    }

    if (masterCallbacks.length === 0 && globalMasterChannel) {
      supabase.removeChannel(globalMasterChannel).catch(err => {
        if (!err.message?.includes('WebSocket is closed')) {
           // Silent fail for websocket closure
        }
      });
      globalMasterChannel = null;
    }
  };
};

// ─── DEPARTMENT MUTATIONS ───────────────────────────────────────────────────

export const addDepartment = async (departmentName: string, description: string, userId: string, userName: string) => {
  const isIncomplete = false; // Description is optional for departments

  const insertData = {
    department_name: departmentName,
    description: description || null,
    is_validated: false,
    is_deleted: false,
    is_incomplete: isIncomplete
  };

  const { data, error } = await supabase
    .from('department_master')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;

  await logMasterChange('DEPARTMENT', data.id, 'ADD', null, data, userId, userName);
  return data;
};

export const updateDepartment = async (departmentId: string, newName: string, description: string, userId: string, userName: string) => {
  const { data: oldDept } = await supabase.from('department_master').select('*').eq('id', departmentId).single();
  if (!oldDept) throw new Error("Department not found");

  const updateData = {
    department_name: newName,
    description: description || null,
    is_validated: false,
    is_incomplete: false,
    updated_at: new Date().toISOString()
  };

  const { data: newDept, error } = await supabase
    .from('department_master')
    .update(updateData)
    .eq('id', departmentId)
    .select()
    .single();

  if (error) throw error;

  await logMasterChange('DEPARTMENT', departmentId, 'EDIT', oldDept, newDept, userId, userName);
};

export const deleteDepartment = async (departmentId: string, userId: string, userName: string) => {
  const { data: oldDept } = await supabase.from('department_master').select('*').eq('id', departmentId).single();
  if (!oldDept) throw new Error("Department not found");

  const { data: newDept, error } = await supabase
    .from('department_master')
    .update({ is_deleted: true, is_validated: false, updated_at: new Date().toISOString() })
    .eq('id', departmentId)
    .select()
    .single();

  if (error) throw error;

  await logMasterChange('DEPARTMENT', departmentId, 'DELETE_SOFT', oldDept, newDept, userId, userName);
};

// ─── WORK CATEGORY MUTATIONS ────────────────────────────────────────────────

export const addWorkCategory = async (departmentId: string, categoryName: string, description: string, userId: string, userName: string) => {
  const { data: parentDept } = await supabase.from('department_master').select('department_name').eq('id', departmentId).single();
  const isIncomplete = !description || description.trim() === '';

  const insertData = {
    department_id: departmentId,
    department_name: parentDept?.department_name || '',
    category_name: categoryName,
    description: description || null,
    is_validated: false,
    is_deleted: false,
    is_incomplete: isIncomplete
  };

  const { data, error } = await supabase
    .from('category_master')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;

  await logMasterChange('CATEGORY', data.id, 'ADD', null, data, userId, userName);
  return data;
};

export const updateWorkCategory = async (departmentId: string, categoryId: string, newName: string, description: string, userId: string, userName: string) => {
  const { data: oldCat } = await supabase.from('category_master').select('*').eq('id', categoryId).single();
  if (!oldCat) throw new Error("Category not found");

  const isIncomplete = !description || description.trim() === '';

  const updateData = {
    category_name: newName,
    description: description || null,
    is_validated: false,
    is_incomplete: isIncomplete,
    updated_at: new Date().toISOString()
  };

  const { data: newCat, error } = await supabase
    .from('category_master')
    .update(updateData)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;

  await logMasterChange('CATEGORY', categoryId, 'EDIT', oldCat, newCat, userId, userName);
};

export const deleteWorkCategory = async (departmentId: string, categoryId: string, userId: string, userName: string) => {
  const { data: oldCat } = await supabase.from('category_master').select('*').eq('id', categoryId).single();
  if (!oldCat) throw new Error("Category not found");

  const { data: newCat, error } = await supabase
    .from('category_master')
    .update({ is_deleted: true, is_validated: false, updated_at: new Date().toISOString() })
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;

  await logMasterChange('CATEGORY', categoryId, 'DELETE_SOFT', oldCat, newCat, userId, userName);
};

// ─── WORK TYPE MUTATIONS ────────────────────────────────────────────────────

export const addWorkType = async (
  departmentId: string,
  categoryId: string,
  wtData: { name: string; description?: string; warningNote?: string | null; constitutionRule?: ConstitutionRule },
  userId: string,
  userName: string
) => {
  const { data: parentCat } = await supabase.from('category_master').select('department_name, category_name').eq('id', categoryId).single();
  let applicabilityType = 'All';
  if (wtData.constitutionRule?.mode === 'SELECT') applicabilityType = 'Selected';
  if (wtData.constitutionRule?.mode === 'EXCEPT') applicabilityType = 'Except Selected';

  const hasDesc = wtData.description && wtData.description.trim() !== '';
  const hasConst = applicabilityType === 'All' || (wtData.constitutionRule?.ids && wtData.constitutionRule.ids.length > 0);
  const isIncomplete = !hasDesc || !hasConst;

  const insertData = {
    department_id: departmentId,
    category_id: categoryId,
    department_name: parentCat?.department_name || '',
    category_name: parentCat?.category_name || '',
    work_type_name: wtData.name,
    description: wtData.description || null,
    constitution_applicability_type: applicabilityType,
    constitution_list: wtData.constitutionRule?.ids || [],
    is_validated: false,
    is_deleted: false,
    is_incomplete: isIncomplete
  };

  const { data, error } = await supabase
    .from('worktype_master')
    .insert([insertData])
    .select()
    .single();

  if (error) throw error;

  await logMasterChange('WORKTYPE', data.id, 'ADD', null, data, userId, userName);
  return data;
};

export const updateWorkType = async (
  departmentId: string,
  categoryId: string,
  workTypeId: string,
  newData: { 
    name: string; 
    description?: string; 
    warningNote?: string | null;
    constitutionRule?: ConstitutionRule; 
    deptId?: string;
    catId?: string;
    timeLimit?: number; 
    timeLimitHours?: number;
    dueTimeConfig?: any;
    defaultOccurrence?: string;
    durationDays?: number;
    durationHours?: number;
    allowOverride?: boolean;
    allowOccurrenceOverride?: boolean;
    allowDueDateOverride?: boolean;
    allowFinishByOverride?: boolean;
    finishByEnabled?: boolean;
    finishByMode?: 'days_based' | 'event_based';
    finishByDays?: number | string;
    finishByEvent?: 'work_start_date' | 'due_date' | 'period_start' | 'period_end';
    finishByDirection?: 'before' | 'after';
    configName?: string;
  },
  userId: string,
  userName: string
) => {
  const { data: oldWt } = await supabase.from('worktype_master').select('*').eq('id', workTypeId).single();
  if (!oldWt) throw new Error("Work Type not found");

  // Call backend API for normal work type fields
  console.log("Calling PUT /api/departments/types", { workTypeId, updateData: { name: newData.name, deptId: departmentId, catId: categoryId } });
  
  let updateResponse;
  try {
    updateResponse = await fetch(`/api/departments/types/${workTypeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newData.name,
        description: newData.description,
        constitutionRule: newData.constitutionRule,
        warningNote: newData.warningNote,
        status: oldWt.status,
        deptId: departmentId,
        catId: categoryId
      })
    });
  } catch (networkError) {
    console.error("Network error during PUT /api/departments/types:", networkError);
    throw networkError;
  }

  console.log("PUT /api/departments/types response status:", updateResponse.status);

  if (!updateResponse.ok) {
    let errText = "Unknown error";
    try {
      const err = await updateResponse.json();
      errText = err.error || err.message || JSON.stringify(err);
    } catch (e) {
      errText = await updateResponse.text();
    }
    console.error("Error from backend:", errText);
    throw new Error(errText || 'Failed to update work type');
  }

  const newWt = await updateResponse.json();
  console.log("Backend update successful, newWt:", newWt);

  await logMasterChange('WORKTYPE', workTypeId, 'EDIT', oldWt, newWt, userId, userName);

  console.log("[Time Limit DB Load]", {
    workTypeId,
    source: 'backend-api',
    dueTimeConfig: newData.dueTimeConfig,
    timeLimit: newData.timeLimit,
    timeLimitHours: newData.timeLimitHours,
    allowOverride: newData.allowOverride,
    configName: newData.configName
  });

  const response = await fetch(`/api/work-types/${workTypeId}/time-limit`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dueTimeConfig: newData.dueTimeConfig,
      timeLimit: newData.timeLimit,
      timeLimitHours: newData.timeLimitHours,
      durationDays: newData.durationDays,
      durationHours: newData.durationHours,
      allowOverride: newData.allowOverride,
      allowOccurrenceOverride: newData.allowOccurrenceOverride,
      allowDueDateOverride: newData.allowDueDateOverride,
      allowFinishByOverride: newData.allowFinishByOverride,
      finishByEnabled: newData.finishByEnabled,
      finishByMode: newData.finishByMode,
      finishByDays: newData.finishByDays,
      finishByEvent: newData.finishByEvent,
      finishByDirection: newData.finishByDirection,
      configName: newData.configName
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to update work type time limit');
  }

  const timeLimitData = await response.json();

  // Trigger global refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('department_updated'));
  }

  return { ...newWt, ...timeLimitData.data };
};

export const deleteWorkType = async (
  departmentId: string,
  categoryId: string,
  workTypeId: string,
  userId: string,
  userName: string
) => {
  const { data: oldWt } = await supabase.from('worktype_master').select('*').eq('id', workTypeId).single();
  if (!oldWt) throw new Error("Work Type not found");

  const { data: newWt, error } = await supabase
    .from('worktype_master')
    .update({ is_deleted: true, is_validated: false, updated_at: new Date().toISOString() })
    .eq('id', workTypeId)
    .select()
    .single();

  if (error) throw error;

  await logMasterChange('WORKTYPE', workTypeId, 'DELETE_SOFT', oldWt, newWt, userId, userName);
};

// ─── VALIDATION API ENGINE ───────────────────────────────────────────────────
// These functions map directly to the Validator requirements (Sections 9.3 to 9.6)

export const validateApprove = async (
  entityType: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE',
  entityId: string,
  userId: string,
  userName: string,
  remarks?: string
) => {
  const table = entityType === 'DEPARTMENT' ? 'department_master' : entityType === 'CATEGORY' ? 'category_master' : 'worktype_master';

  const { data: oldRecord } = await supabase.from(table).select('*').eq('id', entityId).single();
  if (!oldRecord) throw new Error("Record not found");

  // Recalculate incompleteness during approval as a safeguard
  let isIncomplete = false;
  if (entityType === 'CATEGORY') {
    isIncomplete = !oldRecord.description || oldRecord.description.trim() === '';
  } else if (entityType === 'WORKTYPE') {
    const hasDesc = oldRecord.description && oldRecord.description.trim() !== '';
    const hasConst = oldRecord.constitution_applicability_type === 'All' || (oldRecord.constitution_list && oldRecord.constitution_list.length > 0);
    isIncomplete = !hasDesc || !hasConst;
  }

  const { data: newRecord, error } = await supabase
    .from(table)
    .update({
      is_validated: true,
      is_incomplete: isIncomplete,
      updated_at: new Date().toISOString()
    })
    .eq('id', entityId)
    .select()
    .single();

  if (error) throw error;

  await logMasterChange(entityType, entityId, 'VALIDATE_APPROVE', oldRecord, newRecord, userId, userName, remarks);
};

export const validateEditAndApprove = async (
  entityType: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE',
  entityId: string,
  correctedData: any,
  userId: string,
  userName: string,
  remarks?: string
) => {
  const table = entityType === 'DEPARTMENT' ? 'department_master' : entityType === 'CATEGORY' ? 'category_master' : 'worktype_master';

  const { data: oldRecord } = await supabase.from(table).select('*').eq('id', entityId).single();
  if (!oldRecord) throw new Error("Record not found");

  // Format incoming correction based on table explicitly 
  const updatePayload: any = { is_validated: true, updated_at: new Date().toISOString() };

  if (entityType === 'DEPARTMENT') {
    updatePayload.department_name = correctedData.name || oldRecord.department_name;
    updatePayload.description = correctedData.description || oldRecord.description;
    updatePayload.is_incomplete = false;
  } else if (entityType === 'CATEGORY') {
    updatePayload.category_name = correctedData.name || oldRecord.category_name;
    updatePayload.description = correctedData.description || oldRecord.description;
    updatePayload.is_incomplete = !updatePayload.description || updatePayload.description.trim() === '';
  } else if (entityType === 'WORKTYPE') {
    if (correctedData.deptId && correctedData.catId && (correctedData.deptId !== oldRecord.department_id || correctedData.catId !== oldRecord.category_id)) {
      const { data: parentCat } = await supabase.from('category_master').select('department_name, category_name').eq('id', correctedData.catId).single();
      if (parentCat) {
        updatePayload.department_id = correctedData.deptId;
        updatePayload.category_id = correctedData.catId;
        updatePayload.department_name = parentCat.department_name;
        updatePayload.category_name = parentCat.category_name;
      }
    }

    updatePayload.work_type_name = correctedData.name || oldRecord.work_type_name;
    updatePayload.description = correctedData.description || oldRecord.description;
    updatePayload.warning_note = correctedData.warningNote !== undefined ? correctedData.warningNote : oldRecord.warning_note;

    let applicabilityType = oldRecord.constitution_applicability_type;
    let constitutionList = oldRecord.constitution_list;

    if (correctedData.constitutionRule) {
      applicabilityType = (correctedData.constitutionRule.mode === 'SELECT' ? 'Selected' : correctedData.constitutionRule.mode === 'EXCEPT' ? 'Except Selected' : 'All');
      constitutionList = correctedData.constitutionRule.ids;
      updatePayload.constitution_applicability_type = applicabilityType;
      updatePayload.constitution_list = constitutionList;
    }

    const hasDesc = updatePayload.description && updatePayload.description.trim() !== '';
    const hasConst = applicabilityType === 'All' || (constitutionList && constitutionList.length > 0);
    updatePayload.is_incomplete = !hasDesc || !hasConst;

    if (correctedData.timeLimit !== undefined) updatePayload.time_limit = correctedData.timeLimit;
    if (correctedData.timeLimitHours !== undefined) updatePayload.time_limit_hours = correctedData.timeLimitHours;
    if (correctedData.dueTimeConfig !== undefined) updatePayload.due_time_config = correctedData.dueTimeConfig;
  }

  const { data: newRecord, error } = await supabase
    .from(table)
    .update(updatePayload)
    .eq('id', entityId)
    .select()
    .single();

  if (error) throw error;

  await logMasterChange(entityType, entityId, 'VALIDATE_EDIT_APPROVE', oldRecord, newRecord, userId, userName, remarks);
};

export const validateReject = async (
  entityType: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE',
  entityId: string,
  userId: string,
  userName: string,
  remarks?: string
) => {
  const table = entityType === 'DEPARTMENT' ? 'department_master' : entityType === 'CATEGORY' ? 'category_master' : 'worktype_master';

  const { data: oldRecord } = await supabase.from(table).select('*').eq('id', entityId).single();
  if (!oldRecord) throw new Error("Record not found");

  // Step 1: Check if this was an Add Rejection (no previous history) or an Edit/Delete Rejection
  const { data: history } = await supabase
    .from('master_change_log')
    .select('*')
    .eq('entity_id', entityId)
    .eq('action_type', 'VALIDATE_APPROVE')
    .order('performed_datetime', { ascending: false })
    .limit(1)
    .single();

  if (!history || !history.new_value_snapshot) {
    // No valid history = It's an unapproved ADD that got rejected. Revert to effectively completely hidden/permanently deleted or revert to "is_deleted=true, is_validated=true"
    // Clean approach based on your rules: "revert record ... to the last validated snapshot". 
    // If none exists, hard deleting it or flagging as rejected is standard. Let's hard delete ADD rejections for simplicity.
    await supabase.from(table).delete().eq('id', entityId);
    await logMasterChange(entityType, entityId, 'VALIDATE_REJECT', oldRecord, null, userId, userName, "Rejected new creation addition");
    return;
  }

  // Restore the old snapshot entirely!
  const snapshotRestoration = { ...history.new_value_snapshot };
  // Ensure it's active and validated
  snapshotRestoration.is_validated = true;
  snapshotRestoration.is_deleted = false;

  const { data: newRecord, error } = await supabase
    .from(table)
    .update(snapshotRestoration)
    .eq('id', entityId)
    .select()
    .single();

  if (error) throw error;
  await logMasterChange(entityType, entityId, 'VALIDATE_REJECT', oldRecord, newRecord, userId, userName, remarks);
};

// ─── PERMANENT DELETE (Only allowed internally if validated && deleted) ────
export const permanentlyDeleteEntity = async (
  entityType: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE',
  entityId: string,
  userId: string,
  userName: string
) => {
  const table = entityType === 'DEPARTMENT' ? 'department_master' : entityType === 'CATEGORY' ? 'category_master' : 'worktype_master';
  const { data: oldRecord } = await supabase.from(table).select('*').eq('id', entityId).single();

  if (!oldRecord) throw new Error("Record not found");
  if (!oldRecord.is_deleted || !oldRecord.is_validated) {
    throw new Error("Cannot permanently delete. Item must be soft-deleted AND validated first.");
  }

  await supabase.from(table).delete().eq('id', entityId);
  await logMasterChange(entityType, entityId, 'DELETE_PERMANENT', oldRecord, { deleted_permanently: true }, userId, userName);
};


export interface MasterLog {
  log_id: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  old_value_snapshot: any;
  new_value_snapshot: any;
  performed_by_user_id: string;
  performed_by_user_name: string;
  performed_datetime: string;
  validation_status_before: boolean;
  validation_status_after: boolean;
  deleted_status_before: boolean;
  deleted_status_after: boolean;
  incomplete_status_before: boolean;
  incomplete_status_after: boolean;
  remarks: string;
}

export const fetchEntityHistory = async (entityType: 'DEPARTMENT' | 'CATEGORY' | 'WORKTYPE', entityId: string): Promise<MasterLog[]> => {
  const { data, error } = await supabase
    .from('master_change_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('performed_datetime', { ascending: false });

  if (error) {
    console.error("fetchEntityHistory error:", error);
    return [];
  }
  return data as MasterLog[];
};

export const fetchAllHistory = async (): Promise<MasterLog[]> => {
  const { data, error } = await supabase
    .from('master_change_log')
    .select('*')
    .order('performed_datetime', { ascending: false })
    .limit(100);

  if (error) {
    console.error("fetchAllHistory error:", error);
    return [];
  }
  return data as MasterLog[];
};

// ─── STUBS FOR MIGRATION/LEGACY IMPORTS ─────────────────────────────────────
export const splitDepartment = async (...args: any[]) => { };
export const mergeDepartments = async (...args: any[]) => { };
export const transferWorkCategory = async (...args: any[]) => { };
export const splitWorkCategory = async (...args: any[]) => { };
export const mergeWorkCategories = async (...args: any[]) => { };
export const transferWorkType = async (...args: any[]) => { };
export const mergeWorkTypes = async (...args: any[]) => { };

// The legacy change requests module is deactivated. We export listenToChangeRequests returning [] to avoid TS breaks.
export const listenToChangeRequests = (cb: any) => { cb([]); return () => { } };
export const dbApproveChangeRequest = async (...args: any[]) => { };
export const dbRejectChangeRequest = async (...args: any[]) => { };
export const dbUpdateAndApproveChangeRequest = async (...args: any[]) => { };
