"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Calendar as CalendarIcon, Check, ChevronsUpDown, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

const addTaskSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title cannot exceed 100 characters."),
    description: z.string().max(500, "Description cannot exceed 500 characters.").optional(),
    priority: z.enum(["Low", "Medium", "High"]),
    dueDate: z.date({ required_error: "Due date is required" }),
    clientId: z.string().optional(),
    workTypeId: z.string().optional(),
    assignedTo: z.array(z.string()).min(1, "Assign at least one user"),
});

type AddTaskFormValues = z.infer<typeof addTaskSchema>;

interface Client {
    id: string;
    clientName: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

export function AddTaskDialog({ onTaskAdded }: { onTaskAdded?: () => void }) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [workTypes, setWorkTypes] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [loadingConfig, setLoadingConfig] = useState(true);

    const { user } = useAuth();
    const { toast } = useToast();

    const form = useForm<AddTaskFormValues>({
        resolver: zodResolver(addTaskSchema),
        defaultValues: {
            title: "",
            description: "",
            priority: "Medium",
            assignedTo: user ? [user.uid] : [], // Default to self
        },
    });

    // Fetch Clients and Users
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Fetch Clients
                const clientsRes = await fetch('/api/clients');
                if (clientsRes.ok) {
                    const response = await clientsRes.json();
                    console.log("[AddTask] clients response", response);
                    const list = Array.isArray(response) ? response : (response?.data || []);
                    setClients(list.map((c: any) => ({
                        id: c.id,
                        clientName: c.client_name
                    })));
                }

                // Fetch Employees (Users)
                const empRes = await fetch('/api/employees');
                if (empRes.ok) {
                    const response = await empRes.json();
                    console.log("[AddTask] employees response", response);
                    const list = Array.isArray(response) ? response : (response?.data || response?.employees || []);
                    setUsers(list.map((e: any) => ({
                        id: e.id,
                        name: (e.personalDetails?.fullName || e.full_name || 'Unknown'),
                        email: (e.personalDetails?.email || e.email || '')
                    })));
                }

                // Fetch Work Types
                const wtRes = await fetch('/api/work-types');
                if (wtRes.ok) {
                    const response = await wtRes.json();
                    const list = Array.isArray(response) ? response : (response?.data || []);
                    setWorkTypes(list);
                }

                // Fetch Workflow Templates to check for active templates
                const tmplRes = await fetch('/api/workflow-templates');
                if (tmplRes.ok) {
                    const response = await tmplRes.json();
                    const list = Array.isArray(response) ? response : (response?.data || []);
                    setTemplates(list);
                }

            } catch (error) {
                console.error("Error fetching config:", error);
            } finally {
                setLoadingConfig(false);
            }
        };

        if (open) {
            fetchConfig();
        }
    }, [open]);

    const onSubmit = async (data: AddTaskFormValues) => {
        if (!user) {
            toast({ title: "Error", description: "You must be logged in to add a task.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const clientName = clients.find(c => c.id === data.clientId)?.clientName || "";

            const payload = {
                ...data,
                dueDate: format(data.dueDate, "yyyy-MM-dd"),
                status: "AVAILABLE",
                createdBy: user.uid,
                clientName: clientName,
            };

            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to create task');

            toast({ title: "Task Added", description: `Task assigned to ${data.assignedTo.length} user(s).` });
            setOpen(false);
            form.reset({
                title: "",
                description: "",
                priority: "Medium",
                assignedTo: [user.uid],
                clientId: undefined,
                workTypeId: undefined
            });
            if (onTaskAdded) onTaskAdded();
        } catch (error) {
            console.error("Error adding task:", error);
            toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Adding New Task</DialogTitle>
                    <DialogDescription>
                        Enter the details for Task.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Input placeholder="Task title" {...field} maxLength={100} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="clientId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Client</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "w-full justify-between",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value
                                                            ? clients.find(
                                                                (client) => client.id === field.value
                                                            )?.clientName
                                                            : "Select client"}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search client..." />
                                                    <CommandList>
                                                        <CommandEmpty>No client found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {clients.map((client) => (
                                                                <CommandItem
                                                                    value={client.clientName}
                                                                    key={client.id}
                                                                    onSelect={() => {
                                                                        form.setValue("clientId", client.id);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            client.id === field.value
                                                                                ? "opacity-100"
                                                                                : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {client.clientName}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="workTypeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Work Type</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "w-full justify-between",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value
                                                            ? workTypes.find((wt) => wt.id === field.value)?.name
                                                            : "Select work type"}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search work type..." />
                                                    <CommandList>
                                                        <CommandEmpty>No work type found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {workTypes.map((wt) => (
                                                                <CommandItem
                                                                    value={wt.name}
                                                                    key={wt.id}
                                                                    onSelect={() => {
                                                                        form.setValue("workTypeId", wt.id);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            wt.id === field.value ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {wt.name}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {field.value && !templates.find(t => t.work_type_id === field.value && t.is_active) && (
                                            <p className="text-[10px] text-amber-600 mt-1 flex items-center">
                                                <AlertCircle className="h-3 w-3 mr-1" /> No active workflow template found. Task will be created without flow.
                                            </p>
                                        )}
                                        {field.value && (workTypes.find((wt) => wt.id === field.value)?.warningNote || workTypes.find((wt) => wt.id === field.value)?.warning_note) && (
                                            <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                                                ⚠️ Note: {workTypes.find((wt) => wt.id === field.value)?.warningNote || workTypes.find((wt) => wt.id === field.value)?.warning_note}
                                            </p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select priority" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Low">Low</SelectItem>
                                                <SelectItem value="Medium">Medium</SelectItem>
                                                <SelectItem value="High">High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="assignedTo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assign To <span className="text-destructive">*</span></FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-start text-left font-normal h-auto min-h-10 py-2"
                                            >
                                                <div className="flex flex-wrap gap-1">
                                                    {field.value?.length > 0 ? (
                                                        field.value.map((userId) => (
                                                            <Badge key={userId} variant="secondary" className="mr-1 mb-1">
                                                                {users.find(u => u.id === userId)?.name || "Unknown"}
                                                                <X
                                                                    className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newValue = field.value.filter((v) => v !== userId);
                                                                        field.onChange(newValue);
                                                                    }}
                                                                />
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <span className="text-muted-foreground">Select team members</span>
                                                    )}
                                                </div>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search users..." />
                                                <CommandList>
                                                    <CommandEmpty>No user found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {users.map((u) => (
                                                            <CommandItem
                                                                key={u.id}
                                                                value={u.name}
                                                                onSelect={() => {
                                                                    const current = field.value || [];
                                                                    if (!current.includes(u.id)) {
                                                                        field.onChange([...current, u.id]);
                                                                    }
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        field.value?.includes(u.id)
                                                                            ? "opacity-100"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                {u.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Task details (optional)" {...field} maxLength={500} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Due Date <span className="text-destructive">*</span></FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Task
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
