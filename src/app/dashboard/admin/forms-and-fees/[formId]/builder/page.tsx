'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, GripVertical, Settings2, Trash2, Copy, ArrowUp, ArrowDown, LayoutTemplate, PlusCircle, Check, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { PageSkeleton } from '@/components/ui/page-skeleton';

// Types
type FieldType = 'text' | 'number' | 'email' | 'phone' | 'date' | 'textarea' | 'dropdown' | 'radio' | 'checkbox' | 'file' | 'divider';

interface FormField {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    name: string;
    required?: boolean;
    defaultValue?: string;
    helpText?: string;
    options?: string[];
}

interface FormSection {
    id: string;
    sectionTitle: string;
    description?: string;
    fields: FormField[];
}

const FIELD_COMPONENTS: { type: FieldType | 'section'; label: string; icon: React.ReactNode }[] = [
    { type: 'section', label: 'Section', icon: <span className="font-mono border px-1 text-xs">Sec</span> },
    { type: 'text', label: 'Text Input', icon: <span className="font-mono border px-1 text-xs">Abc</span> },
    { type: 'number', label: 'Number Input', icon: <span className="font-mono border px-1 text-xs">123</span> },
    { type: 'email', label: 'Email Input', icon: <span className="font-mono border px-1 text-xs">@</span> },
    { type: 'phone', label: 'Phone Input', icon: <span className="font-mono border px-1 text-xs">📞</span> },
    { type: 'date', label: 'Date Picker', icon: <span className="font-mono border px-1 text-xs">📅</span> },
    { type: 'textarea', label: 'Textarea', icon: <span className="font-mono border px-1 text-xs">☰</span> },
    { type: 'dropdown', label: 'Dropdown', icon: <span className="font-mono border px-1 text-xs">▼</span> },
    { type: 'radio', label: 'Radio Buttons', icon: <span className="font-mono border px-1 text-xs">◉</span> },
    { type: 'checkbox', label: 'Checkbox', icon: <span className="font-mono border px-1 text-xs">☑</span> },
    { type: 'file', label: 'File Upload', icon: <span className="font-mono border px-1 text-xs">📁</span> },
];

