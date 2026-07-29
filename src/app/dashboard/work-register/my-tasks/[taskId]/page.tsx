'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, FileText, Video, CheckCircle2, User, Clock, Info, AlertTriangle, Mic, Download, ExternalLink, PlayCircle, Play, Pause, X } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { MetadataPanel } from '@/components/common/metadata-panel';
import { useActiveWork } from '@/contexts/ActiveWorkContext';

// ─── Field Normalizers ────────────────────────────────────────────────────────

function sanitizeErrorMessage(error: any, fallback = 'An error occurred'): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return fallback;
}

function normalizeDocumentFields(step: any): {
  key: string;
  label: string;
  type: string;
  required: boolean;
  maxSizeMB?: number;
  allowedTypes?: string[];
  helpText?: string;
}[] {
  const raw =
    step?.document_fields ||
    step?.documentFields ||
    step?.requiredDocs ||
    step?.required_docs ||
    step?.documents ||
    [];
  if (!Array.isArray(raw)) return [];

  return raw.map((doc: any, index: number) => {
    if (typeof doc === 'string') {
      return {
        key: doc || `document_${index}`,
        label: doc || `Document ${index + 1}`,
        type: 'CHECKBOX',
        required: false
      };
    }

    // Label — camelCase first, then snake_case, then fallbacks
    const label = String(
      doc?.fieldName ??
      doc?.field_name ??
      doc?.label ??
      doc?.field_label ??
      doc?.name ??
      doc?.title ??
      doc?.key ??
      doc?.fieldKey ??
      doc?.field_key ??
      `Document ${index + 1}`
    );

    // Key — camelCase first, then snake_case
    const rawKey =
      (doc?.fieldKey ??
      doc?.field_key ??
      doc?.key ??
      // slugify the label as a fallback
      label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')) ||
      `document_${index}`;

    return {
      key: String(rawKey),
      label,
      type: String(doc?.fieldType ?? doc?.field_type ?? doc?.type ?? 'CHECKBOX'),
      required: Boolean(doc?.required ?? doc?.is_required),
      maxSizeMB: doc?.maxSizeMB ?? doc?.max_size_mb ?? doc?.maxSizeMb,
      allowedTypes: doc?.allowedTypes ?? doc?.allowed_types,
      helpText: doc?.helpText ?? doc?.help_text
    };
  });
}

function normalizeCustomFields(step: any): { key: string; label: string; type: string; placeholder: string; required: boolean; options: string[] }[] {
  const raw = step?.custom_fields || step?.customFields || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((field: any, index: number) => ({
    key: String(field?.key || field?.field_key || field?.name || `custom_${index}`),
    label: String(field?.label || field?.field_label || field?.name || `Field ${index + 1}`),
    type: field?.type || field?.field_type || 'TEXT',
    placeholder: field?.placeholder || '',
    required: Boolean(field?.required || field?.is_required),
    options: Array.isArray(field?.options) ? field.options : []
  }));
}

function normalizeCommonFields(template: any): { key: string; label: string; type: string; placeholder: string; required: boolean; options: string[] }[] {
  const raw = template?.common_information_fields || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((field: any, index: number) => ({
    key: String(field?.key || field?.field_key || field?.name || `common_${index}`),
    label: String(field?.label || field?.field_label || field?.name || `Field ${index + 1}`),
    type: field?.type || field?.field_type || 'TEXT',
    placeholder: field?.placeholder || '',
    required: Boolean(field?.required || field?.is_required),
    options: Array.isArray(field?.options) ? field.options : []
  }));
}

/** Extract src from iframe HTML if present, otherwise convert to embed URL */
function toEmbedUrl(url: string): string {
  if (!url) return '';

  // If it looks like an iframe tag, extract the src attribute
  if (url.trim().startsWith('<iframe') || url.includes('<iframe')) {
    const match = url.match(/src=["']([^"']+)["']/);
    if (match) return match[1];
  }

  try {
    const parsed = new URL(url);
    // youtube.com/watch?v=
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`;
    }
    // youtu.be/
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    // youtube.com/shorts/
    if (parsed.hostname.includes('youtube.com') && parsed.pathname.includes('/shorts/')) {
      const id = parsed.pathname.split('/shorts/')[1]?.split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    // Already an embed URL
    if (parsed.pathname.includes('/embed/')) return url;
    return url;
  } catch {
    return url;
  }
}

function getVideoUrl(step: any): string {
  return step?.video_url || step?.videoUrl || step?.video_link || step?.video || '';
}

function calculateProgress(steps: any[], progress: any) {
  const total = steps.length;
  const completed = steps.filter((step: any) => progress?.[step.id]?.status === 'COMPLETED').length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params?.taskId as string;
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canManageWork = hasPermission('MANAGE_WORK');

  const [taskPayload, setTaskPayload] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingDocs, setUploadingDocs] = React.useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement>>({});
  const [videoOpenStepId, setVideoOpenStepId] = useState<string | null>(null);

  const { startWork, resumeWork, pauseWork, activeWork, refreshActiveWork, clearActiveWorkLocal } = useActiveWork();

  useEffect(() => {
    if (!taskId || !user?.uid) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.uid,
            'x-user-email': user.email || ''
          }
        });
        const result = await res.json();
        if (result.success && result.data) {
          setTaskPayload(result.data);
        } else {
          toast({ title: 'Error', description: sanitizeErrorMessage(result.error, 'Failed to load task'), variant: 'destructive' });
          router.push('/dashboard/work-register/my-tasks');
        }
      } catch (error) {
        console.error('Error fetching task:', error);
        toast({ title: 'Error', description: 'Failed to load task', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [taskId, toast, router, user]);

  // ── Step progress state changes ─────────────────────────────────────────────

  const handleStepStateChange = (stepId: string, field: 'remarks' | 'checkedDocs' | 'customFieldValues', value: any) => {
    if (!taskPayload) return;
    const updatedProgress = { ...(taskPayload.progress || {}) };
    if (!updatedProgress[stepId]) {
      updatedProgress[stepId] = { status: 'PENDING', remarks: '', checkedDocs: {}, customFieldValues: {} };
    }
    if (field === 'checkedDocs') {
      updatedProgress[stepId].checkedDocs = { ...(updatedProgress[stepId].checkedDocs || {}), ...value };
    } else if (field === 'customFieldValues') {
      updatedProgress[stepId].customFieldValues = { ...(updatedProgress[stepId].customFieldValues || {}), ...value };
    } else {
      updatedProgress[stepId][field] = value;
    }
    setTaskPayload({ ...taskPayload, progress: updatedProgress });
  };

  const handleCommonFieldChange = (key: string, value: string) => {
    if (!taskPayload) return;
    const updatedProgress = { ...(taskPayload.progress || {}) };
    if (!updatedProgress['__common']) {
      updatedProgress['__common'] = { commonFieldValues: {} };
    }
    updatedProgress['__common'].commonFieldValues = {
      ...(updatedProgress['__common'].commonFieldValues || {}),
      [key]: value
    };
    setTaskPayload({ ...taskPayload, progress: updatedProgress });
  };

  // ── Save handlers ───────────────────────────────────────────────────────────

  const handleSaveCommonInfo = async () => {
    if (!taskPayload || !user?.uid) return;
    setIsSaving(true);
    try {
      const commonFieldValues = taskPayload.progress?.['__common']?.commonFieldValues || {};
      const res = await fetch(`/api/tasks/${taskId}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        },
        body: JSON.stringify({ stepId: '__common', commonFieldValues })
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Saved', description: 'Common information saved.' });
        if (result.progress) {
          setTaskPayload({ ...taskPayload, progress: result.progress });
        }
      } else {
        throw new Error(result.error || 'Failed to save common info');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: sanitizeErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProgress = async (stepId: string, markComplete = false) => {
    if (!taskPayload || !user?.uid) return;

    // Validation for markComplete
    if (markComplete) {
      const step = workflow?.steps?.find((s: any) => s.id === stepId);
      if (step) {
        const docFields = normalizeDocumentFields(step);
        const stepProgress = taskPayload.progress?.[stepId] || {};
        const checkedDocs = stepProgress.checkedDocs || {};
        
        for (const doc of docFields) {
          if (doc.required) {
            const val = checkedDocs[doc.key];
            const docType = doc.type.toLowerCase();
            const isFile = ['file', 'pdf', 'image'].includes(docType);
            const isCheckbox = docType === 'checkbox';

            if (isFile) {
              if (!val || !val.uploaded) {
                      toast({ title: 'Validation Error', description: `${doc.label} is required. Please upload a file.`, variant: 'destructive' });
                      return;
                    }
            } else if (isCheckbox) {
              if (!val) {
                toast({ title: 'Validation Error', description: `${doc.label} must be checked.`, variant: 'destructive' });
                return;
              }
            } else {
              if (val === undefined || val === null || val === '') {
                toast({ title: 'Validation Error', description: `${doc.label} is required.`, variant: 'destructive' });
                return;
              }
            }
          }
        }
      }
    }

    setIsSaving(true);
    try {
      const stepProgress = taskPayload.progress?.[stepId] || {};
      const statusToSave = markComplete ? 'COMPLETED' : (stepProgress.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS');

      const payload = {
        stepId,
        status: statusToSave,
        remarks: stepProgress.remarks || '',
        checkedDocs: stepProgress.checkedDocs || {},
        customFieldValues: stepProgress.customFieldValues || {}
      };

      const res = await fetch(`/api/tasks/${taskId}/progress`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        toast({
          title: markComplete ? 'Step Completed' : 'Progress Saved',
          description: 'Your changes have been saved.'
        });
        if (result.progress) {
          setTaskPayload({ ...taskPayload, progress: result.progress });
        } else {
          const updatedProgress = { ...(taskPayload.progress || {}), [stepId]: { ...stepProgress, status: statusToSave } };
          setTaskPayload({ ...taskPayload, progress: updatedProgress });
        }
      } else {
        throw new Error(result.error || 'Failed to save progress');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: sanitizeErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!taskPayload || !user?.uid) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        }
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Task Completed', description: 'The task has been marked as completed.' });
        clearActiveWorkLocal(taskId);
        await refreshActiveWork();
        router.push('/dashboard/work-register/my-tasks');
      } else {
        throw new Error(result.error || 'Failed to complete task');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: sanitizeErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartWork = async () => {
    if (!user?.uid) return;

    if (activeWork && activeWork.task_id === taskId) {
      if (activeWork.status === 'paused') {
          try {
              setIsSaving(true);
              await resumeWork(activeWork.id);
              toast({ title: 'Work Resumed', description: 'The task is now in progress.' });
              setTaskPayload({ ...taskPayload, task: { ...taskPayload.task, status: 'IN_PROGRESS' } });
          } catch (err) {
              toast({ title: "Error", description: "Could not resume work.", variant: "destructive" });
          } finally {
              setIsSaving(false);
          }
      }
      return;
    }

    setIsSaving(true);
    try {
      await startWork(taskId);
      toast({ title: 'Work Started', description: 'The task is now in progress.' });
      setTaskPayload({ ...taskPayload, task: { ...taskPayload.task, status: 'IN_PROGRESS' } });
      
      // Keep legacy start API if it marks some specific things inside works table
      await fetch(`/api/tasks/${taskId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        }
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Could not start task.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/submit-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        }
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Submitted', description: 'The task has been submitted for review.' });
        setTaskPayload({ ...taskPayload, task: { ...taskPayload.task, status: 'SUBMITTED_FOR_REVIEW' } });
      } else {
        throw new Error(result.error || 'Failed to submit task');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: sanitizeErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReviewAction = async (action: 'APPROVE' | 'REJECT' | 'REOPEN', remarks: string = '') => {
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
          'x-user-email': user.email || ''
        },
        body: JSON.stringify({ action, remarks })
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Review Submitted', description: `Task has been ${action.toLowerCase()}ed.` });
        const newStatus = action === 'APPROVE' ? 'COMPLETED' : action === 'REJECT' ? 'REJECTED' : 'IN_PROGRESS';
        setTaskPayload({ ...taskPayload, task: { ...taskPayload.task, status: newStatus } });
      } else {
        throw new Error(result.error || 'Failed to submit review');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: sanitizeErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading / Not Found ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!taskPayload || !taskPayload.task) {
    return <div>Task not found.</div>;
  }

  const { task, workflow, progress } = taskPayload;
  const steps: any[] = workflow?.steps || [];
  const template = workflow?.template || null;
  const commonFields = normalizeCommonFields(template);
  const calculatedProgress = calculateProgress(steps, progress);

  // ── Subcomponent: Render a single field ─────────────────────────────────────

  const renderField = (
    field: { key: string; label: string; type: string; placeholder: string; required: boolean; options: string[] },
    value: string,
    onChange: (val: string) => void,
    disabled = false
  ) => {
    const cls = 'bg-card';
    if (field.type === 'TEXTAREA') {
      return (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          disabled={disabled}
          className={cn(cls, 'min-h-[80px] resize-none')}
        />
      );
    }
    if (field.type === 'SELECT' && field.options.length > 0) {
      return (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select...</option>
          {field.options.map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    return (
      <Input
        type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        disabled={disabled}
        className={cls}
      />
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <Button asChild variant="outline">
        <Link href="/dashboard/work-register/my-tasks">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Task List
        </Link>
      </Button>

      {/* ── Top Full-Width Card: General Task Details ── */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-6 lg:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-6 lg:gap-8 items-start">
            
            {/* Left section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={cn(
                  'font-bold uppercase text-[10px]',
                  task.priority === 'High' ? 'bg-red-100 text-red-700' :
                  task.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                )}>
                  {task.priority || 'Medium'}
                </Badge>
                <Badge variant="secondary" className="font-black uppercase tracking-tighter text-[10px]">
                  {(task.status || 'AVAILABLE').replace(/_/g, ' ')}
                </Badge>
                {task.hasFlow && (
                  <Badge className="bg-indigo-100 text-indigo-700 border-border text-[10px]">FLOW WORK</Badge>
                )}
                {task.step_type && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">{task.step_type}</Badge>
                )}
              </div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">{task.title}</h2>
                <p className="text-primary font-medium text-sm lg:text-base mt-1">{task.workTypeName || 'General Task'}</p>
              </div>
            </div>
            
            {/* Right section */}
            <div className="w-full border-t pt-6 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-8 flex flex-col justify-start">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Client
                  </span>
                  <span className="text-sm font-semibold text-foreground">{task.clientName || 'No Client'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <User className="h-3 w-3" /> Team
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {task.assignedTeamName || 'No Team'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Due Date
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {task.dueDate ? format(new Date(task.dueDate), 'dd MMM yyyy') : 'No Due Date'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <User className="h-3 w-3" /> Assigned / Claimed By
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {task.claimedByName || 'Unclaimed'}
                  </span>
                </div>
              </div>
              
              {task.hasFlow && (
                <div className="w-full mt-6 pt-5 border-t border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-foreground">Workflow Progress ({calculatedProgress.completed}/{calculatedProgress.total})</span>
                    <span className="text-sm font-bold text-primary">{calculatedProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${calculatedProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Execution Steps as Tabs ── */}
      <Card className="shadow-sm border-border mt-6">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-xl">Execution Steps</CardTitle>
          <CardDescription>Complete the required steps for this task</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {!task.hasFlow || steps.length === 0 ? (
            <div className="text-center py-10 bg-muted/50 rounded-lg border border-border">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-medium text-foreground">No Execution Steps</h3>
              <p className="text-sm text-muted-foreground mt-1">This task does not have a formal workflow.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Common Information Fields Section ── */}
              {commonFields.length > 0 && (
                <div className="border border-border rounded-lg bg-muted/40 overflow-hidden mb-6">
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground text-sm">Common Information</span>
                    <span className="text-xs text-muted-foreground ml-1">— Required for all steps</span>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {commonFields.map((field: any) => (
                        <div key={field.key} className="space-y-1">
                          <Label className="text-sm font-medium">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {renderField(
                            field,
                            progress?.['__common']?.commonFieldValues?.[field.key] || '',
                            (val: any) => handleCommonFieldChange(field.key, val)
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-border flex justify-end mt-4">
                      <Button
                        onClick={handleSaveCommonInfo}
                        disabled={isSaving}
                        size="sm"
                        variant="outline"
                        className="border-blue-400 text-blue-700 hover:bg-blue-100"
                      >
                        {isSaving ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                        Save Common Info
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Steps Tabs ── */}
              <Tabs defaultValue={steps[0]?.id} className="w-full">
                <TabsList className="flex flex-wrap h-auto p-1 bg-muted/80 justify-start overflow-x-auto w-full gap-1 rounded-lg">
                  {steps.map((step: any, index: number) => {
                    const isCompleted = progress?.[step.id]?.status === 'COMPLETED';
                    return (
                      <TabsTrigger
                        key={step.id}
                        value={step.id}
                        className={cn(
                          "py-2.5 px-4 whitespace-nowrap font-medium text-sm transition-all rounded-md flex items-center gap-2",
                          "data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                          isCompleted ? "bg-emerald-500 text-white" : "bg-slate-300 text-foreground"
                        )}>
                          {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                        </div>
                        Step {index + 1}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <div className="mt-6 border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                  {steps.map((step: any, index: number) => {
                    const stepProgress = progress?.[step.id] || {};
                    const isCompleted = stepProgress.status === 'COMPLETED';
                    const docFields = normalizeDocumentFields(step);
                    const customFieldsList = normalizeCustomFields(step);
                    const rawVideoUrl = getVideoUrl(step);
                    const embedUrl = toEmbedUrl(rawVideoUrl);
                    const isYoutube = embedUrl.includes('youtube.com/embed/');
                    const hasDependencies = Array.isArray(step.depends_on_step_ids) && step.depends_on_step_ids.length > 0;
                    const audioUrl = step.audio_file_url || step.audioFileUrl || step.audio_url || step.audioUrl || "";
                    const audioEnabled = step.audio_enabled === true || step.audioEnabled === true || Boolean(audioUrl);

                    return (
                      <TabsContent value={step.id} key={step.id} className="m-0 focus-visible:outline-none">
                        <div className="p-6">
                          <div className="flex items-center gap-3 text-left w-full border-b pb-4 mb-5">
                            <div className="flex-1 min-w-0">
                              <h3 className={cn('text-lg font-bold', isCompleted ? 'text-emerald-700' : 'text-foreground')}>
                                {index + 1}. {step.step_name}
                              </h3>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {step.step_type && (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground uppercase">{step.step_type}</Badge>
                                )}
                                {step.is_mandatory && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Mandatory</Badge>
                                )}
                                {step.estimated_time && (
                                  <span className="text-xs text-muted-foreground flex items-center bg-muted px-2 py-0.5 rounded-full">
                                    <Clock className="h-3 w-3 mr-1" />{step.estimated_time}
                                  </span>
                                )}
                                {step.video_enabled && rawVideoUrl && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 text-indigo-700 border-border">
                                    <Video className="h-3 w-3 mr-1" />Video Available
                                  </Badge>
                                )}
                                {audioEnabled && audioUrl && (
                                  <Badge className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0 h-4 border border-purple-200">
                                    Audio Available
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {isCompleted && (
                              <div className="ml-auto flex items-center gap-2 shrink-0">
                                {step.is_billable && hasPermission('CREATE_BILLING') && (
                                  <Button 
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-border text-blue-700 hover:bg-muted/50 bg-card"
                                    asChild
                                  >
                                    <Link href={`/dashboard/accounts/billing/create?client_id=${task.clientId || ''}&work_id=${task.id || ''}&billing_type=workflow_step&step_id=${step.id}`}>
                                      Generate Bill
                                    </Link>
                                  </Button>
                                )}
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Completed
                                </Badge>
                              </div>
                            )}
                          </div>

                          <div className="space-y-6">
                            {/* Dependency warning */}
                            {hasDependencies && (
                              <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>
                                  This step depends on other steps being completed first.
                                </span>
                              </div>
                            )}

                            {/* Long description */}
                            {step.long_description && (
                              <div className="text-sm text-foreground bg-muted/50/50 p-4 rounded-md border border-border leading-relaxed whitespace-pre-wrap">
                                {step.long_description}
                              </div>
                            )}

                            {/* Video */}
                            {step.video_enabled && rawVideoUrl && (
                              <div className="space-y-2 bg-muted/50 p-4 rounded-xl border border-border">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setVideoOpenStepId(videoOpenStepId === step.id ? null : step.id)}
                                  className="bg-card border-border text-indigo-700 hover:bg-muted/50 font-medium"
                                >
                                  <Video className="mr-2 h-4 w-4" />
                                  {videoOpenStepId === step.id ? 'Hide Tutorial' : 'Watch Tutorial'}
                                </Button>
                                {videoOpenStepId === step.id && (
                                  <div className="mt-3 rounded-lg overflow-hidden bg-black aspect-video relative shadow-inner">
                                    {isYoutube ? (
                                      <iframe
                                        src={embedUrl}
                                        className="absolute inset-0 w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        title={`Tutorial for ${step.step_name}`}
                                      />
                                    ) : (
                                      <video
                                        src={rawVideoUrl}
                                        controls
                                        className="absolute inset-0 w-full h-full object-contain"
                                      />
                                    )}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground pt-1">
                                  <a href={rawVideoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 inline-flex">
                                    Open in New Tab <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Audio */}
                            {audioEnabled && audioUrl && (
                              <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                    <Mic className="h-4 w-4 text-purple-600" />
                                    Audio Instruction
                                  </h4>
                                  <a
                                    href={audioUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
                                  >
                                    Open in New Tab <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>

                                <audio controls preload="none" className="w-full h-10">
                                  <source src={audioUrl} type="audio/mpeg" />
                                  Your browser does not support the audio element.
                                </audio>
                              </div>
                            )}

                            {/* Document Checks */}
                            <div className="space-y-3 pt-2">
                              <Label className="text-base font-bold text-foreground">Required Document Uploads / Checks</Label>
                              {docFields.length > 0 ? (
                                <div className="grid gap-3">
                                  {docFields.map((doc: any) => {
                                    const docType = doc.type.toLowerCase();
                                    const isCheckbox = docType === 'checkbox';
                                    const isFile = ['file', 'pdf', 'image'].includes(docType);
                                    const val = (stepProgress.checkedDocs || {})[doc.key];
                                    return (
                                      <div key={doc.key} className="flex flex-col p-3 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                                        {isCheckbox ? (
                                          <div className="flex items-start space-x-3">
                                            <Checkbox
                                              id={`${step.id}-${doc.key}`}
                                              checked={Boolean(val)}
                                              onCheckedChange={(checked) =>
                                                handleStepStateChange(step.id, 'checkedDocs', { [doc.key]: Boolean(checked) })
                                              }
                                              disabled={isCompleted || !canManageWork}
                                              className="mt-1 h-5 w-5 rounded data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                            />
                                            <div className="flex flex-col">
                                              <Label
                                                htmlFor={`${step.id}-${doc.key}`}
                                                className="font-semibold text-sm cursor-pointer text-foreground leading-snug"
                                              >
                                                {doc.label}
                                                {doc.required && <span className="text-red-500 ml-1">*</span>}
                                              </Label>
                                              {doc.helpText && (
                                                <span className="text-xs text-muted-foreground mt-1">{doc.helpText}</span>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="space-y-2">
                                            <Label
                                              htmlFor={`${step.id}-${doc.key}`}
                                              className="font-semibold text-sm text-foreground leading-snug"
                                            >
                                              {doc.label}
                                              {doc.required && <span className="text-red-500 ml-1">*</span>}
                                              {doc.maxSizeMB && (
                                                <span className="text-xs text-muted-foreground font-normal ml-2">(Max {doc.maxSizeMB}MB)</span>
                                              )}
                                            </Label>
                                            {doc.helpText && (
                                              <span className="text-xs text-muted-foreground block mb-1">{doc.helpText}</span>
                                            )}
                                            
                                            {isFile ? (
                                              <div className="space-y-1">
                                                {val?.uploaded === true && val?.storagePath ? (
                                                  <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-100 rounded-md">
                                                    <span className="text-sm text-emerald-700 font-medium truncate pr-2">
                                                      {val.name || 'Document Uploaded'}
                                                    </span>
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100"
                                                      onClick={() => handleStepStateChange(step.id, 'checkedDocs', { [doc.key]: null })}
                                                      disabled={isCompleted || !canManageWork}
                                                    >
                                                      <X className="h-4 w-4" />
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  <Input
                                                    id={`${step.id}-${doc.key}`}
                                                    type="file"
                                                    accept={doc.acceptedFileTypes?.join(',')}
                                                    disabled={isCompleted || !canManageWork || uploadingDocs[doc.key]}
                                                    onChange={async (e) => {
                                                      const file = e.target.files?.[0];
                                                      if (!file) {
                                                        return;
                                                      }
                                                      
                                                      const stepInstanceId = stepProgress?.stepInstanceId;
                                                      if (!stepInstanceId) {
                                                        toast({
                                                          title: 'Upload Error',
                                                          description: 'Workflow step execution has not been initialized.',
                                                          variant: 'destructive',
                                                        });
                                                        e.target.value = '';
                                                        return;
                                                      }

                                                      if (doc.maxSizeMB && file.size > doc.maxSizeMB * 1024 * 1024) {
                                                        toast({
                                                          title: 'File too large',
                                                          description: `Maximum size is ${doc.maxSizeMB}MB`,
                                                          variant: 'destructive',
                                                        });
                                                        e.target.value = '';
                                                        return;
                                                      }
                                                      setUploadingDocs(prev => ({ ...prev, [doc.key]: true }));
                                                      try {
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        const response = await fetch(`/api/tasks/${taskId}/steps/${stepInstanceId}/documents/${doc.key}`, {
                                                          method: 'POST',
                                                          credentials: 'include',
                                                          body: formData,
                                                        });
                                                        if (!response.ok) {
                                                          const errorData = await response.json();
                                                          throw new Error(errorData.message || errorData.error || 'Upload failed');
                                                        }
                                                        const result = await response.json();
                                                        if (result.success !== false) {
                                                           handleStepStateChange(step.id, 'checkedDocs', { [doc.key]: result.data });
                                                           // Assuming global state refresh might be needed to get updated progress, but handleStepStateChange updates local.
                                                        } else {
                                                            throw new Error(result.error || 'Upload failed');
                                                        }
                                                      } catch (uploadError) {
                                                        toast({
                                                          title: 'Upload Error',
                                                          description: (uploadError as Error).message || 'Failed to upload document.',
                                                          variant: 'destructive',
                                                        });
                                                        e.target.value = '';
                                                      } finally {
                                                        setUploadingDocs(prev => ({ ...prev, [doc.key]: false }));
                                                      }
                                                    }}
                                                  />
                                                )}
                                                {uploadingDocs[doc.key] && (
                                                   <div className="text-xs text-primary font-medium mt-1">Uploading...</div>
                                                )}
                                              </div>
                                            ) : docType === 'textarea' ? (
                                              <Textarea
                                                id={`${step.id}-${doc.key}`}
                                                disabled={isCompleted || !canManageWork}
                                                value={val || ''}
                                                onChange={(e) => handleStepStateChange(step.id, 'checkedDocs', { [doc.key]: e.target.value })}
                                              />
                                            ) : (
                                              <Input
                                                id={`${step.id}-${doc.key}`}
                                                type={docType === 'number' ? 'number' : docType === 'date' ? 'date' : 'text'}
                                                disabled={isCompleted || !canManageWork}
                                                value={val || ''}
                                                onChange={(e) => handleStepStateChange(step.id, 'checkedDocs', { [doc.key]: e.target.value })}
                                              />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic bg-muted/50 p-3 rounded-md border border-border">No document checks configured for this step.</p>
                              )}
                            </div>

                            {/* Custom Fields */}
                            {customFieldsList.length > 0 && (
                              <div className="space-y-3 pt-2">
                                <Label className="text-base font-bold text-foreground">Custom Fields</Label>
                                <div className="grid gap-4 border border-border rounded-lg p-4 bg-card">
                                  {customFieldsList.map((field: any) => (
                                    <div key={field.key} className="space-y-1.5">
                                      <Label className="text-sm font-semibold text-foreground">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                      </Label>
                                      {renderField(
                                        field,
                                        stepProgress.customFieldValues?.[field.key] || '',
                                        (val: any) => handleStepStateChange(step.id, 'customFieldValues', { [field.key]: val }),
                                        isCompleted || !canManageWork
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Remarks */}
                            <div className="space-y-3 pt-2">
                              <Label htmlFor={`remarks-${step.id}`} className="text-base font-bold text-foreground">
                                Remarks / Output
                              </Label>
                              <Textarea
                                id={`remarks-${step.id}`}
                                placeholder="Add execution notes..."
                                value={stepProgress.remarks || ''}
                                onChange={(e) => handleStepStateChange(step.id, 'remarks', e.target.value)}
                                disabled={isCompleted || !canManageWork}
                                className="min-h-[120px] resize-y bg-card border-border focus:border-primary"
                              />
                            </div>

                            {/* Step Actions */}
                            {!isCompleted && canManageWork && (
                              <div className="flex gap-3 pt-4 mt-6 border-t border-border">
                                <Button
                                  onClick={() => handleSaveProgress(step.id, false)}
                                  variant="outline"
                                  disabled={isSaving}
                                  className="border-border font-medium"
                                >
                                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Save Draft
                                </Button>
                                <Button
                                  onClick={() => handleSaveProgress(step.id, true)}
                                  disabled={isSaving}
                                  className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                                >
                                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Mark Step Complete
                                </Button>
                              </div>
                            )}

                            {isCompleted && (
                              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-6 text-sm font-medium">
                                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                                <span>This step has been successfully completed.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    );
                  })}
                </div>
              </Tabs>
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 border-t border-border mt-6 py-5 px-6 rounded-b-xl flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm font-medium text-muted-foreground">Task Actions</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {(() => {
                const isCompleted = ['COMPLETED', 'Completed', 'REJECTED'].includes(task.status);
                if (isCompleted) return null;

                // This task is the currently active one
                if (activeWork && activeWork.task_id === taskId) {
                    if (activeWork.status === 'in_progress') {
                        return (
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
                                    <PlayCircle className="h-4 w-4 animate-pulse" /> Working...
                                </span>
                                <Button
                                    onClick={pauseWork}
                                    disabled={isSaving}
                                    variant="outline"
                                    className="border-amber-400 text-amber-700 hover:bg-amber-50 font-bold"
                                >
                                    <Pause className="h-4 w-4 mr-2" /> Pause
                                </Button>
                            </div>
                        );
                    } else if (activeWork.status === 'paused') {
                        return (
                            <Button onClick={handleStartWork} disabled={isSaving} className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
                                <Play className="h-4 w-4 mr-2" /> Continue Task
                            </Button>
                        );
                    }
                }

                // A different task is in progress — block start
                if (activeWork && activeWork.status === 'in_progress') {
                    return (
                        <Button disabled variant="outline" className="border-border text-muted-foreground font-bold cursor-not-allowed" title="Pause your current task first">
                            <FileText className="h-4 w-4 mr-2" /> Start Task
                        </Button>
                    );
                }

                // No active work — show Start Task
                if (task.status === 'ASSIGNED' || task.status === 'CLAIMED' || task.status === 'AVAILABLE' || task.status === 'IN_PROGRESS') {
                    return (
                        <Button onClick={handleStartWork} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-sm">
                            <FileText className="h-4 w-4 mr-2" /> Start Task
                        </Button>
                    );
                }

                return null;
            })()}

            {task.status === 'IN_PROGRESS' && canManageWork && (
              <Button
                onClick={handleSubmitForReview}
                disabled={isSaving || (task.hasFlow && calculatedProgress.completed < calculatedProgress.total)}
                variant="outline"
                className="border-amber-600 text-amber-700 hover:bg-amber-50 font-bold"
              >
                Submit for Review
              </Button>
            )}

            {task.status === 'SUBMITTED_FOR_REVIEW' && hasPermission('MANAGE_WORK') && (
              <>
                <Button
                  onClick={() => handleReviewAction('REJECT', 'Rejected by review')}
                  disabled={isSaving}
                  variant="outline"
                  className="border-red-600 text-red-700 hover:bg-red-50 font-bold"
                >
                  Reject
                </Button>
                <Button
                  onClick={() => handleReviewAction('REOPEN', 'Reopened for corrections')}
                  disabled={isSaving}
                  variant="outline"
                  className="border-blue-600 text-blue-700 hover:bg-muted/50 font-bold"
                >
                  Reopen
                </Button>
                <Button
                  onClick={() => handleReviewAction('APPROVE', 'Approved')}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                >
                  Approve & Complete
                </Button>
              </>
            )}

            {hasPermission('COMPLETE_TASKS') && task.status !== 'COMPLETED' && task.status !== 'SUBMITTED_FOR_REVIEW' && (
              <Button
                onClick={handleMarkComplete}
                disabled={isSaving || (task.hasFlow && calculatedProgress.completed < calculatedProgress.total)}
                className="bg-emerald-600 hover:bg-emerald-700 font-bold"
              >
                Mark Complete
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
      
      {/* Metadata Panel */}
      {(() => {
        const createdBy = task.created_by_name || (task.created_by ? "System User" : undefined);
        const createdOn = task.created_at ? format(new Date(task.created_at), 'dd MMM yyyy, p') : undefined;
        const updatedBy = task.updated_by_name || (task.updated_by ? "System User" : undefined);
        const updatedOn = task.updated_at ? format(new Date(task.updated_at), 'dd MMM yyyy, p') : undefined;
        
        const isValid = (val?: string) => val && val.trim() !== "" && val !== "-" && val !== "N/A" && val !== "--";
        
        if (!isValid(createdBy) && !isValid(createdOn) && !isValid(updatedBy) && !isValid(updatedOn)) {
          return null;
        }

        return (
          <div className="mt-8 flex justify-end">
            <div className="w-full md:w-1/2 lg:w-1/3">
              <Card className="shadow-sm border-border">
                <CardContent className="p-0">
                  <MetadataPanel 
                    createdBy={createdBy}
                    createdOn={createdOn}
                    updatedBy={updatedBy}
                    updatedOn={updatedOn}
                    className="p-6 grid grid-cols-2 gap-4"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
