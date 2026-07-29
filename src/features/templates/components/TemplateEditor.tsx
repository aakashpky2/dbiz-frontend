'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { Extension, Node } from '@tiptap/core';

import {
  FileText, Bold, Italic, List, Strikethrough, Superscript as SupIcon, Subscript as SubIcon,
  FileSearch, Save, Loader2, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Type, Palette, ListOrdered, Link as LinkIcon,
  Eraser, Heading1, Heading2, Heading3, Image as ImageIcon,
  PenTool, Code, FileUp, Highlighter, Search, X, Settings, LayoutTemplate, ReplaceAll,
  Table as TableIcon, Trash2, ArrowDownToLine, ArrowRightToLine, ArrowLeftToLine, ArrowUpToLine, GitMerge, FilePlus2, SplitSquareHorizontal, ChevronDown,
  Undo2, Redo2, Indent as IndentIcon, Outdent as OutdentIcon,
  MinusCircle, Square, Move
} from 'lucide-react';
import mammoth from 'mammoth';
import * as Tesseract from 'tesseract.js';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Extending standard fonts
const FONT_FAMILIES = [
  { name: 'Inter (Default)', value: 'Inter, sans-serif' },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Calibri', value: 'Calibri, sans-serif' },
  { name: 'Cambria', value: 'Cambria, Georgia, serif' },
  { name: 'Comic Sans MS', value: '"Comic Sans MS", cursive, sans-serif' },
  { name: 'Courier New', value: '"Courier New", Courier, monospace' },
  { name: 'Garamond', value: 'Garamond, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { name: 'Impact', value: 'Impact, sans-serif' },
  { name: 'Segoe UI', value: '"Segoe UI", sans-serif' },
  { name: 'Tahoma', value: 'Tahoma, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' }
];

const TEXT_COLORS = [
  { name: 'Black', value: '#0f172a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Gray', value: '#64748b' },
];

const FONT_SIZES = [
  { name: '8', value: '8pt' },
  { name: '10', value: '10pt' },
  { name: '11', value: '11pt' },
  { name: '12 (Normal)', value: '12pt' },
  { name: '14', value: '14pt' },
  { name: '18', value: '18pt' },
  { name: '24 (Title)', value: '24pt' },
  { name: '36', value: '36pt' },
];

const BORDER_WIDTHS = [
  { name: 'Hairline', value: '0.5px' },
  { name: '0.5 pt', value: '1px' },
  { name: '1 pt', value: '2px' },
  { name: '1.5 pt', value: '3px' },
  { name: '2.25 pt', value: '4px' },
  { name: '3 pt', value: '5px' },
  { name: '4.5 pt', value: '7px' },
  { name: '6 pt', value: '9px' },
];


const MARGIN_PRESETS = [
  { name: 'Normal', value: '25.4mm' },
  { name: 'Narrow', value: '12.7mm' },
  { name: 'Moderate', value: '19.1mm' },
  { name: 'Wide', value: '50.8mm' },
];

const BULLET_TYPES = [
  { name: 'Default (Disc)', value: 'disc' },
  { name: 'Circle', value: 'circle' },
  { name: 'Square', value: 'square' },
  { name: 'Arrow (➢)', value: '"➢ "' },
  { name: 'Diamond (◆)', value: '"◆ "' },
];

const ORDERED_TYPES = [
  { name: '1, 2, 3', value: 'decimal' },
  { name: 'a, b, c', value: 'lower-alpha' },
  { name: 'A, B, C', value: 'upper-alpha' },
  { name: 'i, ii, iii', value: 'lower-roman' },
  { name: 'I, II, III', value: 'upper-roman' },
];

const SHAPES = [
  { name: 'Square', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="90" height="90" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Rect', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="25" width="90" height="50" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Circle', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Triangle', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 95,95 5,95" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Diamond', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 95,50 50,95 5,50" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Star', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,5 63,40 98,40 70,60 80,95 50,75 20,95 30,60 2,40 37,40" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Arrow R', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M5,40 H70 V20 L95,50 L70,80 V60 H5 Z" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Arrow L', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M95,40 H30 V20 L5,50 L30,80 V60 H95 Z" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Arrow U', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M40,95 V30 H20 L50,5 L80,30 H60 V95 Z" fill="white" stroke="black" stroke-width="3"/></svg>' },
  { name: 'Arrow D', svg: '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M40,5 V70 H20 L50,95 L80,70 H60 V5 Z" fill="white" stroke="black" stroke-width="3"/></svg>' },
];

const SYMBOLS = ['©', '®', '™', '±', '×', '÷', '∞', '∑', '√', 'π', 'θ', 'λ', 'μ', 'Δ', 'Ω', '€', '£', '¥', '₹', '¢', '✓', '✗', '★', '☎', '✉', '➢', '◆', '▲', '▼', '◀', '▶'];

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() { return { types: ['paragraph', 'heading'] }; },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight: lineHeight => ({ commands }) => commands.updateAttributes('paragraph', { lineHeight }),
    };
  },
});

const Indent = Extension.create({
  name: 'indent',
  addOptions() { return { types: ['paragraph', 'heading'] }; },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: element => parseInt(element.style.paddingLeft || '0', 10) || 0,
            renderHTML: attributes => {
              if (!attributes.indent) return {};
              return { style: `padding-left: ${attributes.indent}px` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      increaseIndent: () => ({ state, commands }: any) => {
        let currentIndent = 0;
        state.selection.ranges.forEach((range: any) => {
          state.doc.nodesBetween(range.$from.pos, range.$to.pos, (node: any) => {
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              currentIndent = Math.max(currentIndent, node.attrs.indent || 0);
            }
          });
        });
        return commands.updateAttributes('paragraph', { indent: currentIndent + 40 });
      },
      decreaseIndent: () => ({ state, commands }: any) => {
        let currentIndent = 0;
        state.selection.ranges.forEach((range: any) => {
          state.doc.nodesBetween(range.$from.pos, range.$to.pos, (node: any) => {
            if (node.type.name === 'paragraph' || node.type.name === 'heading') {
              currentIndent = node.attrs.indent || 0;
            }
          });
        });
        return commands.updateAttributes('paragraph', { indent: Math.max(0, currentIndent - 40) });
      },
      unsetIndent: () => ({ commands }: any) => commands.updateAttributes('paragraph', { indent: null })
    } as any;
  },
});

const CustomTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(HTMLAttributes, { style: 'border: 2px solid black !important; border-collapse: collapse !important; width: 100%; margin: 15px 0;' }), ['tbody', 0]]
  }
});

const CustomTableRow = TableRow.extend({
  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes, { style: 'border: 2px solid black !important;' }), 0]
  }
});

const CustomTableCell = TableCell.extend({
  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes, { style: 'border: 2px solid black !important; min-width: 50px; height: 40px; padding: 10px; vertical-align: top;' }), 0]
  }
});

const CustomTableHeader = TableHeader.extend({
  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes, { style: 'border: 2px solid black !important; background-color: #f3f4f6; min-width: 50px; height: 40px; padding: 10px; font-weight: bold; text-align: left;' }), 0]
  }
});

const MoveHandle = ({ onMouseDown, onDelete, isVisible }: { onMouseDown: any, onDelete?: any, isVisible: boolean }) => (
  <div 
    className={cn(
      "absolute -top-6 left-0 bg-black text-white text-[9px] px-1.5 py-0.5 rounded-t-sm cursor-move flex items-center gap-2 select-none transition-opacity",
      isVisible ? "opacity-100" : "opacity-0"
    )}
    onMouseDown={onMouseDown}
  >
    <div className="flex items-center gap-1">
       <Move className="w-3 h-3 text-white" /> MOVE
    </div>
    {isVisible && onDelete && (
      <button 
        className="ml-2 pl-2 border-l border-white/30 hover:text-red-400 transition-colors pointer-events-auto"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    )}
  </div>
);