export default function FormBuilderPage() {
    const params = useParams();
    const formId = params?.formId as string;
    const router = useRouter();
    const { toast } = useToast();

    const [formDetails, setFormDetails] = useState<any>(null);
    const [sections, setSections] = useState<FormSection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

    const [previewMode, setPreviewMode] = useState(false);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchForm();
    }, [formId]);

    const fetchForm = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('forms').select('*').eq('id', formId).single();
            if (error) throw error;
            setFormDetails(data);
            if (data.form_schema && typeof data.form_schema === 'object' && !Array.isArray(data.form_schema)) {
                setSections(data.form_schema.sections || []);
            } else {
                setSections([{ id: uuidv4(), sectionTitle: 'Main Section', fields: [] }]);
            }
        } catch (error: any) {
            toast({ title: 'Error', description: 'Failed to load form details.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const fullSchema = {
                formName: formDetails?.name,
                description: formDetails?.description,
                sections: sections
            };
            const { error } = await supabase.from('forms').update({ form_schema: fullSchema }).eq('id', formId);
            if (error) throw error;
            toast({ title: 'Form Structure Saved!' });
            router.push('/dashboard/admin/forms-and-fees');
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const createNewField = (type: FieldType): FormField => {
        const id = uuidv4();
        const baseName = `field_${id.substring(0, 6)}`;
        return {
            id, type, label: `New ${type} field`, name: baseName, required: false,
            options: ['dropdown', 'radio', 'checkbox'].includes(type) ? ['Option 1', 'Option 2'] : undefined
        };
    };

    const findContainer = (id: string) => {
        if (sections.find(s => s.id === id)) return id;
        for (const s of sections) {
            if (s.fields.find(f => f.id === id)) return s.id;
        }
        return null;
    };

    const handleDragStart = (event: any) => {
        setActiveDragId(event.active.id);
    };

    const handleDragOver = (event: any) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        if (activeId.startsWith('sidebar-') || sections.some(s => s.id === activeId)) {
            // Sections or sidebar items handle sorting in DragEnd
            return;
        }

        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(overId);

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return;
        }

        setSections((prev) => {
            const activeSecIndex = prev.findIndex(s => s.id === activeContainer);
            const overSecIndex = prev.findIndex(s => s.id === overContainer);

            const activeItems = [...prev[activeSecIndex].fields];
            const overItems = [...prev[overSecIndex].fields];

            const activeItemIndex = activeItems.findIndex(f => f.id === activeId);
            const activeItem = activeItems[activeItemIndex];

            activeItems.splice(activeItemIndex, 1);

            let overItemIndex = overItems.findIndex(f => f.id === overId);
            if (overItemIndex === -1) {
                overItems.push(activeItem);
            } else {
                overItems.splice(overItemIndex, 0, activeItem);
            }

            const next = [...prev];
            next[activeSecIndex] = { ...prev[activeSecIndex], fields: activeItems };
            next[overSecIndex] = { ...prev[overSecIndex], fields: overItems };
            return next;
        });
    };

    const handleDragEnd = (event: any) => {
        setActiveDragId(null);
        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);
        const isFromSidebar = activeId.startsWith('sidebar-');

        if (isFromSidebar) {
            const itemType = activeId.replace('sidebar-', '');
            if (itemType === 'section') {
                const newSection: FormSection = { id: uuidv4(), sectionTitle: 'New Section', fields: [] };
                setSections(prev => {
                    const next = [...prev];
                    const overIndex = next.findIndex(s => s.id === overId);
                    if (overIndex >= 0) next.splice(overIndex + 1, 0, newSection);
                    else next.push(newSection);
                    return next;
                });
                setActiveSectionId(newSection.id);
                setActiveFieldId(null);
            } else {
                const newField = createNewField(itemType as FieldType);
                let targetSection = findContainer(overId);

                if (!targetSection) {
                    if (sections.length > 0) targetSection = sections[sections.length - 1].id;
                    else {
                        const newSec = { id: uuidv4(), sectionTitle: 'Main Section', fields: [] };
                        setSections([newSec]);
                        targetSection = newSec.id;
                    }
                }

                setSections(prev => {
                    const secIdx = prev.findIndex(s => s.id === targetSection);
                    const next = [...prev];
                    const items = [...next[secIdx].fields];
                    const overIdx = items.findIndex(f => f.id === overId);
                    if (overIdx >= 0) items.splice(overIdx + 1, 0, newField);
                    else items.push(newField);
                    next[secIdx] = { ...next[secIdx], fields: items };
                    return next;
                });
                setActiveFieldId(newField.id);
                setActiveSectionId(null);
            }
            return;
        }

        const activeContainer = findContainer(activeId);
        const overContainer = findContainer(overId);

        if (!activeContainer || !overContainer) return;

        // Reordering Sections
        if (sections.some(s => s.id === activeId)) {
            if (activeId !== overId) {
                setSections(items => {
                    const oldIdx = items.findIndex(s => s.id === activeId);
                    const newIdx = items.findIndex(s => s.id === overId);
                    return arrayMove(items, oldIdx, newIdx);
                });
            }
            return;
        }

        // Reordering Fields in same container
        if (activeContainer === overContainer && activeId !== overId) {
            setSections(prev => {
                const idx = prev.findIndex(s => s.id === activeContainer);
                const next = [...prev];
                const items = [...next[idx].fields];
                const oldIdx = items.findIndex(f => f.id === activeId);
                const newIdx = items.findIndex(f => f.id === overId);
                next[idx] = { ...next[idx], fields: arrayMove(items, oldIdx, newIdx) };
                return next;
            });
        }
    };

    const deleteSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSections(prev => prev.filter(s => s.id !== id));
        if (activeSectionId === id) setActiveSectionId(null);
    };

    const deleteField = (sectionId: string, fieldId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSections(prev => prev.map(s => s.id === sectionId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s));
        if (activeFieldId === fieldId) setActiveFieldId(null);
    };

    const duplicateField = (sectionId: string, field: FormField, e: React.MouseEvent) => {
        e.stopPropagation();
        const newField = { ...field, id: uuidv4(), name: `${field.name}_copy` };
        setSections(prev => prev.map(s => {
            if (s.id !== sectionId) return s;
            const items = [...s.fields];
            const idx = items.findIndex(f => f.id === field.id);
            items.splice(idx + 1, 0, newField);
            return { ...s, fields: items };
        }));
        setActiveFieldId(newField.id);
        setActiveSectionId(null);
    };

    const updateActiveSection = (updates: Partial<FormSection>) => {
        if (!activeSectionId) return;
        setSections(prev => prev.map(s => s.id === activeSectionId ? { ...s, ...updates } : s));
    };

    const updateActiveField = (updates: Partial<FormField>) => {
        if (!activeFieldId) return;
        setSections(prev => prev.map(s => ({
            ...s, fields: s.fields.map(f => f.id === activeFieldId ? { ...f, ...updates } : f)
        })));
    };

    // Derived active items for settings panel
    const activeSection = sections.find(s => s.id === activeSectionId);
    let activeField: FormField | undefined;
    sections.forEach(s => { const f = s.fields.find(f => f.id === activeFieldId); if (f) activeField = f; });

    if (isLoading) return <div className="p-6"><PageSkeleton /></div>;

    const renderPreviewField = (field: FormField) => {
        switch (field.type) {
            case 'text': return <Input placeholder={field.placeholder} disabled />;
            case 'number': return <Input type="number" placeholder={field.placeholder} disabled />;
            case 'email': return <Input type="email" placeholder={field.placeholder} disabled />;
            case 'phone': return <Input type="tel" placeholder={field.placeholder} disabled />;
            case 'date': return <Input type="date" disabled />;
            case 'textarea': return <Textarea placeholder={field.placeholder} disabled />;
            case 'dropdown':
                return (
                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" disabled>
                        <option>Select an option</option>
                        {field.options?.map((opt, i) => <option key={i}>{opt}</option>)}
                    </select>
                );
            case 'radio':
            case 'checkbox':
                return (
                    <div className="space-y-2">
                        {field.options?.map((opt, i) => (
                            <div key={i} className="flex items-center space-x-2">
                                <input type={field.type} disabled id={`${field.id}-${i}`} />
                                <Label htmlFor={`${field.id}-${i}`}>{opt}</Label>
                            </div>
                        ))}
                    </div>
                );
            case 'file': return <Input type="file" disabled />;
            case 'divider': return <hr className="my-6 border-border" />;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-h-full">
            <div className="flex items-center justify-between p-4 border-b bg-card">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2"><LayoutTemplate /> {formDetails?.name || 'Form Builder'}</h1>
                    <p className="text-sm text-muted-foreground">{formDetails?.description}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPreviewMode(!previewMode)}>
                        {previewMode ? <Settings2 className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                        {previewMode ? 'Edit Mode' : 'Preview'}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />} Save Form Structure
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                    {/* LEFT PANEL */}
                    {!previewMode && (
                        <div className="w-64 border-r bg-muted/20 p-4 flex flex-col gap-2 overflow-y-auto">
                            <h3 className="font-semibold text-sm mb-2 text-muted-foreground">Form Components</h3>
                            {FIELD_COMPONENTS.map((ft) => (
                                <SidebarDraggable key={ft.type} type={ft.type} label={ft.label} icon={ft.icon} />
                            ))}
                        </div>
                    )}

                    {/* CENTER PANEL */}
                    <div className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-8">
                        <div className="max-w-3xl mx-auto">
                            {previewMode ? (
                                <Card className="shadow-lg border-primary/20 bg-card">
                                    <CardHeader className="border-b bg-muted/30">
                                        <CardTitle className="text-2xl">{formDetails?.name}</CardTitle>
                                        {formDetails?.description && <CardDescription>{formDetails.description}</CardDescription>}
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {sections.length === 0 ? <p className="p-8 text-center text-muted-foreground">No sections added.</p> : (
                                            sections.map(section => (
                                                <div key={section.id} className="border-b last:border-0 p-6">
                                                    <h3 className="text-xl font-bold mb-1">{section.sectionTitle}</h3>
                                                    {section.description && <p className="text-sm text-muted-foreground mb-6">{section.description}</p>}
                                                    <div className="space-y-6">
                                                        {section.fields.map(field => (
                                                            <div key={field.id} className="space-y-1.5">
                                                                {field.type !== 'divider' && (
                                                                    <Label className="text-base">
                                                                        {field.label} {field.required && <span className="text-destructive">*</span>}
                                                                    </Label>
                                                                )}
                                                                {renderPreviewField(field)}
                                                                {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                    <CardFooter className="bg-muted/10 p-4 justify-end"><Button disabled>Submit</Button></CardFooter>
                                </Card>
                            ) : (
                                <DroppableCanvas id="canvas-droppable">
                                    <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-6 min-h-[400px] pb-32">
                                            {sections.length === 0 ? (
                                                <div className="h-64 border-2 border-dashed rounded-xl flex items-center justify-center flex-col text-muted-foreground bg-card">
                                                    <LayoutTemplate className="w-12 h-12 mb-4 opacity-50" />
                                                    <p>Drag a Section here to start building</p>
                                                </div>
                                            ) : (
                                                sections.map(section => (
                                                    <SortableSectionItem
                                                        key={section.id}
                                                        section={section}
                                                        isActive={activeSectionId === section.id}
                                                        onClick={() => { setActiveSectionId(section.id); setActiveFieldId(null); }}
                                                        onDelete={(e: any) => deleteSection(section.id, e)}
                                                    >
                                                        <SortableContext items={section.fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                                            <div className="min-h-[60px] p-2 space-y-2 rounded-lg bg-muted/10 border border-dashed border-border/50">
                                                                {section.fields.length === 0 ? (
                                                                    <div className="py-4 text-center text-sm text-muted-foreground italic">Drag fields here</div>
                                                                ) : (
                                                                    section.fields.map((field) => (
                                                                        <SortableFieldItem
                                                                            key={field.id}
                                                                            field={field}
                                                                            isActive={activeFieldId === field.id}
                                                                            onClick={(e: any) => { e.stopPropagation(); setActiveFieldId(field.id); setActiveSectionId(null); }}
                                                                            onDelete={(e: any) => deleteField(section.id, field.id, e)}
                                                                            onDuplicate={(e: any) => duplicateField(section.id, field, e)}
                                                                        />
                                                                    ))
                                                                )}
                                                            </div>
                                                        </SortableContext>
                                                    </SortableSectionItem>
                                                ))
                                            )}
                                        </div>
                                    </SortableContext>
                                </DroppableCanvas>
                            )}
                        </div>
                    </div>

                    <DragOverlay>
                        {activeDragId && (
                            <div className="border border-primary bg-background shadow-xl p-3 rounded-md flex items-center gap-2 opacity-80 cursor-grabbing w-full max-w-sm">
                                <GripVertical className="opacity-50" />
                                {String(activeDragId).startsWith('sidebar-') ? String(activeDragId).replace('sidebar-', '') : 'Dragging item...'}
                            </div>
                        )}
                    </DragOverlay>

                    {/* RIGHT PANEL - SETTINGS */}
                    {!previewMode && (
                        <div className="w-80 border-l bg-card flex flex-col">
                            <div className="p-4 border-b flex items-center gap-2">
                                <Settings2 className="w-5 h-5" />
                                <h3 className="font-bold">Settings</h3>
                            </div>
                            <div className="p-4 overflow-y-auto flex-1 h-0 space-y-6">
                                {activeSection && (
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-primary mb-2">Section Properties</h4>
                                        <div className="space-y-1"><Label>Section Title</Label><Input value={activeSection.sectionTitle} onChange={(e) => updateActiveSection({ sectionTitle: e.target.value })} /></div>
                                        <div className="space-y-1"><Label>Description</Label><Textarea value={activeSection.description || ''} onChange={(e) => updateActiveSection({ description: e.target.value })} rows={2} /></div>
                                    </div>
                                )}

                                {activeField && (
                                    <div className="space-y-4 pt-4 border-t">
                                        <h4 className="font-semibold text-primary mb-2">Field Properties</h4>
                                        <div className="space-y-1"><Label>Field Label</Label><Input value={activeField.label} onChange={(e) => updateActiveField({ label: e.target.value })} /></div>
                                        {activeField.type !== 'divider' && (
                                            <>
                                                <div className="space-y-1">
                                                    <Label>System Key (Name)</Label>
                                                    <Input value={activeField.name} onChange={(e) => updateActiveField({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })} />
                                                </div>
                                                <div className="space-y-1"><Label>Placeholder</Label><Input value={activeField.placeholder || ''} onChange={(e) => updateActiveField({ placeholder: e.target.value })} /></div>
                                                <div className="space-y-1"><Label>Help Text</Label><Textarea value={activeField.helpText || ''} onChange={(e) => updateActiveField({ helpText: e.target.value })} rows={2} /></div>
                                                <div className="flex items-center justify-between pt-2"><Label>Required Field</Label><Switch checked={activeField.required || false} onCheckedChange={(c) => updateActiveField({ required: c })} /></div>
                                            </>
                                        )}
                                        {['dropdown', 'radio', 'checkbox'].includes(activeField.type) && (
                                            <div className="space-y-2 pt-4 border-t">
                                                <Label className="flex justify-between items-center">Options
                                                    <Button variant="ghost" size="sm" onClick={() => updateActiveField({ options: [...(activeField!.options || []), `Option ${(activeField!.options?.length || 0) + 1}`] })} className="h-6 px-2 text-xs"><PlusCircle className="w-3 h-3 mr-1" /> Add</Button>
                                                </Label>
                                                <div className="space-y-2">
                                                    {activeField.options?.map((opt, i) => (
                                                        <div key={i} className="flex gap-2 items-center">
                                                            <Input value={opt} onChange={(e) => { const n = [...activeField!.options!]; n[i] = e.target.value; updateActiveField({ options: n }) }} className="h-8" />
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { const n = [...activeField!.options!]; n.splice(i, 1); updateActiveField({ options: n }) }}><Trash2 className="w-4 h-4" /></Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!activeSection && !activeField && (
                                    <div className="text-center text-muted-foreground py-10">
                                        <Settings2 className="w-10 h-10 mx-auto opacity-20 mb-2" />
                                        <p>Select a section or field on the canvas to edit its settings.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DndContext>
            </div>
        </div>
    );
}

// Subcomponents

function SidebarDraggable({ type, label, icon }: any) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `sidebar-${type}`, data: { type } });
    return (
        <div ref={setNodeRef} {...listeners} {...attributes} className={`flex items-center gap-3 p-3 bg-background border rounded-lg shadow-sm cursor-grab hover:border-primary/50 transition-colors ${isDragging ? 'opacity-50' : ''}`}>
            <div className="text-muted-foreground">{icon}</div><span className="text-sm font-medium">{label}</span>
        </div>
    );
}

function DroppableCanvas({ id, children }: { id: string; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return <div ref={setNodeRef} className={`min-h-full transition-colors ${isOver ? 'bg-primary/5 rounded-xl border border-primary/20 p-2 -m-2' : ''}`}>{children}</div>;
}

function SortableSectionItem({ section, isActive, onClick, onDelete, children }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} onClick={onClick} className={`relative bg-background border-2 rounded-xl overflow-hidden shadow-sm transition-all pb-2 ${isActive ? 'border-primary ring-1 ring-primary/50' : 'hover:border-primary/40 text-foreground'} ${isDragging ? 'opacity-50 scale-[0.99] z-50' : ''}`}>
            <div className="flex items-center justify-between bg-muted/30 border-b p-3 cursor-pointer">
                <div className="flex items-center gap-3">
                    <div {...attributes} {...listeners} className="cursor-grab hover:text-primary"><GripVertical className="h-5 w-5 text-muted-foreground" /></div>
                    <div>
                        <h4 className="font-bold text-lg">{section.sectionTitle}</h4>
                        {section.description && <p className="text-xs text-muted-foreground">{section.description}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: isActive ? 1 : undefined }} onClick={onDelete}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </div>
            <div className="p-4" onClick={(e) => { e.stopPropagation(); onClick(); }}>
                {children}
            </div>
        </div>
    );
}

function SortableFieldItem({ field, isActive, onClick, onDelete, onDuplicate }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} onClick={onClick} className={`relative group bg-background border rounded-lg overflow-hidden shadow-sm transition-all ${isActive ? 'ring-2 ring-primary border-transparent' : 'hover:border-primary/40'} ${isDragging ? 'opacity-40 scale-[0.98] z-50' : ''}`}>
            <div className="absolute top-0 left-0 bottom-0 w-8 bg-muted/40 border-r flex flex-col items-center justify-center cursor-grab hover:bg-muted/60 transition-colors" {...attributes} {...listeners}>
                <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="pl-12 p-3 pr-24 border-l-4 border-transparent">
                <div className="mb-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">{field.type}</div>
                <div className="font-medium text-sm text-foreground">{field.label} {field.required && <span className="text-destructive">*</span>}</div>
            </div>
            <div className={`absolute top-1/2 -translate-y-1/2 right-2 flex items-center bg-background border rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? '!opacity-100' : ''}`}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" onClick={onDuplicate}><Copy className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
        </div>
    );
}
