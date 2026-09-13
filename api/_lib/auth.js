import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_para_firmar_tokens_jwt_saas_hoteles_2026';

export function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        return null;
    }
}

export function requireAuth(req, res, roles = []) {
    const decoded = verifyToken(req);
    if (!decoded) {
        res.status(401).json({ error: 'No autorizado. Token inválido o expirado.' });
        return null;
    }
    if (roles.length > 0 && !roles.includes(decoded.role)) {
        res.status(403).json({ error: 'Acceso denegado. Permisos insuficientes.' });
        return null;
    }
    return decoded;
}
