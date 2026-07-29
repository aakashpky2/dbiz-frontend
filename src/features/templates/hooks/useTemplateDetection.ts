import { useState, useEffect, useCallback, useRef } from 'react';

export interface Placeholder {
  key: string;
  name: string;
  type: 'Text' | 'Date' | 'Amount';
  defaultValue: string;
  mappedField?: string;
}

export function detectPlaceholdersFromContent(content: string): string[] {
    if (!content) return [];
    
    const regexes = [
      /\{\{([a-zA-Z0-9_.]+)\}\}/g,
      />([a-zA-Z0-9_.]+)/g,
      /=([a-zA-Z0-9_.]+)/g
    ];

    const detected = new Set<string>();
    let text = content;
    
    try {
      if (typeof window !== 'undefined') {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        text = doc.body.textContent || '';
      } else {
        text = content.replace(/<[^>]*>/g, ' ');
      }
    } catch (e) {
      text = content.replace(/<[^>]*>/g, ' ');
    }

    regexes.forEach(regex => {
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[1]) detected.add(match[1]);
      }
    });

    return Array.from(detected).sort();
}

export function useTemplateDetection(content: string) {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const lastKeysRef = useRef<string[]>([]);

  const detectPlaceholders = useCallback(() => {
    const uniqueKeys = detectPlaceholdersFromContent(content);
    
    // Safety: Prevent infinite loops by comparing keys
    if (JSON.stringify(uniqueKeys) === JSON.stringify(lastKeysRef.current)) {
      return;
    }

    lastKeysRef.current = uniqueKeys;

    setPlaceholders(current => {
      const updated = uniqueKeys.map(key => {
        const existing = current.find(p => p.key === key);
        if (existing) return existing;

        // Smart type inference based on key name
        const lowerKey = key.toLowerCase();
        let type: Placeholder['type'] = 'Text';
        if (lowerKey.includes('date') || lowerKey.includes('time')) type = 'Date';
        if (lowerKey.includes('amount') || lowerKey.includes('salary') || lowerKey.includes('price')) type = 'Amount';

        return {
          key,
          name: key.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          type,
          defaultValue: '',
        };
      });

      // Sorting: Date -> Amount -> Text -> Alpha
      return updated.sort((a, b) => {
        const typeOrder = { Date: 0, Amount: 1, Text: 2 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }
        return a.name.localeCompare(b.name);
      });
    });
  }, [content]);

  useEffect(() => {
    detectPlaceholders();
  }, [detectPlaceholders]);

  return { placeholders, setPlaceholders };
}
