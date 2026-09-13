// Uploader module using HTML5 Canvas Compression and Cloudflare R2 Presigned URLs
import { API } from './api.js';

export const Uploader = {
    async compressImage(file, maxWidth = 800, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/webp';
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve({ blob, mimeType, extension: mimeType === 'image/png' ? 'png' : 'webp' });
                            } else {
                                reject(new Error('Fallo al comprimir la imagen.'));
                            }
                        },
                        mimeType,
                        quality
                    );
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    },

    async uploadToR2(file, destinationPath) {
        // 1. Compress Client Side via Canvas
        const compressed = await this.compressImage(file);

        // 2. Request Presigned URL from Backend API
        const presignedData = await API.post('/storage/presigned-url', {
            mimeType: compressed.mimeType,
            destinationPath
        });

        // 3. Directly PUT blob to Cloudflare R2
        const uploadResponse = await fetch(presignedData.presignedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': compressed.mimeType
            },
            body: compressed.blob
        });

        if (!uploadResponse.ok) {
            throw new Error('Fallo la subida directa a Cloudflare R2.');
        }

        return presignedData.publicUrl;
    }
};
