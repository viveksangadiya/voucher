const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

const register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await pool.query('SELECT id, auth_provider FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) {
      const p = existing.rows[0].auth_provider;
      if (p === 'google') return res.status(400).json({ error: 'This email is registered via Google. Please sign in with Google.' });
      return res.status(400).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, auth_provider, role)
       VALUES ($1, $2, $3, 'local', 'user')
       RETURNING id, name, email, balance, avatar, avatar_url, role`,
      [name, email, hashed]
    );
    const user = result.rows[0];
    res.status(201).json({ user, token: generateToken(user.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended' });
    if (user.auth_provider === 'google' && !user.password)
      return res.status(400).json({ error: 'This account uses Google Sign-In. Please login with Google.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    const { password: _, ...safe } = user;
    res.json({ user: safe, token: generateToken(user.id) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const googleAuth = async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: 'Google access token is required' });
  try {
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!googleRes.ok) return res.status(401).json({ error: 'Invalid Google token. Please try again.' });
    const { sub: googleId, email, name, picture, email_verified } = await googleRes.json();
    if (!email_verified) return res.status(400).json({ error: 'Your Google account email is not verified.' });

    let userRes = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
    let user = userRes.rows[0];
    let isNewUser = false;

    if (!user) {
      const emailRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const existing = emailRes.rows[0];
      if (existing) {
        const updated = await pool.query(
          `UPDATE users SET google_id=$1, avatar_url=COALESCE(avatar_url,$2), auth_provider='both', last_login=NOW()
           WHERE id=$3 RETURNING id, name, email, balance, avatar, avatar_url, role, is_suspended`,
          [googleId, picture, existing.id]
        );
        user = updated.rows[0];
      } else {
        const created = await pool.query(
          `INSERT INTO users (name, email, google_id, avatar_url, auth_provider, role)
           VALUES ($1,$2,$3,$4,'google','user')
           RETURNING id, name, email, balance, avatar, avatar_url, role`,
          [name, email, googleId, picture]
        );
        user = created.rows[0];
        isNewUser = true;
      }
    } else {
      const updated = await pool.query(
        `UPDATE users SET last_login=NOW() WHERE id=$1
         RETURNING id, name, email, balance, avatar, avatar_url, role, is_suspended`,
        [user.id]
      );
      user = updated.rows[0];
    }

    if (user.is_suspended) return res.status(403).json({ error: 'Your account has been suspended.' });
    const { password: _, ...safe } = user;
    res.json({ user: safe, token: generateToken(user.id), is_new_user: isNewUser });
  } catch (err) {
    console.error('[google-auth]', err);
    res.status(500).json({ error: 'Google authentication failed. Please try again.' });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, balance, avatar, avatar_url, role, is_suspended,
              auth_provider, total_sold, total_bought, rating, is_verified, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  const { name, avatar } = req.body;
  if (name !== undefined && !name?.trim())
    return res.status(400).json({ error: 'Name cannot be empty' });
  try {
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           avatar = COALESCE($2, avatar),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, email, balance, avatar, avatar_url, role,
                 total_sold, total_bought, rating, is_verified, created_at, auth_provider`,
      [name?.trim() || null, avatar || null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    // If they already have a password, verify the current one first
    if (user.password) {
      if (!current_password)
        return res.status(400).json({ error: 'Current password is required' });
      const isMatch = await bcrypt.compare(current_password, user.password);
      if (!isMatch)
        return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query(
      `UPDATE users
       SET password = $1,
           auth_provider = CASE WHEN auth_provider = 'google' THEN 'both' ELSE auth_provider END,
           updated_at = NOW()
       WHERE id = $2`,
      [hashed, req.user.id]
    );
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { register, login, googleAuth, getMe, updateProfile, changePassword };
