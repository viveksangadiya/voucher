const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      'SELECT id, name, email, balance, avatar, role, is_suspended FROM users WHERE id = $1',
      [decoded.id]
    );
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });
    if (result.rows[0].is_suspended) return res.status(403).json({ error: 'Account suspended' });
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query(
        'SELECT id, name, email, balance, avatar, role FROM users WHERE id = $1',
        [decoded.id]
      );
      if (result.rows[0]) req.user = result.rows[0];
    }
  } catch {}
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Log admin actions
const logAdminAction = (action, targetType) => async (req, res, next) => {
  res.on('finish', async () => {
    if (res.statusCode < 400 && req.user?.role?.includes('admin')) {
      try {
        const targetId = req.params.id || req.params.voucherId || req.params.disputeId || null;
        await pool.query(
          'INSERT INTO admin_logs (admin_id, action, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5)',
          [req.user.id, action, targetType, targetId, JSON.stringify({ body: req.body, query: req.query })]
        );
      } catch {}
    }
  });
  next();
};

module.exports = { auth, optionalAuth, requireAdmin, requireSuperAdmin, logAdminAction };
