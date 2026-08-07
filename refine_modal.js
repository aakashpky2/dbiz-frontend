const fs = require('fs');

let content = fs.readFileSync('src/components/dashboard/master-data/MasterValueDialog.tsx', 'utf8');

// 1. DialogContent
content = content.replace(
  /<DialogContent className=\{cn\("transition-all duration-300 max-h-\[90vh\] flex flex-col overflow-hidden", isConstitutionCategory && isGroup \? "sm:max-w-3xl" : "sm:max-w-xl"\)\}>/,
  '<DialogContent className={cn("flex max-h-[88vh] flex-col overflow-hidden rounded-2xl border shadow-xl p-0 gap-0", isConstitutionCategory && isGroup ? "sm:max-w-[900px]" : "sm:max-w-[640px]")}>'
);

// 2. DialogHeader
content = content.replace(
  /<DialogHeader className="border-b pb-4 shrink-0">/,
  '<DialogHeader className="shrink-0 px-6 pt-6 pb-5 border-b">'
);
content = content.replace(
  /<DialogTitle className="text-xl">/,
  '<DialogTitle className="text-xl font-semibold tracking-tight text-foreground">'
);
content = content.replace(
  /<DialogDescription>/,
  '<DialogDescription className="text-sm text-muted-foreground mt-1">'
);

// 3. Form Body
content = content.replace(
  /<div className="space-y-4 py-2 px-1 flex-1 overflow-y-auto -mx-1">/,
  '<div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-5 space-y-5">'
);

