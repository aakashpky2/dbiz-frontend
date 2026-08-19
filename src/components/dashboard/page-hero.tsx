import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PageHeroPattern =
  | "pattern-1"
  | "pattern-2"
  | "pattern-3"
  | "pattern-4"
  | "pattern-5"
  | "pattern-6"
  | "pattern-7"
  | "default"
  | "geometric"
  | "grid"
  | "dots"
  | "waves"
  | "nodes";

export interface PageHeroProps {
  icon?: LucideIcon;
  badge?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  compact?: boolean;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
  pattern?: PageHeroPattern;
}

const renderPattern = (pattern: PageHeroPattern) => {
  // Map aliases to 7 primary patterns
  const resolvedPattern: string = (() => {
    switch (pattern) {
      case 'geometric': return 'pattern-1';
      case 'grid': return 'pattern-5';
      case 'dots': return 'pattern-3';
      case 'waves': return 'pattern-7';
      case 'nodes': return 'pattern-2';
      case 'default': return 'pattern-1';
      default: return pattern;
    }
  })();

  const getPatternStyles = (p: string): React.CSSProperties => {
    switch (p) {
      case 'pattern-1': // Diagonal repeating geometric
        return {
          backgroundImage: `linear-gradient(45deg, hsl(var(--primary) / 0.09) 25%, transparent 25%, transparent 50%, hsl(var(--primary) / 0.09) 50%, hsl(var(--primary) / 0.14) 75%, transparent 75%, transparent)`,
          backgroundSize: '32px 32px',
        };

      case 'pattern-2': // Angular geometric multi-layer
        return {
          backgroundImage: `
            linear-gradient(45deg, hsl(var(--primary) / 0.08) 25%, transparent 25%),
            linear-gradient(-45deg, hsl(var(--primary) / 0.08) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, hsl(var(--primary) / 0.08) 75%),
            linear-gradient(-45deg, transparent 75%, hsl(var(--primary) / 0.08) 75%)
          `,
          backgroundSize: '64px 64px',
          backgroundPosition: '0 0, 0 32px, 32px -32px, -32px 0px',
        };

      case 'pattern-3': // Dense radial + angular geometric
        return {
          backgroundImage: `
            radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.13) 2px, transparent 2.5px),
            linear-gradient(150deg, hsl(var(--primary) / 0.07) 25%, transparent 25%),
            linear-gradient(30deg, hsl(var(--primary) / 0.07) 25%, transparent 25%),
            linear-gradient(90deg, hsl(var(--primary) / 0.05) 50%, transparent 50%)
          `,
          backgroundSize: '40px 60px, 40px 60px, 40px 60px, 40px 60px',
        };

      case 'pattern-4': // Repeating radial pattern
        return {
          backgroundImage: `
            repeating-radial-gradient(circle at 0 0, transparent 0, hsl(var(--primary) / 0.085) 15px, transparent 30px),
            repeating-linear-gradient(45deg, hsl(var(--primary) / 0.055) 0, hsl(var(--primary) / 0.055) 10px, transparent 10px, transparent 20px)
          `,
          backgroundSize: '60px 60px, 40px 40px',
        };

      case 'pattern-5': // Technical circular / grid pattern
        return {
          backgroundImage: `
            radial-gradient(circle, hsl(var(--primary) / 0.15) 1.5px, transparent 1.5px),
            radial-gradient(circle, hsl(var(--primary) / 0.08) 1px, transparent 1px),
            linear-gradient(to right, hsl(var(--primary) / 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--primary) / 0.07) 1px, transparent 1px)
          `,
          backgroundSize: '25px 25px, 12.5px 12.5px, 25px 25px, 25px 25px',
        };

      case 'pattern-6': // Crossed diagonal / diamond pattern
        return {
          backgroundImage: `
            linear-gradient(45deg, hsl(var(--primary) / 0.11) 25%, transparent 25%, transparent 75%, hsl(var(--primary) / 0.11) 75%),
            linear-gradient(-45deg, hsl(var(--primary) / 0.11) 25%, transparent 25%, transparent 75%, hsl(var(--primary) / 0.11) 75%)
          `,
          backgroundSize: '20px 20px',
        };

      case 'pattern-7': // Concentric repeating radial-gradient
        return {
          backgroundImage: `
            repeating-radial-gradient(circle at 100% 100%, transparent 0, hsl(var(--primary) / 0.10) 12px, transparent 24px),
            repeating-radial-gradient(circle at 0% 0%, transparent 0, hsl(var(--primary) / 0.08) 16px, transparent 32px)
          `,
          backgroundSize: '50px 50px',
        };

      default:
        return {
          backgroundImage: `linear-gradient(45deg, hsl(var(--primary) / 0.09) 25%, transparent 25%, transparent 50%, hsl(var(--primary) / 0.09) 50%, hsl(var(--primary) / 0.14) 75%, transparent 75%, transparent)`,
          backgroundSize: '32px 32px',
        };
    }
  };

  const patternStyle = getPatternStyles(resolvedPattern);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Soft primary radial accent glow */}
      <div 
        className="absolute inset-0 z-0" 
        style={{
          background: "radial-gradient(circle at 82% 42%, hsl(var(--primary) / 0.14), transparent 42%)"
        }}
      />
      {/* Pattern Layer with left fade mask */}
      <div
        className="absolute inset-0 z-0"
        style={{
          ...patternStyle,
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, transparent 15%, rgba(0,0,0,0.35) 38%, rgba(0,0,0,0.85) 65%, black 100%)",
          maskImage: "linear-gradient(to right, transparent 0%, transparent 15%, rgba(0,0,0,0.35) 38%, rgba(0,0,0,0.85) 65%, black 100%)",
        }}
      />
      {/* Left Readability Overlay */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: "linear-gradient(to right, hsl(var(--card) / 0.96) 0%, hsl(var(--card) / 0.88) 28%, hsl(var(--card) / 0.35) 55%, transparent 78%)"
        }}
      />
    </div>
  );
};

export function PageHero({
  icon: Icon,
  badge,
  title,
  description,
  compact = false,
  className,
  contentClassName,
  children,
  pattern = "default"
}: PageHeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        "animate-in fade-in slide-in-from-bottom-1 duration-200",
        "bg-gradient-to-br from-primary/[0.03] via-background to-background",
        compact ? "p-4 min-h-[100px]" : "p-6 min-h-[125px] sm:min-h-[140px]",
        className
      )}
    >
      {renderPattern(pattern)}

      <div className={cn("flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10", contentClassName)}>
        <div className="flex gap-4">
          {Icon && (
            <div className={cn(
              "flex items-center justify-center rounded-xl bg-primary/10 border border-primary/15 text-primary shrink-0",
              compact ? "w-10 h-10" : "w-12 h-12 sm:w-14 sm:h-14"
            )}>
              <Icon className={cn(compact ? "w-5 h-5" : "w-6 h-6")} />
            </div>
          )}
          
          <div className="flex flex-col justify-center">
            {badge && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">
                {badge}
              </span>
            )}
            
            <h1 className={cn(
              "font-bold tracking-tight text-foreground",
              compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
            )}>
              {title}
            </h1>
            
            {description && (
              <p className={cn(
                "text-muted-foreground mt-1 max-w-[800px]",
                compact ? "text-xs sm:text-sm" : "text-sm"
              )}>
                {description}
              </p>
            )}
          </div>
        </div>
        
        {children && (
          <div className="flex items-center gap-3 shrink-0 self-start sm:self-center mt-2 sm:mt-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
