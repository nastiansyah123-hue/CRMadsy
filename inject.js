const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

const envScript = `
    <script>
        window.ENV = {
            DATA_SUPABASE_URL: '${process.env.DATA_SUPABASE_URL || ''}',
            DATA_SUPABASE_KEY: '${process.env.DATA_SUPABASE_KEY || ''}',
            APP_SUPABASE_URL: '${process.env.APP_SUPABASE_URL || ''}',
            APP_SUPABASE_KEY: '${process.env.APP_SUPABASE_KEY || ''}'
        };
    </script>
`;

const newHtml = html.replace('</head>', `${envScript}</head>`);

fs.writeFileSync('index.html', newHtml);
console.log('✅ Environment variables injected');
