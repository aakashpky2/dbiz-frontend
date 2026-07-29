import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, min: minProp, max: maxProp, onKeyDown, ...props }, ref) => {
    const min = type === "number" && minProp === undefined ? 0 : (type === "date" && minProp === undefined ? "1900-01-01" : minProp);
    const max = type === "date" && maxProp === undefined ? "9999-12-31" : maxProp;
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const form = e.currentTarget.form;
        if (form) {
          e.preventDefault();
          const elements = Array.from(form.elements) as HTMLElement[];
          const currentIndex = elements.indexOf(e.currentTarget);
          
          if (currentIndex > -1) {
            let nextElement: HTMLElement | null = null;
            for (let i = currentIndex + 1; i < elements.length; i++) {
              const el = elements[i];
              if (!el.hasAttribute("disabled") && el.tabIndex >= 0 && el.tagName !== "FIELDSET" && el.tagName !== "OUTPUT") {
                nextElement = el;
                break;
              }
            }
            if (nextElement) {
              nextElement.focus();
              // Optionally select the text if it's an input
              if (nextElement.tagName === "INPUT") {
                const inputTypesToSelect = ["text", "number", "email", "password", "tel", "url"];
                if (inputTypesToSelect.includes((nextElement as HTMLInputElement).type)) {
                  (nextElement as HTMLInputElement).select();
                }
              }
            } else {
              // If we reached the end of the form, submit the form safely
              form.requestSubmit();
            }
          }
        }
      }
      onKeyDown?.(e);
    };

    return (
      <input
        type={type}
        min={min}
        max={max}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
        suppressHydrationWarning
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
