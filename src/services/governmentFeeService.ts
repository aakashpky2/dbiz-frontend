import { apiFetch } from '@/lib/apiFetch';
// Using relative paths to leverage Next.js rewrites and avoid CORS/PNA issues
const API_BASE = '/api/government-fees';

const BASE_HEADERS: Record<string, string> = {
    'Content-Type': 'application/json',
};

export const governmentFeeService = {
  // FIELD APIs
  getFields: async (workTypeId?: string) => {
    const url = workTypeId ? `${API_BASE}/fields?work_type_id=${workTypeId}` : `${API_BASE}/fields`;
    console.log("REQUEST:", { method: "GET", url });
    const response = await apiFetch(url, {
      headers: BASE_HEADERS,
      credentials: 'include',
    });
    const data = await response.json();
    console.log("RESPONSE:", { url, status: response.status, data });
    if (!response.ok) throw new Error(data.error || 'Failed to fetch fields');
    return data;
  },
  
  createField: async (data: any) => {
    console.log("REQUEST:", { method: "POST", url: `${API_BASE}/fields`, payload: data });
    const response = await apiFetch(`${API_BASE}/fields`, {
      method: 'POST',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log("RESPONSE:", { method: "POST", url: `${API_BASE}/fields`, status: response.status, result });
    if (!response.ok) throw new Error(result.error || 'Failed to create field');
    return result;
  },
  
  updateField: async (id: string, data: any) => {
    console.log("REQUEST:", { method: "PUT", url: `${API_BASE}/fields/${id}`, payload: data });
    const response = await apiFetch(`${API_BASE}/fields/${id}`, {
      method: 'PUT',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log("RESPONSE:", { method: "PUT", url: `${API_BASE}/fields/${id}`, status: response.status, result });
    if (!response.ok) throw new Error(result.error || 'Failed to update field');
    return result;
  },
  
  deleteField: async (id: string) => {
    console.log("REQUEST:", { method: "DELETE", url: `${API_BASE}/fields/${id}` });
    const response = await apiFetch(`${API_BASE}/fields/${id}`, {
      method: 'DELETE',
      headers: BASE_HEADERS,
      credentials: 'include',
    });
    const result = await response.json();
    console.log("RESPONSE:", { method: "DELETE", url: `${API_BASE}/fields/${id}`, status: response.status, result });
    if (!response.ok) throw new Error(result.error || 'Failed to delete field');
    return result;
  },

  // RULE APIs
  getRules: async (workTypeId?: string) => {
    const url = workTypeId ? `${API_BASE}/rules?work_type_id=${workTypeId}` : `${API_BASE}/rules`;
    console.log("REQUEST:", { method: "GET", url });
    const response = await apiFetch(url, {
      headers: BASE_HEADERS,
      credentials: 'include',
    });
    const data = await response.json();
    console.log("RESPONSE:", { url, status: response.status, data });
    if (!response.ok) throw new Error(data.error || 'Failed to fetch rules');
    return data;
  },
  
  createRule: async (data: any) => {
    console.log("REQUEST:", { method: "POST", url: `${API_BASE}/rules`, payload: data });
    const response = await apiFetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log("RESPONSE:", { method: "POST", url: `${API_BASE}/rules`, status: response.status, result });
    if (!response.ok) throw new Error(result.error || 'Failed to create rule');
    return result;
  },
  
  updateRule: async (id: string, data: any) => {
    console.log("REQUEST:", { method: "PUT", url: `${API_BASE}/rules/${id}`, payload: data });
    const response = await apiFetch(`${API_BASE}/rules/${id}`, {
      method: 'PUT',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log("RESPONSE:", { method: "PUT", url: `${API_BASE}/rules/${id}`, status: response.status, result });
    if (!response.ok) throw new Error(result.error || 'Failed to update rule');
    return result;
  },
  
  deleteRule: async (id: string) => {
    console.log("REQUEST:", { method: "DELETE", url: `${API_BASE}/rules/${id}` });
    const response = await apiFetch(`${API_BASE}/rules/${id}`, {
      method: 'DELETE',
      headers: BASE_HEADERS,
      credentials: 'include',
    });
    const result = await response.json();
    console.log("RESPONSE:", { method: "DELETE", url: `${API_BASE}/rules/${id}`, status: response.status, result });
    if (!response.ok) throw new Error(result.error || 'Failed to delete rule');
    return result;
  },

  matchFees: async (data: {
    work_type_id: string;
    values: Record<string, any>;
  }) => {
    console.log("REQUEST:", { method: "POST", url: `${API_BASE}/match`, payload: data });
    const response = await apiFetch(`${API_BASE}/match`, {
      method: 'POST',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log("RESPONSE:", { method: "POST", url: `${API_BASE}/match`, status: response.status, result });
    if (!response.ok) throw new Error(result.error || 'Failed to match fees');
    return result;
  },

  // NEW INDEPENDENT LIBRARY APIs
  getLibrary: async () => {
    const url = `${API_BASE}/library`;
    const response = await apiFetch(url, { headers: BASE_HEADERS, credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch library');
    return data;
  },

  checkApplicability: async (data: {
    government_fee_ids: string[];
    context?: any;
    manual_values?: any;
    as_of_date?: string;
  }) => {
    const response = await apiFetch(`${API_BASE}/check-applicability`, {
      method: 'POST',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to check applicability');
    return result.data;
  },

  getSuggestions: async (data: { context: any, manual_values: any, as_of_date?: string }) => {
    const response = await apiFetch(`${API_BASE}/suggestions`, {
      method: 'POST',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to get suggestions');
    return result.data;
  },

  // SOURCE MAPPING APIs
  discoverSourceMappings: async () => {
    const response = await apiFetch(`${API_BASE}/source-mappings/discover`, { headers: BASE_HEADERS, credentials: 'include' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to discover mappings');
    return result.data;
  },

  getSourceMappings: async () => {
    const response = await apiFetch(`${API_BASE}/source-mappings`, { headers: BASE_HEADERS, credentials: 'include' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to fetch mappings');
    return result.data;
  },

  createSourceMapping: async (data: any) => {
    const response = await apiFetch(`${API_BASE}/source-mappings`, {
      method: 'POST',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to create mapping');
    return result.data;
  },

  updateSourceMapping: async (id: string, data: any) => {
    const response = await apiFetch(`${API_BASE}/source-mappings/${id}`, {
      method: 'PUT',
      headers: BASE_HEADERS,
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to update mapping');
    return result.data;
  },

  deleteSourceMapping: async (id: string) => {
    const response = await apiFetch(`${API_BASE}/source-mappings/${id}`, {
      method: 'DELETE',
      headers: BASE_HEADERS,
      credentials: 'include',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to delete mapping');
    return result.data;
  }
};
