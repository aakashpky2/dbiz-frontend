const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const lockedPages = [
    'dashboard/admin/business-constitutions',
    'dashboard/profile',
    'dashboard/admin/department-management',
    'dashboard/admin/user-management',
    'dashboard/admin/system-roles'
];

const dashboardDir = path.join(process.cwd(), 'src/app/dashboard');

let totalPages = 0;
let customLocked = 0;
let pageHeroPages = 0;
let redirectPages = 0;
let remainingPages = [];

const table = [];

walkDir(dashboardDir, (filePath) => {
    if (!filePath.endsWith('page.tsx')) return;
    
    // exclude nested non-page.tsx components if any are caught (none should be since we check endsWith)
    
    const relativePath = path.relative(dashboardDir, filePath).replace(/\\/g, '/');
    const route = '/dashboard/' + relativePath.replace('/page.tsx', '');
    
    // 5 Locked custom pages
    const isLocked = lockedPages.some(l => route.includes(l));
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    let headerType = 'Unknown';
    let hasPageHero = content.includes('PageHero');
    let hasDashboardPageHeader = content.includes('DashboardPageHeader');
    
    // Check if redirect
    let isRedirect = content.includes('redirect(') && !content.includes('<div'); 
    // Basic heuristic for redirect-only page
    if (content.match(/return\s+redirect\(/) && content.length < 500) {
        isRedirect = true;
    }

    if (isRedirect) {
        headerType = 'Redirect/Helper';
        redirectPages++;
    } else if (isLocked) {
        headerType = 'Custom Locked';
        customLocked++;
    } else if (hasPageHero) {
        headerType = 'PageHero';
        pageHeroPages++;
    } else if (hasDashboardPageHeader) {
        headerType = 'DashboardPageHeader';
        remainingPages.push(route);
    } else {
        headerType = 'Manual/Other';
        remainingPages.push(route);
    }
    
    if (!isRedirect) {
        totalPages++;
    }

    table.push({
        Route: route,
        'Page File': relativePath,
        'Current Header Type': headerType,
        'PageHero?': hasPageHero ? 'Yes' : 'No',
        'Approved Custom Hero?': isLocked ? 'Yes' : 'No',
        'Action Required': (headerType === 'DashboardPageHeader' || headerType === 'Manual/Other') ? 'MIGRATE' : 'NONE'
    });
});

console.log('--- FINAL COVERAGE AUDIT ---');
console.log('Route | Current Header Type | PageHero? | Approved Custom Hero? | Action Required');
console.log('---|---|---|---|---');
table.forEach(r => {
    console.log(`${r.Route} | ${r['Current Header Type']} | ${r['PageHero?']} | ${r['Approved Custom Hero?']} | ${r['Action Required']}`);
});

console.log('\n--- SUMMARY ---');
console.log(`TOTAL USER-FACING PAGES: ${totalPages}`);
console.log(`CUSTOM LOCKED HEROES: ${customLocked}`);
console.log(`PAGEHERO PAGES: ${pageHeroPages}`);
console.log(`REDIRECT/NO-HEADER PAGES: ${redirectPages}`);
console.log(`REMAINING PAGES TO MIGRATE: ${remainingPages.length}`);
if (remainingPages.length > 0) {
    console.log('Routes to migrate:');
    remainingPages.forEach(r => console.log(' - ' + r));
}
