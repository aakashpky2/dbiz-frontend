'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { Users, Building, ListTodo, FileText, CheckSquare, Settings, LayoutDashboard, Clock } from 'lucide-react';

export function GlobalCommand() {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Ignore if user is typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
                return;
            }

            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const runCommand = React.useCallback(
        (command: () => void) => {
            setOpen(false);
            command();
        },
        []
    );

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Quick Links">
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/work-register/my-tasks'))}>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        <span>My Tasks</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/work/clients'))}>
                        <Building className="mr-2 h-4 w-4" />
                        <span>Clients</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Modules">
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/employee-directory'))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Employee Directory</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/work/proposals'))}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Proposals</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/admin/work-schedules'))}>
                        <ListTodo className="mr-2 h-4 w-4" />
                        <span>Workflows</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/admin/rate-cards'))}>
                        <Clock className="mr-2 h-4 w-4" />
                        <span>Rate Cards</span>
                    </CommandItem>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="System">
                    <CommandItem onSelect={() => runCommand(() => router.push('/dashboard/settings'))}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
