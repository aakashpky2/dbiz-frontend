const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'dashboard', 'recruitment', 'scheduled', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Candidate interface
if (!content.includes('dynamicFields?: Record<string, any>;')) {
    content = content.replace(/interviewRound\?: string;/, 'interviewRound?: string;\n    dynamicFields?: Record<string, any>;');
}

// 2. Update mapping in fetchScheduled
if (!content.includes('dynamicFields: d.dynamic_fields')) {
    content = content.replace(/date: d\.date/, 'date: d.date,\n                dynamicFields: d.dynamic_fields');
}

// 3. Update openFeedback
if (!content.includes('form.setValue("dynamic_fields"')) {
    content = content.replace(/form\.setValue\("interviewRound", candidate\.interviewRound \|\| \(rounds\[0\]\?\.name \|\| ""\)\);/,
        'form.setValue("interviewRound", candidate.interviewRound || (rounds[0]?.name || ""));\n        form.setValue("dynamic_fields", candidate.dynamicFields || {});');
}

fs.writeFileSync(filePath, content);
console.log('Finalized scheduled/page.tsx with data loading');
