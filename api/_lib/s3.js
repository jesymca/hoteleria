import { S3Client } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID || 'da7c23add0ce839e4989c068fbfa4394';
const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

export const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId,
        secretAccessKey
    }
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'hoteleria';
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-49558c729b6b41ec952687ab33845c74.r2.dev';