// 4. Footer
content = content.replace(
  /<DialogFooter className="border-t pt-4 mt-4 shrink-0">/,
  '<DialogFooter className="shrink-0 border-t px-6 py-4 flex justify-end gap-3 bg-muted/10">'
);
content = content.replace(
  /<Button variant="ghost" onClick=\{\(\) => onOpenChange\(false\)\}>Cancel<\/Button>/,
  '<Button variant="outline" className="h-10 px-5 rounded-lg" onClick={() => onOpenChange(false)}>Cancel</Button>'
);
content = content.replace(
  /<Button \n                        onClick=\{handleSave\} \n                        disabled=\{/,
  '<Button className="h-10 px-5 rounded-lg font-medium"\n                        onClick={handleSave} \n                        disabled={'
);

// 5. Config Type / Segmented Control
content = content.replace(
  /<div className="flex items-center gap-4">\s*<Label className="text-xs font-bold uppercase text-muted-foreground mr-2">Config Type:<\/Label>\s*<div className="flex items-center space-x-2">\s*<Button type="button" variant=\{!isGroup \? "secondary" : "outline"\} size="sm" onClick=\{\(\) => setIsGroup\(false\)\}>Single Field<\/Button>\s*<Button type="button" variant=\{isGroup \? "secondary" : "outline"\} size="sm" onClick=\{\(\) => setIsGroup\(true\)\}>Field Group<\/Button>\s*<\/div>\s*<\/div>/,
  `<div className="flex items-center gap-4">
                                <Label className="text-xs font-semibold text-muted-foreground mr-2">Config Type</Label>
                                <div className="inline-flex items-center rounded-lg bg-muted p-1 h-9">
                                    <Button type="button" variant="ghost" size="sm" className={cn("h-7 px-4 text-sm rounded-md transition-all", !isGroup ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground")} onClick={() => setIsGroup(false)}>Single Field</Button>
                                    <Button type="button" variant="ghost" size="sm" className={cn("h-7 px-4 text-sm rounded-md transition-all", isGroup ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground")} onClick={() => setIsGroup(true)}>Field Group</Button>
                                </div>
                            </div>`
);

// 6. Section & Field Label Fixes
content = content.replace(/text-xs font-bold uppercase text-muted-foreground/g, "text-xs font-semibold text-muted-foreground");
content = content.replace(/text-\[10px\] uppercase font-bold/g, "text-xs font-semibold");

content = content.replace(/Field Name \(e\.g\. GST Number\)/, "Field Name");
content = content.replace(/Dynamic Fields Section/i, "Dynamic Fields");

content = content.replace(/<Label className="text-xs font-semibold text-muted-foreground mr-2">Config Type:<\/Label>/, '<Label className="text-xs font-semibold text-muted-foreground mr-2">Config Type</Label>');
content = content.replace(/Field Type<\/Label>/g, "Field Type</Label>");
content = content.replace(/Input Control Type<\/Label>/g, "Input Control Type</Label>");
content = content.replace(/Requirement<\/Label>/g, "Requirement</Label>");
content = content.replace(/Max Length<\/Label>/g, "Max Length</Label>");
content = content.replace(/Field Applicability<\/Label>/g, "Field Applicability</Label>");
content = content.replace(/Button Display Order<\/Label>/g, "Button Display Order</Label>");
content = content.replace(/Display \/ Field Order<\/Label>/g, "Display / Field Order</Label>");

content = content.replace(/<p className="text-\[10px\] text-muted-foreground italic">Specify where this automatic field should be implemented\.<\/p>/, '<p className="text-xs text-muted-foreground mt-1.5">Specify where this automatic field should be implemented.</p>');

// 7. Inputs
content = content.replace(/<Input id="vname"/, '<Input className="h-10 rounded-lg text-sm" id="vname"');
content = content.replace(/<SelectTrigger id="vname" className="h-10">/, '<SelectTrigger id="vname" className="h-10 rounded-lg text-sm">');
content = content.replace(/<Input id="vdesc"/, '<Input className="h-10 rounded-lg text-sm" id="vdesc"');
content = content.replace(/<Input id="vorder"/, '<Input className="h-10 rounded-lg text-sm" id="vorder"');

content = content.replace(/<SelectTrigger><SelectValue \/><\/SelectTrigger>/g, '<SelectTrigger className="h-10 rounded-lg text-sm"><SelectValue /></SelectTrigger>');
content = content.replace(/<Input type="number" value=\{maxLength\}/, '<Input type="number" className="h-10 rounded-lg text-sm" value={maxLength}');
content = content.replace(/<Input type="number" value=\{valueOrder\}/, '<Input type="number" className="h-10 rounded-lg text-sm" value={valueOrder}');


// 8. Single Field Mode Grid Spacing
content = content.replace(/<div className="grid grid-cols-2 gap-4">/, '<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">');


// 9. Field Group Individual Cards
content = content.replace(/className="space-y-4 border rounded-xl p-4 bg-muted\/10"/, 'className="space-y-4 rounded-xl border bg-card p-5"');
content = content.replace(/className="flex flex-col gap-3 border border-muted\/60 p-4 pt-5 rounded-lg relative bg-white transition-all group shadow-sm hover:shadow-md"/g, 'className="flex flex-col gap-4 border rounded-xl bg-card p-5 shadow-sm relative group"');
content = content.replace(/className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive\/10 opacity-0 group-hover:opacity-100 transition-opacity"/g, 'className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"');

// 10. Add Field & Preset Buttons
content = content.replace(
  /<Button\s*type="button"\s*size="sm"\s*variant="outline"\s*className="h-6 text-\[10px\] px-2 font-black uppercase tracking-widest border-emerald-500\/40 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:border-emerald-500 transition-all rounded-lg"/,
  '<Button type="button" size="sm" variant="outline" className="h-9"'
);
content = content.replace(
  /<Button type="button" size="sm" variant="outline" onClick=\{\(\) => setGroupFields/,
  '<Button type="button" size="sm" variant="secondary" className="h-9" onClick={() => setGroupFields'
);


// 11. Field Group Layout Inside Card
content = content.replace(
  /<div className="grid grid-cols-12 gap-3 pr-6">[\s\S]*?<\/div>\s*<div className="grid grid-cols-12 gap-3 pr-6">/g,
  (match) => {
     let m = match;
     m = m.replace(/<div className="grid grid-cols-12 gap-3 pr-6">/g, '<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pr-8">');
     m = m.replace(/col-span-12 sm:col-span-5/g, 'md:col-span-2');
     m = m.replace(/col-span-6 sm:col-span-4/g, '');
     m = m.replace(/col-span-6 sm:col-span-3/g, '');
     m = m.replace(/col-span-6 sm:col-span-5/g, '');
     m = m.replace(/col-span-3 sm:col-span-3/g, '');
     m = m.replace(/col-span-3 sm:col-span-4/g, '');
     m = m.replace(/className="h-8 text-xs font-semibold"/g, 'className="h-10 text-sm rounded-lg"');
     m = m.replace(/className="h-8 text-xs px-2\.5 bg-muted\/5"/g, 'className="h-10 text-sm rounded-lg px-3 bg-transparent"');
     m = m.replace(/className="h-8 text-xs bg-muted\/5 font-mono"/g, 'className="h-10 text-sm rounded-lg bg-transparent font-mono"');
     m = m.replace(/text-muted-foreground">Data Type/g, 'text-muted-foreground">Data Type');
     m = m.replace(/text-muted-foreground">Requirement/g, 'text-muted-foreground">Requirement');
     m = m.replace(/text-muted-foreground">Input Protocol/g, 'text-muted-foreground">Input Control');
     return m;
  }
);
content = content.replace(
  /<Input className="h-8 text-xs bg-primary\/5 border-primary\/20" placeholder="e\.g\. Do you have a PAN card\?"/,
  '<Input className="h-10 rounded-lg text-sm" placeholder="e.g. Do you have a PAN card?"'
);
content = content.replace(/text-primary">Conditional Question/g, 'text-primary">Conditional Question');


// 12. Permissions Modal
content = content.replace(/<Label className="text-xs font-semibold text-muted-foreground block mb-2">Configure Actions for \{valueName \|\| 'Module'\}/, '<Label className="text-xs font-semibold text-muted-foreground block mb-2">Configure Actions for {valueName || \'Module\'}');
content = content.replace(/className="flex flex-wrap gap-2 p-3 rounded-xl border-2 bg-muted\/5 min-h-\[50px\]"/, 'className="flex flex-wrap gap-2 p-3 rounded-xl border bg-card min-h-[60px]"');
content = content.replace(/className="h-8 pl-3 pr-1 py-1 rounded-lg font-black text-xs uppercase tracking-widest bg-white border shadow-sm"/g, 'className="h-7 pl-3 pr-1 py-1 rounded-md font-medium text-xs bg-muted text-foreground border shadow-sm"');
content = content.replace(/className="h-8 border-none bg-transparent shadow-none focus-visible:ring-0 text-xs font-bold uppercase tracking-widest px-0"/, 'className="h-7 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm px-0"');
content = content.replace(/placeholder="Add action \(e\.g\. print\)"/, 'placeholder="Add an action, then press Enter"');
content = content.replace(/<p className="text-\[10px\] font-medium text-muted-foreground opacity-60">Press enter to add custom actions\.<\/p>/, '');


// 13. Country / Country Codes Modals
content = content.replace(/<div className="flex items-center justify-between border rounded-lg p-3 bg-muted\/5 shadow-sm">/, '<div className="flex items-center justify-between border-b pb-4 mb-4">');
content = content.replace(
    /<Label className="text-xs font-semibold text-muted-foreground">\s*Set as Default\s*<\/Label>/,
    '<div className="space-y-1"><Label className="text-sm font-medium">Set as Default</Label><p className="text-xs text-muted-foreground">Use this value as the default option.</p></div>'
);
// Make the button look like a compact toggle
content = content.replace(
    /<Button\s*type="button"\s*size="sm"\s*variant=\{isDefault \? "secondary" : "outline"\}\s*onClick=\{\(\) => setIsDefault\(prev => !prev\)\}\s*>\s*\{isDefault \? "Default Selected" : "Mark as Default"\}\s*<\/Button>/,
    '<Button type="button" size="sm" variant={isDefault ? "default" : "secondary"} className="h-8 px-4 rounded-full" onClick={() => setIsDefault(prev => !prev)}>{isDefault ? "Enabled" : "Disabled"}</Button>'
);
content = content.replace(/Dial Code <span className="text-\[10px\] font-medium text-slate-400 font-mono">\(e\.g\. 91\)<\/span>/, 'Dial Code <span className="text-xs font-medium text-muted-foreground">(e.g. 91)</span>');
content = content.replace(/className="font-mono text-blue-600 font-bold"/, 'className="h-10 rounded-lg text-sm font-mono font-medium"');

fs.writeFileSync('src/components/dashboard/master-data/MasterValueDialog.tsx', content);
console.log('Modifications applied.');
