import { s3Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from './_lib/s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const auth = requireAuth(req, res);
    if (!auth) return;

    const urlPath = req.url || '';

    // Route: Fallback Direct Serverless Upload (bypasses browser CORS & attempts R2 PutObjectCommand directly from server)
    if (urlPath.includes('/fallback-upload')) {
        try {
            const { destinationPath, base64Data, mimeType } = req.body || {};
            if (!destinationPath || !base64Data) {
                return res.status(400).json({ error: 'destinationPath y base64Data son requeridos.' });
            }

            // Extract base64 buffer
            const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Content, 'base64');

            try {
                // Try Server-side R2 upload
                const command = new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: destinationPath,
                    Body: buffer,
                    ContentType: mimeType || 'image/webp'
                });
                await s3Client.send(command);

                return res.status(200).json({
                    publicUrl: `${R2_PUBLIC_URL}/${destinationPath}`,
                    storage: 'CLOUDFLARE_R2'
                });
            } catch (r2Err) {
                console.warn('Server-side R2 Upload failed (check R2_ACCESS_KEY_ID & R2_SECRET_ACCESS_KEY):', r2Err.message);
                // Return Data URL fallback so the UI never breaks
                return res.status(200).json({
                    publicUrl: base64Data,
                    storage: 'DATA_URL_FALLBACK'
                });
            }
        } catch (err) {
            console.error('Fallback upload error:', err);
            return res.status(500).json({ error: 'Error al procesar la carga de imagen.' });
        }
    }

    // Default Route: Presigned URL generation for client-side direct upload
    try {
        const { mimeType, destinationPath } = req.body || {};
        if (!destinationPath || !mimeType) {
            return res.status(400).json({ error: 'Se requiere destinationPath y mimeType.' });
        }

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: destinationPath,
            ContentType: mimeType
        });

        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
        const publicUrl = `${R2_PUBLIC_URL}/${destinationPath}`;

        return res.status(200).json({
            presignedUrl,
            publicUrl
        });
    } catch (err) {
        console.error('Presigned URL error:', err);
        return res.status(500).json({ error: 'Error al generar la URL firmada de Cloudflare R2.' });
    }
}
