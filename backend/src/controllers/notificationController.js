const pool = require('../config/db');

// GET /api/notifications — paginated list
const getNotifications = async (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const where = unread_only === 'true'
      ? 'WHERE user_id = $1 AND is_read = false'
      : 'WHERE user_id = $1';

    const [notifRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM notifications ${where}
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_read = false) as unread
         FROM notifications WHERE user_id = $1`,
        [req.user.id]
      ),
    ]);

    res.json({
      notifications: notifRes.rows,
      total: parseInt(countRes.rows[0].total),
      unread: parseInt(countRes.rows[0].unread),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countRes.rows[0].total) / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/notifications/unread-count — just the badge number
const getUnreadCount = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/notifications/:id/read — mark one as read
const markRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/notifications/read-all — mark all as read
const markAllRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/notifications/clear-all
const clearAll = async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/admin/notifications/broadcast — admin sends to all users
const broadcast = async (req, res) => {
  const { title, message, type = 'system' } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message are required' });
  try {
    const users = await pool.query('SELECT id FROM users WHERE is_suspended = false OR is_suspended IS NULL');
    await Promise.all(
      users.rows.map(u =>
        pool.query(
          `INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)`,
          [u.id, type, title, message]
        )
      )
    );
    res.json({ sent: users.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getNotifications, getUnreadCount, markRead, markAllRead, deleteNotification, clearAll, broadcast };
