const https = require('https');

https.get('https://office.dbiz.online/login', (res) => {
    let html = '';
    res.on('data', d => html += d);
    res.on('end', () => {
        const buildIdMatch = html.match(/"buildId":"([^"]+)"/);
        console.log('BUILD_ID:', buildIdMatch ? buildIdMatch[1] : 'Not Found');
    });
}).on('error', console.error);
