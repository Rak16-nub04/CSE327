const mongoose = require('mongoose');
const https = require('https');
require('dotenv').config();

const uri = process.env.MONGO_URI;

function getPublicIP() {
    return new Promise((resolve, reject) => {
        https.get('https://api.ipify.org?format=json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data).ip);
                } catch (e) {
                    resolve('Unknown');
                }
            });
        }).on('error', (err) => {
            resolve('Unknown');
        });
    });
}

async function check() {
    console.log('--- System Check ---');
    
    // 1. Check IP
    const ip = await getPublicIP();
    console.log(`[INFO] Your Public IP: ${ip}`);
    
    // 2. Check DB
    console.log('[INFO] Testing MongoDB Connection...');
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('[SUCCESS] MongoDB Connected successfully!');
    } catch (err) {
        console.log('[ERROR] MongoDB Connection Failed');
        if (err.message.includes('SSL') || err.message.includes('buffering timed out')) {
            console.log('   -> CAUSE: Likely IP Whitelist issue.');
            console.log(`   -> ACTION: Go to MongoDB Atlas -> Network Access -> Add IP Address -> Add ${ip}`);
        } else {
            console.log(`   -> CAUSE: ${err.message}`);
        }
    } finally {
        // We don't need to keep the connection open for this check
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
    console.log('--------------------');
}

check();
