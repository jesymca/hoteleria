let cachedRate = null;
let lastFetched = 0;
const CACHE_TTL = 300000; // 5 minutes cache

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const now = Date.now();
    if (cachedRate && (now - lastFetched < CACHE_TTL)) {
        return res.status(200).json(cachedRate);
    }

    try {
        const apiRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        if (apiRes.ok) {
            const data = await apiRes.json();
            cachedRate = {
                promedio: data.promedio || 40.0,
                fechaActualizacion: data.fechaActualizacion || new Date().toISOString(),
                fuente: 've.dolarapi.com/v1/dolares/oficial',
                status: 'ONLINE'
            };
            lastFetched = now;
            return res.status(200).json(cachedRate);
        }
    } catch (err) {
        console.warn('Error fetching DolarAPI BCV rate:', err);
    }

    // Fallback if API unavailable
    const fallback = {
        promedio: cachedRate ? cachedRate.promedio : 40.0,
        fechaActualizacion: new Date().toISOString(),
        fuente: 'Caché local de respaldo',
        status: 'OFFLINE_FALLBACK'
    };
    return res.status(200).json(fallback);
}
