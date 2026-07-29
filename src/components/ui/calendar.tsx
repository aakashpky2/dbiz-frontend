"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 p-3",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center h-10 mb-2",
        caption_label: "hidden",
        caption_dropdowns: "flex justify-center items-center gap-2 z-20",
        nav: "flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-8 w-8 bg-transparent p-0 opacity-80 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex justify-between",
        head_cell: "text-slate-500 w-9 font-bold text-[0.7rem] uppercase tracking-widest text-center py-2",
        row: "flex w-full mt-0.5 justify-between",
        cell: cn(
          "h-9 w-9 text-center text-sm p-0 relative transition-all duration-200 focus-within:relative focus-within:z-20"
        ),
        day: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-9 w-9 p-0 font-medium aria-selected:opacity-100 rounded-lg transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white",
          "shadow-md shadow-indigo-500/30 font-bold !rounded-lg"
        ),
        day_today: "bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-indigo-500 after:rounded-full",
        day_outside: "day-outside text-slate-300 dark:text-slate-600 opacity-40 aria-selected:bg-indigo-600/10 aria-selected:text-slate-400 font-normal",
        day_disabled: "text-slate-200 dark:text-slate-700 opacity-50",
        day_range_middle: "aria-selected:bg-slate-50 aria-selected:text-slate-900 dark:aria-selected:bg-slate-900/50 dark:aria-selected:text-slate-100",
        day_hidden: "invisible",
        vhidden: "sr-only",
        dropdown_month: "h-8 px-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer hover:bg-slate-50 transition-all",
        dropdown_year: "h-8 px-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer hover:bg-slate-50 transition-all",
        dropdown: "relative inline-flex items-center",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4 text-slate-500", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4 text-slate-500", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
