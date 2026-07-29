import re

file_path = r"C:\acoundz\d-biz-app-new\frontend\src\app\dashboard\work-register\my-tasks\[taskId]\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace Accordion import with Tabs import
content = content.replace(
    "import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';",
    "import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';"
)

# Replace the layout
old_return_start = """  return (
    <div className="space-y-6">
      <Button asChild variant="outline">
        <Link href="/dashboard/work-register/my-tasks">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Task List
        </Link>
      </Button>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ── Left Column: Task Details ── */}"""

# We'll replace the main structure. We need to grab everything from 'return (' to the end and rewrite it.
# Actually, replacing the big return block using string manipulation is easier:
old_return_block_start = content.find("  return (\n    <div className=\"space-y-6\">\n      <Button asChild variant=\"outline\">\n        <Link href=\"/dashboard/work-register/my-tasks\">")

if old_return_block_start != -1:
    new_return = """  return (
    <div className="space-y-6 pb-12">
      <Button asChild variant="outline">
        <Link href="/dashboard/work-register/my-tasks">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Task List
        </Link>
      </Button>

      {/* ── Top Full-Width Card: General Task Details ── */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
            <div className="space-y-4 flex-1">
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
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">FLOW WORK</Badge>
                )}
                {task.step_type && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">{task.step_type}</Badge>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">{task.title}</h2>
                <p className="text-blue-600 font-medium text-sm mt-1">{task.workTypeName || 'General Task'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1 w-full mt-4 md:mt-0">
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Client</span>
                <span className="font-medium text-sm text-slate-900">{task.clientName || 'No Client'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Team</span>
                <span className="font-medium text-sm text-slate-900 flex items-center">
                  <User className="h-3 w-3 mr-1 text-slate-400" />
                  {task.assignedTeamName || 'No Team'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Due Date</span>
                <span className="font-medium text-sm text-slate-900 flex items-center">
                  <Clock className="h-3 w-3 mr-1 text-slate-400" />
                  {task.dueDate ? format(new Date(task.dueDate), 'dd MMM yyyy') : 'No Due Date'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs mb-1">Assigned / Claimed By</span>
                <span className="font-medium text-sm text-slate-900">
                  {task.claimedByName || 'Unclaimed'}
                </span>
              </div>
              
              {task.hasFlow && (
                <div className="col-span-2 md:col-span-4 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="font-medium text-slate-700">Workflow Progress ({calculatedProgress.completed}/{calculatedProgress.total})</span>
                    <span className="font-bold text-indigo-600">{calculatedProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 dark:bg-slate-800">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
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
      <Card className="shadow-sm border-slate-200 mt-6">
        <CardHeader className="pb-4 border-b">
          <CardTitle className="text-xl">Execution Steps</CardTitle>
          <CardDescription>Complete the required steps for this task</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {!task.hasFlow || steps.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-100">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900">No Execution Steps</h3>
              <p className="text-sm text-slate-500 mt-1">This task does not have a formal workflow.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ── Common Information Fields Section ── */}
              {commonFields.length > 0 && (
                <div className="border border-blue-200 rounded-lg bg-blue-50/40 overflow-hidden mb-6">
                  <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-blue-800 text-sm">Common Information</span>
                    <span className="text-xs text-blue-500 ml-1">— Required for all steps</span>
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
                    <div className="pt-2 border-t border-blue-100 flex justify-end mt-4">
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
                <TabsList className="flex flex-wrap h-auto p-1 bg-slate-100/80 justify-start overflow-x-auto w-full gap-1 rounded-lg">
                  {steps.map((step: any, index: number) => {
                    const isCompleted = progress?.[step.id]?.status === 'COMPLETED';
                    return (
                      <TabsTrigger
                        key={step.id}
                        value={step.id}
                        className={cn(
                          "py-2.5 px-4 whitespace-nowrap font-medium text-sm transition-all rounded-md flex items-center gap-2",
                          "data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                          isCompleted ? "bg-emerald-500 text-white" : "bg-slate-300 text-slate-700"
                        )}>
                          {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                        </div>
                        Step {index + 1}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <div className="mt-6 border border-slate-100 rounded-xl bg-white shadow-sm overflow-hidden">
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
                              <h3 className={cn('text-lg font-bold', isCompleted ? 'text-emerald-700' : 'text-slate-800')}>
                                {index + 1}. {step.step_name}
                              </h3>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {step.step_type && (
                                  <Badge variant="outline" className="text-[10px] text-slate-500 uppercase">{step.step_type}</Badge>
                                )}
                                {step.is_mandatory && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Mandatory</Badge>
                                )}
                                {step.estimated_time && (
                                  <span className="text-xs text-slate-500 flex items-center bg-slate-100 px-2 py-0.5 rounded-full">
                                    <Clock className="h-3 w-3 mr-1" />{step.estimated_time}
                                  </span>
                                )}
                                {step.video_enabled && rawVideoUrl && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-indigo-50 text-indigo-700 border-indigo-100">
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
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 ml-auto flex-shrink-0 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Completed
                              </Badge>
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
                              <div className="text-sm text-slate-700 bg-slate-50/50 p-4 rounded-md border border-slate-100 leading-relaxed whitespace-pre-wrap">
                                {step.long_description}
                              </div>
                            )}

                            {/* Video */}
                            {step.video_enabled && rawVideoUrl && (
                              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setVideoOpenStepId(videoOpenStepId === step.id ? null : step.id)}
                                  className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-medium"
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
                                <div className="text-xs text-slate-500 pt-1">
                                  <a href={rawVideoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1 inline-flex">
                                    Open in New Tab <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Audio */}
                            {audioEnabled && audioUrl && (
                              <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                                    <Mic className="h-4 w-4 text-purple-600" />
                                    Audio Instruction
                                  </h4>
                                  <a
                                    href={audioUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-indigo-600 hover:underline font-medium inline-flex items-center gap-1"
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
                              <Label className="text-base font-bold text-slate-800">Required Document Uploads / Checks</Label>
                              {docFields.length > 0 ? (
                                <div className="grid gap-3">
                                  {docFields.map((doc: any) => (
                                    <div key={doc.key} className="flex items-start space-x-3 p-3 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors">
                                      <Checkbox
                                        id={`${step.id}-${doc.key}`}
                                        checked={Boolean(stepProgress.checkedDocs?.[doc.key])}
                                        onCheckedChange={(checked) =>
                                          handleStepStateChange(step.id, 'checkedDocs', { [doc.key]: Boolean(checked) })
                                        }
                                        disabled={isCompleted}
                                        className="mt-1 h-5 w-5 rounded data-[state=checked]:bg-indigo-600 data-[state=checked]:text-primary-foreground"
                                      />
                                      <div className="flex flex-col">
                                        <Label
                                          htmlFor={`${step.id}-${doc.key}`}
                                          className="font-semibold text-sm cursor-pointer text-slate-700 leading-snug"
                                        >
                                          {doc.label}
                                          {doc.required && <span className="text-red-500 ml-1">*</span>}
                                          {doc.maxSizeMB && (
                                            <span className="text-xs text-slate-400 font-normal ml-2">(Max {doc.maxSizeMB}MB)</span>
                                          )}
                                        </Label>
                                        {doc.helpText && (
                                          <span className="text-xs text-slate-500 mt-1">{doc.helpText}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-md border border-slate-100">No document checks configured for this step.</p>
                              )}
                            </div>

                            {/* Custom Fields */}
                            {customFieldsList.length > 0 && (
                              <div className="space-y-3 pt-2">
                                <Label className="text-base font-bold text-slate-800">Custom Fields</Label>
                                <div className="grid gap-4 border border-slate-200 rounded-lg p-4 bg-white">
                                  {customFieldsList.map((field: any) => (
                                    <div key={field.key} className="space-y-1.5">
                                      <Label className="text-sm font-semibold text-slate-700">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                      </Label>
                                      {renderField(
                                        field,
                                        stepProgress.customFieldValues?.[field.key] || '',
                                        (val: any) => handleStepStateChange(step.id, 'customFieldValues', { [field.key]: val }),
                                        isCompleted
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Remarks */}
                            <div className="space-y-3 pt-2">
                              <Label htmlFor={`remarks-${step.id}`} className="text-base font-bold text-slate-800">
                                Remarks / Output
                              </Label>
                              <Textarea
                                id={`remarks-${step.id}`}
                                placeholder="Add execution notes..."
                                value={stepProgress.remarks || ''}
                                onChange={(e) => handleStepStateChange(step.id, 'remarks', e.target.value)}
                                disabled={isCompleted}
                                className="min-h-[120px] resize-y bg-white border-slate-300 focus:border-indigo-500"
                              />
                            </div>

                            {/* Step Actions */}
                            {!isCompleted && (
                              <div className="flex gap-3 pt-4 mt-6 border-t border-slate-200">
                                <Button
                                  onClick={() => handleSaveProgress(step.id, false)}
                                  variant="outline"
                                  disabled={isSaving}
                                  className="border-slate-300 font-medium"
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
        <CardFooter className="bg-slate-50 border-t border-slate-200 mt-6 py-5 px-6 rounded-b-xl flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm font-medium text-slate-500">Task Actions</p>
          <div className="flex gap-3 flex-wrap justify-center">
            {(task.status === 'ASSIGNED' || task.status === 'CLAIMED' || task.status === 'AVAILABLE') && (
              <Button
                onClick={handleStartWork}
                disabled={isSaving}
                variant="outline"
                className="border-indigo-600 text-indigo-700 hover:bg-indigo-50 font-bold"
              >
                Start Work
              </Button>
            )}

            {task.status === 'IN_PROGRESS' && (
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
                  className="border-blue-600 text-blue-700 hover:bg-blue-50 font-bold"
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
      <div className="mt-8 flex justify-end">
        <div className="w-full md:w-1/2 lg:w-1/3">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
              <MetadataPanel 
                createdBy={task.created_by_name || (task.created_by ? "System User" : undefined)}
                createdOn={task.created_at ? format(new Date(task.created_at), 'dd MMM yyyy, p') : undefined}
                updatedBy={task.updated_by_name || (task.updated_by ? "System User" : undefined)}
                updatedOn={task.updated_at ? format(new Date(task.updated_at), 'dd MMM yyyy, p') : undefined}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
"""

    new_content = content[:old_return_block_start] + new_return
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully replaced layout in page.tsx")
else:
    print("Could not find the return block start")
