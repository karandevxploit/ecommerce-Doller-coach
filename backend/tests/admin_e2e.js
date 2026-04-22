const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION
// ==========================================
const BASE_URL = 'http://localhost:3000';
const ADMIN_CREDENTIALS = {
    email: 'karanyadav.hack.dev@gmail.com',
    password: 'Karan@1234'
};
const PAGES_TO_TEST = [
    { name: 'Dashboard', url: '/admin/dashboard' },
    { name: 'Products', url: '/admin/products' },
    { name: 'Orders', url: '/admin/orders' },
    { name: 'Users', url: '/admin/users' }
];

const REPORT_DIR = path.join(__dirname, '../reports/e2e');
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

// ==========================================
// MAIN TEST RUNNER
// ==========================================
async function runE2ETests() {
    console.log('🚀 Starting Admin E2E Testing System...');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    const results = [];
    const logs = [];

    // Logger Helper
    const log = (msg) => {
        const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
        console.log(entry);
        logs.push(entry);
    };

    try {
        // 1. Monitor Console and Network
        page.on('console', msg => {
            if (msg.type() === 'error') log(`Console Error: ${msg.text()}`);
        });

        page.on('response', response => {
            if (response.status() >= 400) {
                log(`API Failure: ${response.url()} [${response.status()}]`);
            }
        });

        // 2. Navigation to Login
        log(`Navigating to ${BASE_URL}/admin/login...`);
        await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });

        // 3. Login Flow
        log('Attempting login...');
        await page.waitForSelector('input[type="email"]');
        await page.type('input[type="email"]', ADMIN_CREDENTIALS.email);
        await page.type('input[type="password"]', ADMIN_CREDENTIALS.password);
        
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        log('Login successful. Starting page crawl...');

        // 4. Visit All Pages
        for (const target of PAGES_TO_TEST) {
            const startTime = Date.now();
            let status = 'PASSED';
            let error = null;

            log(`Testing Page: ${target.name} (${target.url})...`);

            try {
                await page.goto(`${BASE_URL}${target.url}`, { waitUntil: 'networkidle2', timeout: 30000 });
                
                // Detect "Failed to load" or common error patterns
                const content = await page.content();
                const errorPatterns = ['Failed to load', 'Internal Server Error', '404', 'Unauthorized'];
                
                for (const pattern of errorPatterns) {
                    if (content.includes(pattern)) {
                        throw new Error(`Error pattern detected: "${pattern}"`);
                    }
                }

                const loadTime = Date.now() - startTime;
                results.push({ ...target, status, loadTime, error: null });
                log(`✅ ${target.name} loaded in ${loadTime}ms`);

            } catch (err) {
                status = 'FAILED';
                error = err.message;
                log(`❌ ${target.name} FAILED: ${err.message}`);
                
                const screenshotPath = path.join(REPORT_DIR, `error_${target.name.toLowerCase()}.png`);
                await page.screenshot({ path: screenshotPath });
                results.push({ ...target, status, loadTime: Date.now() - startTime, error, screenshot: screenshotPath });
            }
        }

    } catch (err) {
        log(`CRITICAL ERROR: ${err.message}`);
    } finally {
        // 5. Generate Report
        generateReport(results, logs);
        console.log('\n🏁 Test Run Finished. Closing browser...');
        await browser.close();
    }
}

function generateReport(results, logs) {
    const reportPath = path.join(REPORT_DIR, `report_${Date.now()}.json`);
    const txtPath = path.join(REPORT_DIR, `logs_${Date.now()}.txt`);

    const summary = {
        total: results.length,
        passed: results.filter(r => r.status === 'PASSED').length,
        failed: results.filter(r => r.status === 'FAILED').length,
        results
    };

    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    fs.writeFileSync(txtPath, logs.join('\n'));

    console.log('\n==========================================');
    console.log('            E2E TEST REPORT               ');
    console.log('==========================================');
    console.log(`Total Pages:  ${summary.total}`);
    console.log(`Passed:       ${summary.passed} ✅`);
    console.log(`Failed:       ${summary.failed} ❌`);
    console.log('------------------------------------------');
    
    results.forEach(r => {
        const mark = r.status === 'PASSED' ? '✅' : '❌';
        console.log(`${mark} ${r.name.padEnd(12)} | ${r.loadTime}ms | ${r.error || 'Clean'}`);
    });
    console.log('==========================================');
    console.log(`Full Log: ${txtPath}`);
}

runE2ETests();
