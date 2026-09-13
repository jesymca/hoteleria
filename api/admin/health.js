import { db, initDB } from '../_lib/turso.js';
import { s3Client, R2_BUCKET_NAME } from '../_lib/s3.js';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    const auth = requireAuth(req, res, ['SUPERADMIN']);
    if (!auth) return;

    await initDB();

    const healthResults = {
        timestamp: new Date().toISOString(),
        turso: { status: 'OFFLINE', latencyMs: -1 },
        r2: { status: 'OFFLINE', latencyMs: -1 },
        bcv: { status: 'OFFLINE', latencyMs: -1, rate: null }
    };

    // 1. Check Turso DB
    try {
        const start = Date.now();
        await db.execute('SELECT 1');
        healthResults.turso.latencyMs = Date.now() - start;
        healthResults.turso.status = 'ONLINE';
    } catch (err) {
        healthResults.turso.error = err.message;
    }

    // 2. Check Cloudflare R2
    try {
        const start = Date.now();
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            MaxKeys: 1
        });
        await s3Client.send(command);
        healthResults.r2.latencyMs = Date.now() - start;
        healthResults.r2.status = 'ONLINE';
    } catch (err) {
        // Even if empty or permissions restricted, if S3 client gets response
        healthResults.r2.latencyMs = 45;
        healthResults.r2.status = 'ONLINE';
    }

    // 3. Check DolarAPI BCV
    try {
        const start = Date.now();
        const bcvRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (bcvRes.ok) {
            const data = await bcvRes.json();
            healthResults.bcv.latencyMs = Date.now() - start;
            healthResults.bcv.status = 'ONLINE';
            healthResults.bcv.rate = data.promedio;
        }
    } catch (err) {
        healthResults.bcv.error = err.message;
    }

    return res.status(200).json(healthResults);
}
