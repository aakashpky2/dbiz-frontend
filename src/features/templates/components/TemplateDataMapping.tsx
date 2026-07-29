import React from 'react';
import { Database, Link, Save, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';
import { Placeholder } from '../hooks/useTemplateDetection';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface MappingProps {
  placeholders: Placeholder[];
  exposedTables: string[];
  onUpdate: (placeholder: Placeholder) => void;
}

const AUTHORIZED_TABLES = {
  Employees: [
    { value: 'employees.full_name', label: 'Full Name' },
    { value: 'employees.email', label: 'Email Address' },
    { value: 'employees.phone_number', label: 'Phone Number' },
    { value: 'employees.date_of_birth', label: 'Date of Birth' },
    { value: 'employees.gender', label: 'Gender' },
    { value: 'employees.marital_status', label: 'Marital Status' },
    { value: 'employees.blood_group', label: 'Blood Group' },
    { value: 'employees.joining_date', label: 'Date of Joining' },
    { value: 'employees.employee_role', label: 'Role / Designation' },
    { value: 'employees.monthly_salary', label: 'Monthly Salary' },
  ],
  Employee_Addresses: [
    { value: 'employee_addresses.building_no', label: 'Building / House No' },
    { value: 'employee_addresses.street', label: 'Street / Area' },
    { value: 'employee_addresses.city', label: 'City / Town' },
    { value: 'employee_addresses.state', label: 'State / Province' },
    { value: 'employee_addresses.pincode', label: 'Pincode / Zip Code' }
  ],
  Employee_Bank_Details: [
    { value: 'employee_bank_details.account_holder_name', label: 'Account Holder Name' },
    { value: 'employee_bank_details.account_number', label: 'Account Number' },
    { value: 'employee_bank_details.ifsc_code', label: 'IFSC Code' },
    { value: 'employee_bank_details.bank_branch', label: 'Bank Branch' }
  ],
  Departments: [
    { value: 'departments.name', label: 'Department Name' },
    { value: 'departments.description', label: 'Department Description' },
    { value: 'departments.status', label: 'Department Status' }
  ],
  Work_Categories: [
    { value: 'work_categories.name', label: 'Category Name' },
    { value: 'work_categories.description', label: 'Category Description' }
  ],
  Work_Types: [
    { value: 'work_types.name', label: 'Work Type Name' },
    { value: 'work_types.description', label: 'Work Type Description' },
    { value: 'work_types.constitution_rule', label: 'Constitution Rule' }
  ],
  Job_Openings: [
    { value: 'job_openings.title', label: 'Job Title' },
    { value: 'job_openings.department', label: 'Department' },
    { value: 'job_openings.employment_type', label: 'Employment Type' },
    { value: 'job_openings.location', label: 'Job Location' },
    { value: 'job_openings.experience', label: 'Experience Required' },
    { value: 'job_openings.salary_range', label: 'Salary Range' },
    { value: 'job_openings.description', label: 'Job Description' },
    { value: 'job_openings.skills', label: 'Required Skills' },
    { value: 'job_openings.status', label: 'Job Status' },
    { value: 'job_openings.deadline', label: 'Application Deadline' },
  ],
  Applicants: [
    { value: 'applicants.name', label: 'Applicant Name' },
    { value: 'applicants.email', label: 'Applicant Email' },
    { value: 'applicants.phone', label: 'Applicant Phone' },
    { value: 'applicants.position', label: 'Applied Position' },
    { value: 'applicants.source', label: 'Application Source' },
    { value: 'applicants.referring_employee', label: 'Referring Employee' },
    { value: 'applicants.status', label: 'Applicant Status' },
    { value: 'applicants.experience', label: 'Experience' },
    { value: 'applicants.location', label: 'Applicant Location' },
    { value: 'applicants.interview_date', label: 'Interview Date' },
    { value: 'applicants.interview_time', label: 'Interview Time' },
    { value: 'applicants.interview_mode', label: 'Interview Mode' },
    { value: 'applicants.interview_notes', label: 'Interview Notes' },
    { value: 'applicants.assigned_hr', label: 'Assigned HR' },
    { value: 'applicants.applied_date', label: 'Date Applied' },
  ],
  Interviews: [
    { value: 'interviews.interview_date', label: 'Interview Date' },
    { value: 'interviews.interview_time', label: 'Interview Time' },
    { value: 'interviews.interview_mode', label: 'Interview Mode' },
    { value: 'interviews.interviewer', label: 'Interviewer Name' },
    { value: 'interviews.status', label: 'Interview Status' },
    { value: 'interviews.postponed_by', label: 'Postponed By' },
    { value: 'interviews.postponement_reason', label: 'Postponement Reason' },
    { value: 'interviews.notes', label: 'Interview Notes' },
  ],
  Teams: [
    { value: 'teams.name', label: 'Team Name' },
    { value: 'teams.lead_name', label: 'Team Lead' },
    { value: 'teams.department', label: 'Department' },
  ],
  Attendance: [
    { value: 'attendance.employee_name', label: 'Employee Name' },
    { value: 'attendance.date', label: 'Date' },
    { value: 'attendance.status', label: 'Attendance Status' },
    { value: 'attendance.clock_in', label: 'Clock In' },
    { value: 'attendance.clock_out', label: 'Clock Out' },
  ],
  Clients: [
    { value: 'clients.client_name', label: 'Client Name (Entity)' },
    { value: 'clients.email', label: 'Primary Email' },
    { value: 'clients.phone', label: 'Primary Phone' },
    { value: 'clients.address', label: 'Registered Address' },
    { value: 'clients.pan_no', label: 'PAN Card Number' },
    { value: 'clients.gst_no', label: 'GSTIN' },
    { value: 'clients.constitution', label: 'Business Constitution' },
    { value: 'clients.iec_code', label: 'IEC Code' },
    { value: 'clients.msme_no', label: 'MSME No' },
  ],
  Temporary_Clients: [
    { value: 'temporary_clients.client_name', label: 'Entity Name' },
    { value: 'temporary_clients.contact_person', label: 'Contact Person' },
    { value: 'temporary_clients.contact_email', label: 'Contact Email' },
    { value: 'temporary_clients.contact_phone', label: 'Contact Phone' },
    { value: 'temporary_clients.reference', label: 'Reference Source' },
  ],
  Works: [
    { value: 'works.project_name', label: 'Project Name' },
    { value: 'works.client_name', label: 'Client Name' },
    { value: 'works.status', label: 'Work Status' },
    { value: 'works.start_date', label: 'Start Date' },
    { value: 'works.end_date', label: 'End Date' },
  ],
  Tasks: [
    { value: 'tasks.title', label: 'Task Title' },
    { value: 'tasks.description', label: 'Task Description' },
    { value: 'tasks.status', label: 'Task Status' },
    { value: 'tasks.priority', label: 'Priority' },
    { value: 'tasks.due_date', label: 'Due Date' },
  ],
  Queries: [
    { value: 'queries.company_name', label: 'Company/Enquirer Name' },
    { value: 'queries.contact_person', label: 'Contact Person Name' },
    { value: 'queries.contact_number', label: 'Contact Phone Number' },
    { value: 'queries.email_id', label: 'Contact Email ID' },
    { value: 'queries.query_details', label: 'Requirements/Details' },
    { value: 'queries.remarks', label: 'Remarks/Note' },
    { value: 'queries.status', label: 'Lead/Enquiry Status' },
  ],
  Associates: [
    { value: 'associates.name', label: 'Associate Name' },
    { value: 'associates.email', label: 'Associate Email' },
    { value: 'associates.phone', label: 'Associate Phone' },
    { value: 'associates.firm_name', label: 'Firm Name' },
  ],
  Proposals: [
    { value: 'proposals.client_name', label: 'Client Name' },
    { value: 'proposals.description', label: 'Proposal Description' },
    { value: 'proposals.professional_fee', label: 'Professional Fee' },
    { value: 'proposals.government_fee', label: 'Government Fee' },
    { value: 'proposals.gst_percentage', label: 'GST Percentage' },
    { value: 'proposals.gst_amount', label: 'GST Amount' },
    { value: 'proposals.total_amount', label: 'Total Amount' },
    { value: 'proposals.gst_target', label: 'GST Target' },
    { value: 'proposals.status', label: 'Proposal Status' },
    { value: 'proposals.current_stage', label: 'Pipeline Stage' },
    { value: 'proposals.validity', label: 'Validity Period' },
    { value: 'proposals.created_at', label: 'Date Created' },
    { value: 'proposals.id', label: 'Proposal ID' },
  ],
  DSC: [
    { value: 'dsc.client_name', label: 'Client Name' },
    { value: 'dsc.certificate_type', label: 'Certificate Type' },
    { value: 'dsc.expiry_date', label: 'Expiry Date' },
    { value: 'dsc.status', label: 'DSC Status' },
  ],
};

export default function TemplateDataMapping({ placeholders, exposedTables, onUpdate }: MappingProps) {
  const mappedCount = placeholders.filter(p => p.mappedField || p.defaultValue).length;
  const isComplete = mappedCount === placeholders.length && placeholders.length > 0;

  // Filter tables based on master exposure list
  const visibleTables = Object.entries(AUTHORIZED_TABLES).filter(([table]) => 
    exposedTables.includes(table)
  );

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in duration-500 pb-24">
      <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden mb-6 p-8 flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 flex items-center gap-3">
             <Database className="h-6 w-6 text-indigo-600" />
             Data Mapping
           </h2>
           <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mt-1">
             Map placeholders to database fields.
           </p>
        </div>
        <div className="flex items-center gap-4 text-left border-l pl-6">
           <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mapping Status</span>
              <span className="text-xl font-black tracking-tighter">{mappedCount} / {placeholders.length}</span>
           </div>
           {isComplete ? (
              <Badge className="bg-emerald-50 text-emerald-600 border-none px-4 py-1.5 uppercase font-black tracking-widest text-[9px] shadow-sm"><CheckCircle2 className="w-3 h-3 mr-1" /> Fully Mapped</Badge>
           ) : (
              <Badge className="bg-amber-50 text-amber-600 border-none px-4 py-1.5 uppercase font-black tracking-widest text-[9px] shadow-sm"><ShieldAlert className="w-3 h-3 mr-1" /> Pending</Badge>
           )}
        </div>
      </div>

      <div className="bg-white border rounded-3xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Placeholder</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Type</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Database Field</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Default Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
             {placeholders.length === 0 ? (
               <tr>
                 <td colSpan={4} className="text-center py-12 text-slate-400">
                   <Database className="h-8 w-8 mx-auto mb-3 opacity-20" />
                   <p className="text-xs uppercase font-black tracking-widest">No placeholders found in template.</p>
                 </td>
               </tr>
             ) : (
               placeholders.map((p) => (
                 <tr key={p.key} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 align-middle">
                      <div className="flex flex-col gap-1">
                         <span className="text-sm font-bold text-slate-800">{p.name || p.key}</span>
                         <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md w-fit font-bold border border-indigo-100 border-dashed">
                           {'{'+'{'} {p.key} {'}'+'}'}
                         </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                       <Badge variant="outline" className="text-[9px] uppercase font-black tracking-wider px-2 border-slate-200 text-slate-600 shadow-sm">{p.type}</Badge>
                    </td>
                    <td className="px-6 py-4 align-middle">
                       <Select value={p.mappedField || 'unmapped'} onValueChange={(val) => onUpdate({ ...p, mappedField: val === 'unmapped' ? undefined : val })}>
                          <SelectTrigger className="w-[240px] h-10 ring-0 border-slate-200 bg-white font-bold text-xs focus:ring-indigo-500 focus:ring-2 rounded-xl relative">
                             <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center">
                                <Link className="h-3 w-3" />
                             </div>
                             <div className="pl-6 pointer-events-none flex items-center justify-start text-left w-full">
                                <SelectValue placeholder="Map to database..." />
                             </div>
                          </SelectTrigger>
                          <SelectContent style={{ zIndex: 99999 }}>
                             <SelectItem value="unmapped" className="text-xs font-bold text-slate-400">No Database Field</SelectItem>
                             {visibleTables.length === 0 && (
                                <div className="p-4 text-center text-[10px] text-slate-400 uppercase font-black tracking-widest">No tables authorized by Super Admin</div>
                             )}
                             {visibleTables.map(([table, fields]) => (
                               <SelectGroup key={table}>
                                 <SelectLabel className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-50/50 py-1.5 mt-1">{table.replace(/_/g, ' ')} Table</SelectLabel>
                                 {(fields as any[]).map(f => (
                                    <SelectItem key={f.value} value={f.value} className="text-xs font-bold px-6">{f.label} <span className="text-[9px] text-slate-400 font-mono ml-2">({f.value})</span></SelectItem>
                                 ))}
                               </SelectGroup>
                             ))}
                          </SelectContent>
                       </Select>
                    </td>
                    <td className="px-6 py-4 align-middle">
                       <Input 
                         value={p.defaultValue || ''} 
                         onChange={(e) => onUpdate({ ...p, defaultValue: e.target.value })}
                         placeholder="Enter default text..."
                         className="h-10 border-slate-200 bg-white text-xs font-bold focus-visible:ring-indigo-500 rounded-xl max-w-[200px] placeholder:text-slate-300"
                       />
                    </td>
                 </tr>
               ))
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
