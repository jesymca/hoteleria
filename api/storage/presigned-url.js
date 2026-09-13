import { s3Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '../_lib/s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const auth = requireAuth(req, res);
    if (!auth) return;

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

        // 15-minute expiration
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