const TextBoxComponent = (props: any) => {
  const { node, updateAttributes, selected } = props;
  const { x, y, width, height } = node.attrs;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.editor && typeof props.getPos === 'function') {
      props.editor.commands.setNodeSelection(props.getPos());
    }
    const startX = e.clientX - x;
    const startY = e.clientY - y;

    const handleMouseMove = (event: MouseEvent) => {
      updateAttributes({
        x: event.clientX - startX,
        y: event.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startWidth = width;
    const startHeight = height;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (event: MouseEvent) => {
      updateAttributes({
        width: Math.max(50, startWidth + (event.clientX - startX)),
        height: Math.max(30, startHeight + (event.clientY - startY)),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <NodeViewWrapper
      data-type="custom-text-box"
      className={cn(
        "absolute transition-shadow group ring-1 ring-transparent rounded-sm",
        selected ? "z-50 bg-black/5" : "hover:ring-black/40 z-10"
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '1px dashed #cbd5e1',
        position: 'absolute',
      }}
    >
      <MoveHandle 
        onMouseDown={handleMouseDown} 
        isVisible={selected} 
        onDelete={() => props.editor?.commands.deleteSelection()} 
      />
      <div 
        className="w-full h-full p-2 overflow-auto outline-none cursor-text"
        onClick={() => {
          // If not selected or just clicking inside, ensure we focus the content
          if (props.editor) props.editor.chain().focus().run();
        }}
      >
        <NodeViewContent />
      </div>
      <div 
        className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize hover:bg-blue-100 flex items-center justify-center opacity-0 group-hover:opacity-100"
        onMouseDown={handleResizeMouseDown}
      >
        <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-black" />
      </div>
    </NodeViewWrapper>
  );
};

const CustomTextBox = Node.create({
  name: 'customTextBox',
  group: 'block',
  content: 'inline*',
  draggable: false, // Handled by our custom NodeView
  selectable: true,
  addAttributes() {
    return {
      x: { default: 50 },
      y: { default: 50 },
      width: { default: 200 },
      height: { default: 100 },
    };
  },
  parseHTML() {
    return [{ 
      tag: 'div[data-type="custom-text-box"]',
      getAttrs: (element: HTMLElement) => ({
        x: parseInt(element.getAttribute('x') || '50', 10),
        y: parseInt(element.getAttribute('y') || '50', 10),
        width: parseInt(element.getAttribute('width') || '200', 10),
        height: parseInt(element.getAttribute('height') || '100', 10),
      })
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const { x, y, width, height } = HTMLAttributes;
    return ['div', { 
      ...HTMLAttributes, 
      'data-type': 'custom-text-box',
      style: `position: absolute; left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px; border: 1px solid transparent; box-sizing: border-box; overflow: hidden;`
    }, 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TextBoxComponent);
  },
  addCommands() {
    return {
      insertCustomTextBox: () => ({ chain, state }: any) => {
        const offset = Math.floor(Math.random() * 80);
        return chain()
          .insertContentAt(state.selection.$to.pos, {
            type: this.name,
            attrs: { x: 100 + offset, y: 100 + offset, width: 250, height: 120 },
            content: [{ type: 'text', text: 'Enter text here...' }],
          })
          .focus()
          .run();
      },
    } as any;
  },
});

const SymbolComponent = (props: any) => {
  const { node, updateAttributes, selected } = props;
  const { x, y, char } = node.attrs;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.editor && typeof props.getPos === 'function') {
      props.editor.commands.setNodeSelection(props.getPos());
    }
    const startX = e.clientX - x;
    const startY = e.clientY - y;

    const handleMouseMove = (event: MouseEvent) => {
      updateAttributes({
        x: event.clientX - startX,
        y: event.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <NodeViewWrapper
      data-type="custom-symbol"
      className={cn(
        "absolute flex items-center justify-center transition-shadow group ring-1 ring-transparent",
        selected ? "z-50 bg-black/5" : "hover:ring-black/40 z-10"
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        fontSize: '1.5rem',
        minWidth: '40px',
        minHeight: '40px',
        position: 'absolute',
      }}
    >
      <MoveHandle 
        onMouseDown={handleMouseDown} 
        isVisible={selected} 
        onDelete={() => props.editor?.commands.deleteSelection()} 
      />
      <div className="cursor-move select-none" onMouseDown={handleMouseDown}>
        {char}
      </div>
    </NodeViewWrapper>
  );
};

const CustomSymbol = Node.create({
  name: 'customSymbol',
  group: 'block', // Changed to block to allow absolute positioning more easily in the document
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      x: { default: 200 },
      y: { default: 200 },
      char: { default: '' },
    };
  },
  parseHTML() {
    return [{ 
      tag: 'div[data-type="custom-symbol"]',
      getAttrs: (element: HTMLElement) => ({
        x: parseInt(element.getAttribute('x') || '200', 10),
        y: parseInt(element.getAttribute('y') || '200', 10),
        char: element.getAttribute('char') || element.innerText || '',
      })
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const { x, y, char } = HTMLAttributes;
    return ['div', { 
      ...HTMLAttributes, 
      'data-type': 'custom-symbol',
      style: `position: absolute; left: ${x}px; top: ${y}px; font-size: 1.5rem; min-width: 40px; min-height: 40px; display: flex; align-items: center; justify-content: center;`
    }, char];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SymbolComponent);
  },
  addCommands() {
    return {
      insertCustomSymbol: (char: string) => ({ chain, state }: any) => {
        const offset = Math.floor(Math.random() * 60);
        return chain()
          .insertContentAt(state.selection.$to.pos, { 
            type: this.name, 
            attrs: { char, x: 180 + offset, y: 180 + offset } 
          })
          .focus()
          .run();
      },
    } as any;
  },
});

const ImageComponent = (props: any) => {
  const { node, updateAttributes, selected } = props;
  const { x, y, width, height, src, alt } = node.attrs;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.editor && typeof props.getPos === 'function') {
      props.editor.commands.setNodeSelection(props.getPos());
    }
    const startX = e.clientX - x;
    const startY = e.clientY - y;

    const handleMouseMove = (event: MouseEvent) => {
      updateAttributes({
        x: event.clientX - startX,
        y: event.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startWidth = width;
    const startHeight = height;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (event: MouseEvent) => {
      updateAttributes({
        width: Math.max(50, startWidth + (event.clientX - startX)),
        height: Math.max(30, startHeight + (event.clientY - startY)),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <NodeViewWrapper
      data-type="custom-image"
      className={cn(
        "absolute transition-shadow group ring-1 ring-transparent",
        selected ? "z-50 bg-black/5" : "hover:ring-black/40 z-10"
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
      }}
    >
      <MoveHandle 
        onMouseDown={handleMouseDown} 
        isVisible={selected} 
        onDelete={() => props.editor?.commands.deleteSelection()} 
      />
      <div className="w-full h-full cursor-move" onMouseDown={handleMouseDown}>
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full object-contain pointer-events-none"
        />
      </div>
      <div 
        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize bg-black/40 hover:bg-black/60 flex items-center justify-center rounded-tl-md opacity-0 group-hover:opacity-100"
        onMouseDown={handleResizeMouseDown}
      >
        <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-white" />
      </div>
    </NodeViewWrapper>
  );
};

const CustomImage = Image.extend({
  name: 'customImage',
  group: 'block',
  selectable: true,
  draggable: false, // Moved via our custom NodeView logic
  addAttributes() {
    return {
      src: { 
        default: null,
        parseHTML: element => element.getAttribute('src'),
        renderHTML: attributes => ({ src: attributes.src }),
      },
      alt: { 
        default: null, 
        parseHTML: element => element.getAttribute('alt'),
        renderHTML: attributes => ({ alt: attributes.alt }),
      },
      x: { default: 100 },
      y: { default: 100 },
      width: { default: 250 },
      height: { default: 180 },
    };
  },
  parseHTML() {
    return [
      { 
        tag: 'div[data-type="custom-image"]',
        getAttrs: (element: HTMLElement) => {
          const img = element.querySelector('img');
          return {
            src: element.getAttribute('src') || img?.getAttribute('src') || null,
            alt: element.getAttribute('alt') || img?.getAttribute('alt') || null,
            x: parseInt(element.getAttribute('x') || '100', 10),
            y: parseInt(element.getAttribute('y') || '100', 10),
            width: parseInt(element.getAttribute('width') || '250', 10),
            height: parseInt(element.getAttribute('height') || '180', 10),
          };
        }
      },
      { tag: 'img[data-type="custom-image"]' },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { x, y, width, height, src, alt } = HTMLAttributes;
    return [
      'div', 
      { 
        ...HTMLAttributes, 
        'data-type': 'custom-image', 
        style: `position: absolute; left: ${x}px; top: ${y}px; width: ${width}px; height: ${height}px; display: block;` 
      },
      ['img', { src: src || '', alt: alt || '', style: 'width: 100%; height: 100%; object-fit: contain; pointer-events: none; display: block;' }]
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageComponent);
  },
  addCommands() {
    return {
      insertPicture: (options: any) => ({ commands, state }: any) => {
        const offset = Math.floor(Math.random() * 100);
        return commands.insertContentAt(state.selection.$to.pos, {
          type: this.name,
          attrs: { 
            ...options, 
            x: (options.x || 120) + offset, 
            y: (options.y || 120) + offset 
          },
        });
      },
    } as any;
  },
});

const LineComponent = (props: any) => {
  const { node, updateAttributes, selected } = props;
  const { x, y, width } = node.attrs;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (props.editor && typeof props.getPos === 'function') {
      props.editor.commands.setNodeSelection(props.getPos());
    }
    const startX = e.clientX - x;
    const startY = e.clientY - y;

    const handleMouseMove = (event: MouseEvent) => {
      updateAttributes({
        x: event.clientX - startX,
        y: event.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startWidth = width;
    const startX = e.clientX;

    const handleMouseMove = (event: MouseEvent) => {
      updateAttributes({
        width: Math.max(20, startWidth + (event.clientX - startX)),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <NodeViewWrapper
      data-type="custom-horizontal-rule"
      className={cn(
        "absolute group ring-1 ring-transparent rounded-sm",
        selected ? "z-50 bg-black/5" : "hover:ring-black/40 z-10"
      )}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        position: 'absolute',
      }}
    >
      <MoveHandle 
        onMouseDown={handleMouseDown} 
        isVisible={selected} 
        onDelete={() => props.editor?.commands.deleteSelection()} 
      />
      <div className="w-full h-full flex items-center cursor-move" onMouseDown={handleMouseDown}>
        <div className="w-full border-t-4 border-black group-hover:border-blue-500" />
      </div>
      {selected && (
        <div 
          className="absolute right-0 w-5 h-5 bg-black cursor-ew-resize rounded-full border-2 border-white shadow-xl"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </NodeViewWrapper>
  );
};

const CustomHorizontalRule = Node.create({
  name: 'customHorizontalRule',
  group: 'block',
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      x: { default: 50 },
      y: { default: 150 },
      width: { default: 500 },
    };
  },
  parseHTML() {
    return [{ 
      tag: 'div[data-type="custom-horizontal-rule"]',
      getAttrs: (element: HTMLElement) => ({
        x: parseInt(element.getAttribute('x') || '50', 10),
        y: parseInt(element.getAttribute('y') || '150', 10),
        width: parseInt(element.getAttribute('width') || '500', 10),
      })
    }];
  },
  renderHTML({ HTMLAttributes }) {
    const { x, y, width } = HTMLAttributes;
    return [
      'div', 
      { 
        ...HTMLAttributes, 
        'data-type': 'custom-horizontal-rule',
        style: `position: absolute; left: ${x}px; top: ${y}px; width: ${width}px; height: 15px; display: flex; align-items: center;`
      },
      ['div', { style: 'width: 100%; border-top: 4px solid #000;' }]
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LineComponent);
  },
  addCommands() {
    return {
      insertCustomHorizontalRule: () => ({ chain, state }: any) => {
        const offset = Math.floor(Math.random() * 40);
        return chain()
          .insertContentAt(state.selection.$to.pos, { 
            type: this.name, 
            attrs: { x: 100 + offset, y: 150 + offset, width: 300 } 
          })
          .focus()
          .run();
      },
    } as any;
  },
});

import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';

const CustomBulletList = BulletList.extend({
  addAttributes() {
    return {
      dataListStyle: {
        default: 'disc',
        parseHTML: element => element.getAttribute('data-list-style'),
        renderHTML: attributes => ({
          'data-list-style': attributes.dataListStyle,
          style: `list-style-type: ${attributes.dataListStyle} !important`,
        }),
      },
    };
  },
});

const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      dataListStyle: {
        default: 'decimal',
        parseHTML: element => element.getAttribute('data-list-style'),
        renderHTML: attributes => ({
          'data-list-style': attributes.dataListStyle,
          style: `list-style-type: ${attributes.dataListStyle} !important`,
        }),
      },
    };
  },
});

const ListStyleCommand = Extension.create({
  name: 'listStyleCommand',
  addCommands() {
    return {
      setListStyleType: (type: string) => ({ chain }: any) => {
        return chain()
          .focus()
          .updateAttributes('bulletList', { dataListStyle: type })
          .updateAttributes('orderedList', { dataListStyle: type })
          .run();
      },
    } as any;
  },
});

interface TemplateEditorProps {
  initialContent?: string;
  onSave?: (explicitContent?: string, shouldExit?: boolean) => void;
  onChange?: (content: string) => void;
}

const GLOBAL_STYLES = `
  /* === BASE EDITOR === */
  .custom-editor-content { position: relative !important; min-height: 500px; color: #000 !important; }
  .custom-editor-content .ProseMirror { color: #000 !important; --tw-prose-bullets: #000 !important; --tw-prose-counters: #000 !important; }
  .custom-editor-content p, .custom-editor-content h1, .custom-editor-content h2, .custom-editor-content h3, .custom-editor-content span { color: inherit; }
  .custom-editor-content ::selection { background-color: rgba(0, 0, 0, 0.15); color: inherit; }
  .custom-editor-content strong, .custom-editor-content em, .custom-editor-content s, .custom-editor-content u, .custom-editor-content blockquote { color: inherit; }

  /* === LISTS (BULLETS & NUMBERED) — FORCE BLACK === */
  .custom-editor-content ul, .custom-editor-content .prose ul { list-style-type: disc !important; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; color: #000 !important; }
  .custom-editor-content ol, .custom-editor-content .prose ol { list-style-type: decimal !important; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; color: #000 !important; }
  .custom-editor-content li, .custom-editor-content .prose li { color: #000 !important; }
  .custom-editor-content li::marker, .custom-editor-content .prose li::marker { color: #000 !important; font-weight: 800 !important; font-size: 1.1em !important; }
  .custom-editor-content li p, .custom-editor-content .prose li p { margin: 0; color: #000 !important; }
  
  /* Robust Marker fix for all nested scenarios */
  .custom-editor-content *::marker { color: #000 !important; }

  /* Tables are now handled by CustomTable extension rendering */

  /* === SELECTION ON CUSTOM NODES === */
  .custom-editor-content .ProseMirror-selectednode { outline: 2px solid #000 !important; box-shadow: 0 0 8px rgba(0, 0, 0, 0.25) !important; border-radius: 2px !important; z-index: 50 !important; cursor: move !important; }

  /* === ABSOLUTE POSITIONING FOR CUSTOM NODES === */
  .custom-editor-content [data-type="custom-text-box"] { position: absolute !important; }
  .custom-editor-content [data-type="custom-symbol"] { position: absolute !important; }
  .custom-editor-content [data-type="custom-image"] { position: absolute !important; }
  .custom-editor-content [data-type="custom-horizontal-rule"] { position: absolute !important; }
`;

// Define extensions outside component to ensure stable schema and prevent duplicate initialization warnings
const editorExtensions = [
  StarterKit.configure({ 
    heading: { levels: [1, 2, 3] },
    bulletList: false,
    orderedList: false,
    horizontalRule: false,
  }),
  CustomBulletList,
  CustomOrderedList,
  ListStyleCommand,
  Underline,
  Superscript,
  Subscript,
  TextStyle,
  FontFamily,
  Color,
  FontSize,
  LineHeight,
  Indent,
  CustomTextBox,
  CustomSymbol,
  CustomHorizontalRule,
  CustomImage,
  TextAlign.configure({ types: ['heading', 'paragraph', 'customTextBox', 'customImage'] }),
  Link.configure({ openOnClick: false }),
  Highlight.configure({ multicolor: true }),
  CustomTable.configure({ 
    resizable: true,
  }),
  CustomTableRow,
  CustomTableHeader,
  CustomTableCell,
  Placeholder.configure({ placeholder: 'Start drafting the template or import a file...' }),
];

export default function TemplateEditor({ initialContent = '', onSave, onChange }: TemplateEditorProps) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [zoom, setZoom] = useState(1);

  // We no longer need to memoize inside since it's defined outside
  const extensions = editorExtensions;

  // Outer Document State (Header/Footer tracking)
  const [htmlContent, setHtmlContent] = useState(() => {
    if (!initialContent) return '';
    const matchBody = initialContent.match(/<article.*?>([\s\S]*?)<\/article>/i) || [, initialContent];
    return matchBody[1];
  });
  const [headerHtml, setHeaderHtml] = useState(() => {
    if (!initialContent) return '';
    const matchHeader = initialContent.match(/<header.*?>([\s\S]*?)<\/header>/i);
    return matchHeader ? matchHeader[1] : '';
  });
  const [footerHtml, setFooterHtml] = useState(() => {
    if (!initialContent) return '';
    const matchFooter = initialContent.match(/<footer.*?>([\s\S]*?)<\/footer>/i);
    return matchFooter ? matchFooter[1] : '';
  });

  // Page Format State
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [marginScale, setMarginScale] = useState('Normal');
  const currentMarginValue = MARGIN_PRESETS.find(p => p.name === marginScale)?.value || '25.4mm';

  // Search/Replace State
  const [showSearch, setShowSearch] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [replaceVal, setReplaceVal] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [procProgress, setProcProgress] = useState(0);

  const [activeMenu, setActiveMenu] = useState<'none' | 'fonts' | 'sizes' | 'colors' | 'lineHeight' | 'header' | 'footer' | 'highlights' | 'insertTable' | 'tableBorders' | 'margins' | 'bulletTypes' | 'orderedTypes' | 'shapes' | 'symbols'>('none');
  const [tempFontSize, setTempFontSize] = useState('');
  const [isFontSizeFocused, setIsFontSizeFocused] = useState(false);
  const { toast } = useToast();

  // Removed broken async useEffect that caused content to vanish on remount

  const buildFinalHtml = useCallback((body: string, h: string, f: string) => {
    let final = '';
    if (h.trim()) final += `<header style="margin-bottom: 2rem; font-size: 0.8em; color: gray;">${h}</header>\n`;
    final += `<article>${body}</article>\n`;
    if (f.trim()) final += `<footer style="margin-top: 2rem; font-size: 0.8em; color: gray; text-align: center; border-top: 1px solid #ccc; padding-top: 10px;">${f}</footer>`;
    return final;
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: extensions,
    content: htmlContent, // initializes safely
    onUpdate: ({ editor }) => {
      const body = editor.getHTML();
      setHtmlContent(body);
      // We'll use a local buildFinalHtml call or similar to ensure we pass latest H/F
    },
  }, [htmlContent === 'INITIAL_LOCK']); // strict prevention of reload

  // Sync state changes to parent
  useEffect(() => {
    if (editor) {
      const body = isHtmlMode ? htmlContent : editor.getHTML();
      onChange?.(buildFinalHtml(body, headerHtml, footerHtml));
    }
  }, [headerHtml, footerHtml, htmlContent, isHtmlMode, onChange, buildFinalHtml, editor]);

  const exportWord = () => {
    const content = buildFinalHtml(isHtmlMode ? htmlContent : editor?.getHTML() || '', headerHtml, footerHtml);
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Template.doc';
    a.click();
    toast({ title: "Exported to Word" });
  };

  const exportPdf = async () => {
    setIsProcessing(true);
    setProcProgress(10);
    try {
      const content = buildFinalHtml(isHtmlMode ? htmlContent : editor?.getHTML() || '', headerHtml, footerHtml);
      const contentDiv = document.createElement('div');
      contentDiv.id = 'template-pdf-content';
      contentDiv.style.width = '800px';
      contentDiv.style.padding = '40px';
      contentDiv.style.background = 'white';
      contentDiv.style.color = 'black';
      contentDiv.innerHTML = content;
      document.body.appendChild(contentDiv);
      
      const html2canvas = (await import('html2canvas')).default;
      setProcProgress(50);
      const canvas = await html2canvas(contentDiv, {
          scale: 2,
          useCORS: true,
          logging: false
      });
      document.body.removeChild(contentDiv);

      const imgData = canvas.toDataURL('image/png');
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Template.pdf`);
      toast({ title: "Exported to PDF" });
    } catch(err) {
      toast({ title: "PDF Export Failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const executeReplaceAll = () => {
    if (!editor || !searchVal) return;
    const current = editor.getHTML();
    const regex = new RegExp(searchVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    editor.commands.setContent(current.replace(regex, replaceVal));
    toast({ title: "Replaced matching text", description: `Replaced "${searchVal}" with "${replaceVal}"` });
    setShowSearch(false);
  };

  const executeHeaderFooterSave = (h: string, f: string) => {
    setHeaderHtml(h); setFooterHtml(f);
    onChange?.(buildFinalHtml(htmlContent, h, f));
  };

  if (!editor) return null;

  const currentFont = FONT_FAMILIES.find(f => editor.isActive('textStyle', { fontFamily: f.value }))?.name || 'Font';
  const currentFontSizeAttr = editor.getAttributes('textStyle').fontSize;
  const parsedCurrentSize = currentFontSizeAttr ? parseInt(currentFontSizeAttr, 10).toString() : '12';
  const currentColor = editor.getAttributes('textStyle').color || 'inherit';
  const currentHighlight = editor.isActive('highlight') ? editor.getAttributes('highlight').color || '#fef08a' : 'transparent';

  return (
    <div className="flex flex-col h-full bg-[#f1f5f9] rounded-[2rem] border shadow-2xl overflow-hidden min-h-[700px] ring-1 ring-slate-200/50 w-full transition-all">
      {/* 1. Main Application Header Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b z-20 shadow-sm relative shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-[14px] border border-slate-200">
          <Button variant="ghost" size="sm" onClick={() => {
            if (isHtmlMode && editor) {
              editor.commands.setContent(htmlContent, { emitUpdate: false });
            }
            setIsHtmlMode(false);
          }} className={cn("h-8 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all", !isHtmlMode ? "bg-white shadow-sm text-indigo-700" : "text-slate-500")}><PenTool className="h-3.5 w-3.5 mr-1" /> Layout</Button>
          <Button variant="ghost" size="sm" onClick={() => {
            if (!isHtmlMode && editor) {
              setHtmlContent(editor.getHTML());
            }
            setIsHtmlMode(true);
          }} className={cn("h-8 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all", isHtmlMode ? "bg-white shadow-sm text-emerald-700" : "text-slate-500")}><Code className="h-3.5 w-3.5 mr-1" /> HTML Code</Button>
        </div>

        <div className="flex flex-1 justify-center relative">
          {showSearch && (
            <div className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2 bg-white border shadow-2xl p-2 rounded-2xl animate-in zoom-in-95 z-50">
              <div className="flex flex-col gap-1.5 px-2">
                <div className="flex items-center gap-2"><Search className="w-3.5 h-3.5 text-slate-400" /><Input className="h-7 text-xs font-bold w-40" placeholder="Find text..." value={searchVal} onChange={e => setSearchVal(e.target.value)} /></div>
                <div className="flex items-center gap-2"><ReplaceAll className="w-3.5 h-3.5 text-slate-400" /><Input className="h-7 text-xs font-bold w-40" placeholder="Replace with..." value={replaceVal} onChange={e => setReplaceVal(e.target.value)} /></div>
              </div>
              <div className="flex flex-col gap-1 border-l pl-2">
                <Button size="sm" className="w-full h-7 text-[9px] uppercase font-black tracking-widest bg-blue-600 hover:bg-blue-700" onClick={executeReplaceAll}>Replace All</Button>
                <Button size="sm" variant="ghost" className="h-7 text-[9px] uppercase font-black" onClick={() => setShowSearch(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!showSearch && <Button variant="ghost" onClick={() => setShowSearch(true)} className="h-10 text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2"><Search className="h-4 w-4 mr-2" /> Find</Button>}

          <div className="flex items-center bg-blue-50/50 rounded-2xl border border-blue-100 p-1 shadow-inner mr-2">
            <button className="cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-xl text-blue-700 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100/50 transition-all" onClick={exportWord}>
              <FileText className="h-3.5 w-3.5 text-blue-500" /> Word
            </button>
            <div className="w-[1px] h-4 bg-blue-200" />
            <button className="cursor-pointer group flex items-center gap-2 px-3 py-1.5 rounded-xl text-amber-700 text-[10px] font-black uppercase tracking-wider hover:bg-amber-100/50 transition-all" onClick={exportPdf}>
              <FileUp className="h-3.5 w-3.5 text-amber-500" /> PDF
            </button>
          </div>

          <Button onClick={() => onSave?.(buildFinalHtml(isHtmlMode ? htmlContent : editor.getHTML(), headerHtml, footerHtml), true)} className="bg-slate-900 hover:bg-slate-800 text-white h-10 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-900/10">
            <Save className="h-4 w-4 mr-2" /> Save & Exit
          </Button>
        </div>
      </div>

      {/* 2. Microsoft Word Ribbon Toolbar */}
      {!isHtmlMode && (
        <div className="flex flex-col bg-[#f3f2f1] border-b z-10 shrink-0 select-none pb-1" onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>
          {/* Quick Access Toolbar */}
          <div className="flex items-center px-4 pt-1 pb-1 gap-1 border-b border-transparent">
            <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="h-5 w-5 p-0 rounded-sm hover:bg-slate-200/50 text-slate-500"><Undo2 className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="h-5 w-5 p-0 rounded-sm hover:bg-slate-200/50 text-slate-500"><Redo2 className="w-3.5 h-3.5" /></Button>
            <div className="w-[1px] h-3 bg-slate-200/60 mx-1" />
          </div>

          {/* Main formatting tabs (mock) */}
          <div className="flex items-end px-2 pt-0 gap-1 border-b border-slate-200">
            <span className="px-4 py-1.5 bg-white text-blue-600 font-bold text-xs border border-b-0 border-slate-200 rounded-t-sm z-10 relative -mb-[1px]">Home</span>
            <div className="relative">
              <span className="px-4 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 cursor-pointer font-medium text-xs rounded-t-sm transition-colors block" onClick={() => setActiveMenu(a => a === 'insertTable' ? 'none' : 'insertTable')}>Insert Table</span>
              {activeMenu === 'insertTable' && (
                <div className="absolute top-8 left-0 w-48 z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-3 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block border-b border-slate-100 pb-1.5">Insert Table</span>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-medium text-slate-600 w-14">Columns:</span>
                    <input type="number" min="1" max="20" className="border border-slate-300 rounded-sm h-6 w-full text-xs px-2 hover:bg-slate-50 focus:bg-blue-50 focus:border-blue-400 focus:outline-none" id="insert-table-cols" defaultValue={3} onKeyDown={e => e.stopPropagation()} autoFocus />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-medium text-slate-600 w-14">Rows:</span>
                    <input type="number" min="1" max="50" className="border border-slate-300 rounded-sm h-6 w-full text-xs px-2 hover:bg-slate-50 focus:bg-blue-50 focus:border-blue-400 focus:outline-none" id="insert-table-rows" defaultValue={3} onKeyDown={e => e.stopPropagation()} />
                  </div>
                  <Button size="sm" className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700 font-medium" onClick={() => {
                    const cols = parseInt((document.getElementById('insert-table-cols') as HTMLInputElement)?.value || '3', 10);
                    const rows = parseInt((document.getElementById('insert-table-rows') as HTMLInputElement)?.value || '3', 10);
                    editor.chain().focus().insertTable({ rows: Math.max(1, rows), cols: Math.max(1, cols), withHeaderRow: true }).run();
                    setActiveMenu('none');
                  }}>Create Table</Button>
                </div>
              )}
            </div>
            <span className="px-4 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 cursor-pointer font-medium text-xs rounded-t-sm transition-colors" onClick={() => setOrientation(o => o === 'portrait' ? 'landscape' : 'portrait')}>Page Orientation ({orientation})</span>
            <div className="relative">
              <span className="px-4 py-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 cursor-pointer font-medium text-xs rounded-t-sm transition-colors" onClick={() => setActiveMenu(a => a === 'margins' ? 'none' : 'margins')}>Margins ({marginScale})</span>
              {activeMenu === 'margins' && (
                <div className="absolute top-8 left-0 w-32 z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-1 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                  {MARGIN_PRESETS.map(m => (
                    <button key={m.name} onClick={() => { setMarginScale(m.name); setActiveMenu('none'); }} className={cn("flex w-full text-left text-[11px] p-1.5 rounded-sm cursor-pointer hover:bg-blue-50", marginScale === m.name && "bg-blue-100 text-blue-700")}>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {editor.isActive('table') && <span className="px-4 py-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 border border-b-0 border-emerald-200 rounded-t-sm z-10 relative -mb-[1px]">Table Tools</span>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 px-4 bg-white shadow-sm border-b border-transparent">
            <div className="flex flex-col h-full border-r border-slate-200 px-3 py-1 group/ribbon">
              <div className="flex flex-col gap-1 flex-grow">
                <div className="flex items-center gap-1">
                  {/* Font dropdown */}
                  <div className="relative">
                    <Button variant="ghost" size="sm" className="h-6 gap-1 border hover:bg-slate-100 min-w-[120px] rounded-sm bg-white px-2 justify-between" onClick={() => setActiveMenu(a => a === 'fonts' ? 'none' : 'fonts')}>
                      <span className="text-[11px] text-slate-700 truncate font-sans">{currentFont}</span> <ChevronDown className="w-3 h-3 text-slate-400" />
                    </Button>
                    {activeMenu === 'fonts' && (
                      <div className="absolute top-8 left-0 w-48 z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-1 animate-in fade-in max-h-64 overflow-y-auto" onMouseLeave={() => setActiveMenu('none')}>
                        {FONT_FAMILIES.map(font => (
                          <button key={font.name} onClick={() => { editor.chain().focus().setFontFamily(font.value).run(); setActiveMenu('none'); }} className={cn("flex w-full text-left text-[11px] p-1.5 rounded-sm cursor-pointer hover:bg-blue-50", editor.isActive('textStyle', { fontFamily: font.value }) && "bg-blue-100 text-blue-700")}>
                            <span style={{ fontFamily: font.value }}>{font.name.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative flex items-center border hover:bg-slate-100 rounded-sm bg-white h-6 pl-1 pr-0.5">
                    <input
                      type="text"
                      className="w-7 h-4 text-[11px] font-sans text-slate-700 text-center bg-transparent focus:outline-none focus:bg-blue-50 selection:bg-blue-200"
                      value={isFontSizeFocused ? tempFontSize : parsedCurrentSize}
                      onFocus={() => {
                        setIsFontSizeFocused(true);
                        setTempFontSize(parsedCurrentSize);
                      }}
                      onChange={e => setTempFontSize(e.target.value)}
                      onBlur={() => {
                        setIsFontSizeFocused(false);
                        if (tempFontSize) {
                          const val = parseInt(tempFontSize, 10);
                          if (!isNaN(val) && val > 0 && val <= 500) editor.chain().focus().setFontSize(val + 'pt').run();
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          const val = parseInt(tempFontSize || parsedCurrentSize, 10);
                          if (!isNaN(val) && val > 0 && val <= 500) editor.chain().focus().setFontSize(val + 'pt').run();
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    <div className="h-4 w-[1px] bg-slate-200 mx-1 cursor-default" />
                    <button className="h-5 w-4 flex items-center justify-center hover:bg-slate-200 rounded-[2px]" onClick={() => setActiveMenu(a => a === 'sizes' ? 'none' : 'sizes')}>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>
                    {activeMenu === 'sizes' && (
                      <div className="absolute top-8 left-0 w-24 z-50 bg-white border rounded-sm shadow-xl p-1 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                        {FONT_SIZES.map(size => (
                          <button key={size.name} onClick={() => { editor.chain().focus().setFontSize(size.value).run(); setActiveMenu('none'); }} className={cn("flex w-full justify-between items-center text-left text-[11px] p-1.5 rounded-sm cursor-pointer hover:bg-blue-50", editor.getAttributes('textStyle').fontSize === size.value && "bg-blue-100 text-blue-700")}>
                            <span>{size.name.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button title="Increase Font Size" className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-slate-200 text-slate-700 select-none" onClick={() => { const cur = parseInt(parsedCurrentSize, 10) || 12; editor.chain().focus().setFontSize((cur + 1) + 'pt').run(); }}><span className="text-[15px] leading-none font-black">A</span></button>
                  <button title="Decrease Font Size" className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-slate-200 text-slate-700 select-none" onClick={() => { const cur = parseInt(parsedCurrentSize, 10) || 12; if (cur > 1) editor.chain().focus().setFontSize((cur - 1) + 'pt').run(); }}><span className="text-[10px] leading-none font-bold">A</span></button>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={cn("h-6 w-6 p-0 rounded-sm hover:bg-slate-100", editor.isActive('bold') && 'bg-slate-200')}><Bold className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("h-6 w-6 p-0 rounded-sm hover:bg-slate-100", editor.isActive('italic') && 'bg-slate-200')}><Italic className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleUnderline().run()} className={cn("h-6 w-6 p-0 rounded-sm hover:bg-slate-100", editor.isActive('underline') && 'bg-slate-200')}><UnderlineIcon className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} className={cn("h-6 w-6 p-0 rounded-sm hover:bg-slate-100", editor.isActive('strike') && 'bg-slate-200')}><Strikethrough className="h-3.5 w-3.5 text-slate-500" /></Button>
                  <div className="relative ml-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-sm hover:bg-slate-100" onClick={() => setActiveMenu(a => a === 'colors' ? 'none' : 'colors')} title="Text Color">
                      <div className="flex flex-col items-center justify-center -mb-1"><span className="text-[12px] font-bold font-serif -mt-0.5" style={{ color: currentColor === 'inherit' ? '#0f172a' : currentColor }}>A</span><div className="w-3.5 h-[3px] rounded-none" style={{ backgroundColor: currentColor === 'inherit' ? '#0f172a' : currentColor }} /></div>
                    </Button>
                    {activeMenu === 'colors' && (
                      <div className="absolute top-8 left-0 w-40 z-50 bg-white border rounded-sm shadow-xl p-2 pb-1 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                        <div className="grid grid-cols-4 gap-1 mb-2">
                          {TEXT_COLORS.map(c => (
                            <button key={c.name} onClick={() => { c.value === 'inherit' ? editor.chain().focus().unsetColor().run() : editor.chain().focus().setColor(c.value).run(); setActiveMenu('none'); }} className="w-6 h-6 rounded-sm border border-slate-200 shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: c.value === 'inherit' ? '#fff' : c.value }} title={c.name} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { editor.chain().focus().unsetAllMarks().clearNodes().run(); (editor.commands as any).unsetIndent?.(); }} className="h-6 w-6 p-0 rounded-sm hover:bg-slate-100 ml-1" title="Clear Formatting"><Eraser className="h-3.5 w-3.5 text-pink-600" /></Button>
                </div>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1 self-center">Font</span>
            </div>

            <div className="flex flex-col h-full border-r border-slate-200 px-3 py-1 group/ribbon">
              <div className="flex flex-col gap-1 flex-grow">
                <div className="flex items-center gap-0.5">
                  <div className="relative flex items-center">
                    <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("h-6 w-6 p-0 rounded-l-sm rounded-r-none hover:bg-slate-100", editor.isActive('bulletList') && 'bg-slate-200')}><List className="h-3.5 w-3.5" /></Button>
                    <button className="h-6 px-0.5 border-l border-slate-200 hover:bg-slate-200 rounded-r-sm transition-colors" onClick={() => setActiveMenu(a => a === 'bulletTypes' ? 'none' : 'bulletTypes')}>
                      <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
                    </button>
                    {activeMenu === 'bulletTypes' && (
                      <div className="absolute top-8 left-0 w-32 z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-1 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                        {BULLET_TYPES.map(bt => (
                          <button key={bt.name} onClick={() => { (editor.commands as any).setListStyleType(bt.value); setActiveMenu('none'); }} className="flex w-full text-left text-[11px] p-1.5 rounded-sm cursor-pointer hover:bg-blue-50">
                            {bt.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative flex items-center ml-0.5">
                    <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn("h-6 w-6 p-0 rounded-l-sm rounded-r-none hover:bg-slate-100", editor.isActive('orderedList') && 'bg-slate-200')}><ListOrdered className="h-3.5 w-3.5" /></Button>
                    <button className="h-6 px-0.5 border-l border-slate-200 hover:bg-slate-200 rounded-r-sm transition-colors" onClick={() => setActiveMenu(a => a === 'orderedTypes' ? 'none' : 'orderedTypes')}>
                      <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
                    </button>
                    {activeMenu === 'orderedTypes' && (
                      <div className="absolute top-8 left-0 w-36 z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-1 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                        {ORDERED_TYPES.map(ot => (
                          <button key={ot.name} onClick={() => { (editor.commands as any).setListStyleType(ot.value); setActiveMenu('none'); }} className="flex w-full text-left text-[11px] p-1.5 rounded-sm cursor-pointer hover:bg-blue-50">
                            {ot.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                  <Button variant="ghost" size="sm" onClick={() => (editor.commands as any).decreaseIndent?.()} className="h-6 w-6 p-0 rounded-sm hover:bg-slate-100 text-slate-600"><OutdentIcon className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => (editor.commands as any).increaseIndent?.()} className="h-6 w-6 p-0 rounded-sm hover:bg-slate-100 text-slate-600"><IndentIcon className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={cn("h-6 w-6 p-0 rounded-sm hover:bg-slate-100", editor.isActive({ textAlign: 'left' }) && 'bg-slate-200')}><AlignLeft className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={cn("h-6 w-6 p-0 rounded-sm hover:bg-slate-100", editor.isActive({ textAlign: 'center' }) && 'bg-slate-200')}><AlignCenter className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={cn("h-6 w-6 p-0 rounded-sm hover:bg-slate-100", editor.isActive({ textAlign: 'right' }) && 'bg-slate-200')}><AlignRight className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={cn("h-6 w-6 p-0 rounded-sm hover:bg-slate-100", editor.isActive({ textAlign: 'justify' }) && 'bg-slate-200')}><AlignJustify className="h-3.5 w-3.5" /></Button>
                  <div className="relative ml-0.5">
                    <Button variant="ghost" size="sm" className="h-6 gap-1 hover:bg-slate-100 rounded-sm px-2" onClick={() => setActiveMenu(a => a === 'lineHeight' ? 'none' : 'lineHeight')}>
                      <span className="text-[10px] text-slate-700">{editor.getAttributes('paragraph').lineHeight || '1.0'}</span> <ChevronDown className="w-3 h-3 text-slate-400" />
                    </Button>
                    {activeMenu === 'lineHeight' && (
                      <div className="absolute top-8 left-0 w-24 z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-1 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                        {[1, 1.15, 1.5, 2, 2.5, 3].map(h => (
                          <button key={h} onClick={() => { (editor.commands as any).setLineHeight(h.toString()); setActiveMenu('none'); }} className="flex w-full text-left text-[11px] p-1.5 rounded-sm cursor-pointer hover:bg-blue-50">
                            {h.toFixed(2)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1 self-center">Paragraph</span>
            </div>

            <div className="flex flex-col h-full border-r border-slate-200 px-3 py-1 group/ribbon">
              <div className="flex flex-col gap-1 flex-grow">
                {/* Row 1: Multimedia & Structural Shapes */}
                <div className="flex gap-0.5 items-center">
                  <div className="relative">
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 hover:bg-slate-100 rounded-sm text-[11px] font-normal gap-1" onClick={() => setActiveMenu(a => a === 'shapes' ? 'none' : 'shapes')}>
                      <PenTool className="h-3.5 w-3.5 text-orange-600" /> <span>Shapes</span>
                    </Button>
                    {activeMenu === 'shapes' && (
                      <div className="absolute top-8 left-0 w-[200px] z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-2 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                        <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 block border-b pb-1">Drawing Shapes</span>
                        <div className="grid grid-cols-4 gap-1">
                          {SHAPES.map(shape => (
                            <button key={shape.name} title={shape.name} onClick={() => { (editor as any).chain().focus().insertPicture({ src: `data:image/svg+xml;base64,${btoa(shape.svg)}`, x: 150, y: 150 }).run(); setActiveMenu('none'); }} className="p-1 hover:bg-slate-100 rounded transition-colors">
                               <div className="w-6 h-6" dangerouslySetInnerHTML={{ __html: shape.svg.replace('width="100"', 'width="100%"').replace('height="100"', 'height="100%"') }} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => (editor as any).chain().focus().insertCustomHorizontalRule().run()} className="h-6 px-1.5 hover:bg-slate-100 rounded-sm text-[11px] font-normal gap-1">
                    <MinusCircle className="h-3.5 w-3.5 text-black" /> <span>Line</span>
                  </Button>
                  <div className="relative">
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 hover:bg-slate-100 rounded-sm text-[11px] font-normal gap-1" onClick={() => setActiveMenu(a => a === 'symbols' ? 'none' : 'symbols')}>
                      <Code className="h-3.5 w-3.5 text-purple-600" /> <span>Symbol</span>
                    </Button>
                    {activeMenu === 'symbols' && (
                       <div className="absolute top-8 left-0 w-[145px] z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-2 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                          <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 block border-b pb-1">Mathematical</span>
                          <div className="grid grid-cols-4 gap-1 text-center">
                             {SYMBOLS.map(sym => (
                                 <button key={sym} onClick={() => (editor as any).chain().focus().insertCustomSymbol(sym).run()} className="h-7 w-full flex items-center justify-center text-sm rounded hover:bg-slate-100 transition-colors">{sym}</button>
                             ))}
                          </div>
                       </div>
                    )}
                  </div>
                  <div className="relative">
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 hover:bg-slate-100 rounded-sm text-[11px] font-normal gap-1" onClick={() => document.getElementById('template-header-input')?.focus()}>
                      <LayoutTemplate className="h-3.5 w-3.5 text-slate-500" /> <span>Header</span>
                    </Button>
                  </div>
                </div>

                {/* Row 2: Digital Content & View Scale */}
                <div className="flex gap-1 items-center mt-1 pt-1 border-t border-slate-100/50">
                  <label className="cursor-pointer h-5 px-1.5 flex items-center hover:bg-slate-100 rounded-sm text-[10px] font-bold gap-1 text-emerald-600">
                    <ImageIcon className="h-3 w-3" /> <span>Picture</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => {
                          const result = re.target?.result as string;
                          (editor as any).chain().focus().insertPicture({ src: result, x: 120, y: 120, width: 250, height: 180 }).run();
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => (editor as any).chain().focus().insertCustomTextBox().run()} className="h-5 px-1.5 hover:bg-slate-100 rounded-sm text-[10px] font-bold gap-1 text-slate-600">
                    <Square className="h-3 w-3" /> <span>Text Box</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { const url = window.prompt('URL:'); if (url) editor.chain().focus().setLink({ href: url }).run(); }} className="h-5 px-1.5 hover:bg-slate-100 rounded-sm text-[10px] font-bold gap-1 text-blue-500">
                    <LinkIcon className="h-3 w-3" /> <span>Link</span>
                  </Button>
                   <div className="relative">
                    <Button variant="ghost" size="sm" className="h-5 px-1.5 hover:bg-slate-100 rounded-sm text-[10px] font-bold gap-1 text-slate-500" onClick={() => document.getElementById('template-footer-input')?.focus()}>
                      <LayoutTemplate className="h-3 w-3 text-slate-400 rotate-180" /> <span>Footer</span>
                    </Button>
                  </div>
                  <div className="px-1.5 flex items-center gap-1 min-w-[140px] ml-1 bg-slate-50/80 rounded h-6 border border-slate-200">
                    <span className="text-[9px] font-black uppercase text-slate-500 w-12">Zoom {Math.round(zoom * 100)}%</span>
                    <button className="h-4 w-4 flex items-center justify-center font-bold text-black border rounded hover:bg-slate-200" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>-</button>
                    <input type="range" min="0.5" max="2" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-12 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-black" />
                    <button className="h-4 w-4 flex items-center justify-center font-bold text-black border rounded hover:bg-slate-200" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
                  </div>
                </div>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1 self-center">Insert</span>
            </div>

            {/* Dynamic Table Context Menu */}
            {editor.isActive('table') && (
              <div className="flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 p-1 rounded-sm shadow-sm ml-2 animate-in slide-in-from-left-2">
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addColumnBefore().run()} className="h-6 w-6 p-0 text-emerald-700 bg-white hover:bg-emerald-100" title="Add Column Left"><ArrowLeftToLine className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addColumnAfter().run()} className="h-6 w-6 p-0 text-emerald-700 bg-white hover:bg-emerald-100" title="Add Column Right"><ArrowRightToLine className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addRowBefore().run()} className="h-6 w-6 p-0 text-emerald-700 bg-white hover:bg-emerald-100" title="Add Row Above"><ArrowUpToLine className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().addRowAfter().run()} className="h-6 w-6 p-0 text-emerald-700 bg-white hover:bg-emerald-100" title="Add Row Below"><ArrowDownToLine className="w-3.5 h-3.5" /></Button>
                <div className="w-[1px] h-4 bg-emerald-200 mx-1" />
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().mergeCells().run()} className="h-6 px-2 text-[10px] text-emerald-700 bg-white hover:bg-emerald-100" title="Merge Cells"><GitMerge className="w-3 h-3 mr-1" /> Merge</Button>
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().splitCell().run()} className="h-6 px-2 text-[10px] text-emerald-700 bg-white hover:bg-emerald-100" title="Split Cells"><SplitSquareHorizontal className="w-3 h-3 mr-1" /> Split</Button>
                <div className="w-[1px] h-4 bg-emerald-200 mx-1" />
                <div className="relative">
                  <Button variant="ghost" size="sm" onClick={() => setActiveMenu(a => a === 'tableBorders' ? 'none' : 'tableBorders')} className="h-6 px-2 text-[10px] text-emerald-700 bg-white hover:bg-emerald-100" title="Border Thickness">
                    <span className="w-3 h-3 border-2 border-emerald-700 mr-1" /> Border
                  </Button>
                  {activeMenu === 'tableBorders' && (
                    <div className="absolute top-8 left-0 w-32 z-50 bg-white border border-slate-200 rounded-sm shadow-xl p-1 animate-in fade-in" onMouseLeave={() => setActiveMenu('none')}>
                      {BORDER_WIDTHS.map(bw => (
                        <button key={bw.name} onClick={() => { (editor.commands as any).setTableCellBorderWidth(bw.value); setActiveMenu('none'); }} className="flex w-full items-center justify-between text-left text-[11px] p-1.5 rounded-sm cursor-pointer hover:bg-blue-50">
                          <span>{bw.name}</span>
                          <div className="bg-slate-800" style={{ height: bw.value === '0.5px' ? '1px' : bw.value, width: '30px' }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-[1px] h-4 bg-emerald-200 mx-1" />
                <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteTable().run()} className="h-6 w-6 p-0 text-red-600 bg-white hover:bg-red-50 border border-red-100" title="Delete Table"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. A4 Paper Canvas & Main Content */}
      <div className="flex-grow flex flex-col relative overflow-y-auto" onClick={() => setActiveMenu('none')}>
        {isProcessing && (
          <div className="absolute inset-0 z-[100] bg-slate-900/10 backdrop-blur-sm flex flex-col items-center justify-center p-10">
            <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center">
              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
              <span className="text-xs font-black uppercase text-indigo-600">Processing Document... {procProgress}%</span>
            </div>
          </div>
        )}

        {isHtmlMode ? (
          <textarea className="flex-grow w-full p-8 text-sm font-mono focus:outline-none resize-none bg-slate-900 text-emerald-400" value={htmlContent} onChange={(e) => { setHtmlContent(e.target.value); onChange?.(buildFinalHtml(e.target.value, headerHtml, footerHtml)); }} />
        ) : (
          <div className="py-12 px-20 shadow-inner focus:outline-none bg-slate-200/50 flex flex-col items-center min-w-max">

            {/* A4 PAPER WRAPPER */}
            <div
              className="bg-white shadow-xl ring-1 ring-slate-200 transition-all outline-none relative flex flex-col group/canvas"
              style={{
                width: orientation === 'portrait' ? '210mm' : '297mm',
                minHeight: orientation === 'portrait' ? '297mm' : '210mm',
                marginBottom: '60px',
                padding: currentMarginValue,
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
              }}
            >
              {/* Header Section (MS Word Style) */}
              <div 
                className={cn(
                  "absolute top-0 left-0 right-0 h-24 border-b-2 border-dashed flex flex-col justify-end px-12 pb-4 transition-all z-[60] cursor-text",
                  "bg-slate-50/80 border-blue-200 group-hover/canvas:visible opacity-100",
                  !headerHtml && "hover:bg-blue-50/50"
                )}
                onClick={() => document.getElementById('template-header-input')?.focus()}
              >
                <div className="flex justify-between items-center mb-1">
                   <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                     <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Header Area</span>
                   </div>
                   <div className="flex gap-2">
                     <button className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-opacity bg-blue-50 px-2 py-0.5 rounded" onClick={(e) => { 
                       e.stopPropagation(); 
                       const logoHtml = `<table style="width:100%; border-collapse:collapse;">
  <tr>
    <td style="width:120px; vertical-align:top;">
      {{#if company_logo}}
      <img src="{{company_logo}}" crossorigin="anonymous" style="height:70px; max-width:160px; object-fit:contain;" />
      {{/if}}
    </td>
    <td style="vertical-align:top;">
      <h2 style="margin:0;">{{company_name}}</h2>
      <p style="margin:2px 0;">{{company_address}}</p>
      <p style="margin:2px 0;">Email: {{company_email}} | Phone: {{company_phone}}</p>
      <p style="margin:2px 0;">GSTIN: {{company_gstin}}</p>
    </td>
  </tr>
</table>`;
                       executeHeaderFooterSave(logoHtml, footerHtml); 
                     }}>Insert Logo Header</button>
                     <button className="text-[9px] font-black uppercase text-red-500 hover:text-red-700 opacity-0 group-hover/canvas:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); executeHeaderFooterSave('', footerHtml); }}>Clear</button>
                   </div>
                </div>
                <textarea 
                  id="template-header-input"
                  className="bg-transparent text-xs w-full h-16 focus:outline-none text-slate-700 font-mono resize-none placeholder:text-slate-300 placeholder:italic placeholder:font-sans"
                  placeholder="Enter HTML for header..."
                  value={headerHtml}
                  onChange={e => executeHeaderFooterSave(e.target.value, footerHtml)}
                />
              </div>

              {/* Spacing for Header in editor */}
              <div className="h-24 shrink-0" />

              {/* Editor Content Canvas */}
              <EditorContent
                editor={editor}
                className="prose prose-slate max-w-none flex-grow custom-editor-content outline-none pt-2 mt-4"
                onClick={() => setIsHtmlMode(false)}
              />

              {/* Spacing for Footer in editor */}
              <div className="h-24 shrink-0" />

              {/* Footer Section (MS Word Style) */}
              <div 
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-24 border-t-2 border-dashed flex flex-col justify-start px-12 pt-4 transition-all z-[60] cursor-text",
                  "bg-slate-50/80 border-blue-200 group-hover/canvas:visible opacity-100",
                  !footerHtml && "hover:bg-blue-50/50"
                )}
                onClick={() => document.getElementById('template-footer-input')?.focus()}
              >
                <div className="flex justify-between items-center mt-2 mb-1">
                   <div className="flex gap-2">
                     <button className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-700 flex items-center gap-1 group/btn" onClick={(e) => { e.stopPropagation(); executeHeaderFooterSave(headerHtml, footerHtml + " Page {page}"); }}> 
                        <FilePlus2 className="w-2.5 h-2.5 transition-transform group-hover/btn:scale-125" /> ADD PAGE NUMBER
                     </button>
                     <button className="text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-800 transition-opacity bg-emerald-50 px-2 py-0.5 rounded" onClick={(e) => { 
                       e.stopPropagation(); 
                       const footerBrandingHtml = `<table style="width:100%; border-collapse:collapse; margin-top:20px;">
  <tr>
    <td style="width:33%; text-align:left; vertical-align:bottom;">
      {{#if company_seal}}
      <img src="{{company_seal}}" crossorigin="anonymous" style="height:80px; max-width:130px; object-fit:contain;" />
      <div style="font-size:10px; color:#64748b; margin-top:5px;">Company Seal</div>
      {{/if}}
    </td>
    <td style="width:34%; text-align:center; vertical-align:bottom;">
      {{#if company_signature}}
      <img src="{{company_signature}}" crossorigin="anonymous" style="height:60px; max-width:160px; object-fit:contain;" />
      {{/if}}
    </td>
    <td style="width:33%; text-align:right; vertical-align:bottom;">
      <div style="font-size:14px; font-weight:bold; color:#1e293b; margin-top:5px;">For {{company_name}}</div>
      <div style="font-size:10px; color:#64748b;">Authorised Signatory</div>
    </td>
  </tr>
</table>`;
                       executeHeaderFooterSave(headerHtml, footerBrandingHtml); 
                     }}>Insert Seal & Signature</button>
                     <button className="text-[9px] font-black uppercase text-red-500 hover:text-red-700 opacity-0 group-hover/canvas:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); executeHeaderFooterSave(headerHtml, ''); }}>Clear</button>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Footer Area</span>
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                   </div>
                </div>
                <textarea 
                  id="template-footer-input"
                  className="bg-transparent text-xs w-full h-24 focus:outline-none text-slate-700 font-mono resize-none placeholder:text-slate-300 placeholder:italic placeholder:font-sans"
                  placeholder="Enter HTML for footer (e.g. Registered Office, CIN, Seal, Signature)..."
                  value={footerHtml}
                  onChange={e => executeHeaderFooterSave(headerHtml, e.target.value)}
                />
              </div>

            </div>

          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLES }} />
    </div>
  );
}
