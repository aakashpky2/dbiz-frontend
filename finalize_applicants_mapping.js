const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'dashboard', 'recruitment', 'applicants', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update form names in standard sections (if already injected by previous script)
content = content.replace(/formName="Application Form"/g, 'formName="Job Application Form"');
content = content.replace(/formName="Candidate Profile"/g, 'formName="Candidate Profile Form"');

// 2. Add "Applicant Review Form" to the edit dialog after the existing "Candidate Profile Form"
const editDynamicLoc = '<DynamicFieldsSection formName="Candidate Profile Form" control={editForm.control} />';
const editReplacement = `${editDynamicLoc}\n                                    <DynamicFieldsSection formName="Applicant Review Form" control={editForm.control} />`;
if (content.includes(editDynamicLoc) && !content.includes('Applicant Review Form')) {
    content = content.replace(editDynamicLoc, editReplacement);
}

// 3. Add "Interview Scheduling Form" inside the conditional scheduling block in Edit Dialog
const schedulingInsertionPoint = '<FormMessage />\n                                                    </FormItem>\n                                                )}\n                                            />\n                                        </div>\n                                    )}';

const schedulingReplacement = `<FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <DynamicFieldsSection formName="Interview Scheduling Form" control={editForm.control} />
                                        </div>
                                    )}`;

if (!content.includes('formName="Interview Scheduling Form"')) {
    content = content.replace(schedulingInsertionPoint, schedulingReplacement);
}

fs.writeFileSync(filePath, content);
console.log('Finalized dynamic form mappings in applicants/page.tsx');
