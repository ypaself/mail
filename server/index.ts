import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool, QueryResult } from 'pg';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import mailService from './mailService';

// Type definitions
interface AuthTokenPayload extends JwtPayload {
  id: number;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

interface RegisterBody {
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  email: string;
  token: string;
  newPassword: string;
}

interface SendEmailBody {
  to: string;
  subject: string;
  text: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  reset_token: string | null;
  reset_token_expires: Date | null;
  created_at: Date;
}

interface EmailRow {
  id: number;
  user_id: number;
  sender: string;
  recipient: string;
  subject: string | null;
  body: string | null;
  sent_at: Date;
  is_read: boolean;
}

interface InboxEmail {
  subject: string | null;
  from: string;
  to: string;
  date: Date;
  body: string | null;
}

// Error helpers
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getPgErrorCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '9493',
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        database: process.env.DB_NAME ?? 'maildb',
      }
);

pool.connect()
  .then(() => {
    console.log('Connected to PostgreSQL');
    // Run schema migrations
    runMigrations();
  })
  .catch((err: Error) => console.error('PostgreSQL connection error:', err));

// Migration function to add missing columns
async function runMigrations() {
  try {
    const columnsToCheck = [
      { name: 'is_scheduled', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'scheduled_for', type: 'TIMESTAMP' },
      { name: 'is_important', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_spam', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_subscription', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'label_name', type: 'VARCHAR(50)' },
    ];

    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'emails'
    `);

    const existingColumns = new Set(result.rows.map(row => row.column_name));

    for (const column of columnsToCheck) {
      if (!existingColumns.has(column.name)) {
        console.log(`Adding missing column: ${column.name}`);
        await pool.query(`ALTER TABLE emails ADD COLUMN ${column.name} ${column.type}`);
        console.log(`✓ Added ${column.name}`);
      }
    }
  } catch (err: any) {
    // Only log real errors, not column already exists errors
    if (!err.message.includes('already exists')) {
      console.error('Migration error:', err.message);
    }
  }
}

// JWT authentication middleware
function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) {
    res.sendStatus(401);
    return;
  }
  jwt.verify(token, process.env.JWT_SECRET ?? 'secret', (err, decoded) => {
    if (err || !decoded) {
      res.sendStatus(403);
      return;
    }
    req.user = decoded as AuthTokenPayload;
    next();
  });
}

// User registration
app.post('/api/register', async (req: Request<{}, {}, RegisterBody>, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query<UserRow>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );
    const userId = result.rows[0].id;

    // Create default labels for the user
    await pool.query(
      'INSERT INTO labels (user_id, name, color) VALUES ($1, $2, $3), ($1, $4, $5)',
      [userId, 'Work', '#1976d2', 'Personal', '#4caf50']
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (getPgErrorCode(err) === '23505') {
      res.status(409).json({ error: 'Email already registered' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

// User login
app.post('/api/login', async (req: Request<{}, {}, LoginBody>, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  try {
    const result = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET ?? 'secret',
      { expiresIn: '1d' }
    );
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Forgot password
app.post('/api/forgot-password', async (req: Request<{}, {}, ForgotPasswordBody>, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email required' });
    return;
  }
  try {
    const result = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Don't reveal if email exists (security best practice)
      res.json({ message: 'If email exists, a reset link will be sent' });
      return;
    }

    // Generate reset token
    const resetToken: string = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour expiration

    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [resetToken, resetExpires, email]
    );

    // Mock email - just return the token for development
    res.json({ message: 'Password reset link sent to email', token: resetToken });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process forgot password' });
  }
});

// Reset password
app.post('/api/reset-password', async (req: Request<{}, {}, ResetPasswordBody>, res: Response): Promise<void> => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    res.status(400).json({ error: 'Email, token, and new password required' });
    return;
  }

  try {
    const result = await pool.query<UserRow>(
      'SELECT * FROM users WHERE email = $1 AND reset_token = $2 AND reset_token_expires > NOW()',
      [email, token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE email = $2',
      [hash, email]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Send email endpoint (Real SMTP)
app.post('/api/send', authenticateToken, async (req: Request<{}, {}, SendEmailBody>, res: Response): Promise<void> => {
  const { to, subject, text } = req.body;
  if (!to || !subject || !text) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  try {
    // Send email via SMTP
    const sent = await mailService.sendEmail({
      to,
      subject,
      text,
    });

    if (!sent) {
      res.status(500).json({ error: 'Failed to send email via SMTP' });
      return;
    }

    // Store sent email in DB
    await pool.query(
      'INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [req.user!.id, req.user!.email, to, subject, text]
    );
    res.json({ message: 'Email sent successfully!', info: { to, subject } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email', details: getErrorMessage(err) });
  }
});

// Verify SMTP connection
app.post('/api/mail/verify-smtp', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const verified = await mailService.verifyConnection();
    if (verified) {
      res.json({ message: 'SMTP connection verified successfully' });
    } else {
      res.status(500).json({ error: 'SMTP connection failed. Please check your credentials.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify SMTP connection', details: getErrorMessage(err) });
  }
});

// Sync emails from IMAP
app.post('/api/mail/sync', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const IMAPService = (await import('./imapService')).default;
    const imapService = new IMAPService(pool, req.user!.id);

    const connected = await imapService.connect();
    if (!connected) {
      res.status(500).json({ error: 'Failed to connect to IMAP server. Please check your credentials.' });
      return;
    }

    // Fetch last 20 emails from IMAP
    await imapService.fetchEmails(20);
    await imapService.disconnect();

    res.json({ message: 'Emails synced successfully from IMAP server' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync emails', details: getErrorMessage(err) });
  }
});

// Receive emails endpoint (get from database)
app.get('/api/inbox', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE recipient = $1 AND is_snoozed = false AND is_archived = false AND is_spam = false AND is_deleted = false`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get received emails (where user is the recipient, not snoozed, not archived, not purchased, not scheduled, not important, not spam, not deleted, not subscription, not labeled)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      folder: string;
      is_starred: boolean;
      is_snoozed: boolean;
      is_read: boolean;
      is_important: boolean;
    }>(
      `SELECT id, subject, sender as "from", recipient as "to", sent_at as "date", body, 'inbox' as folder, is_starred, is_snoozed, is_read, is_important
       FROM emails WHERE recipient = $1 AND is_snoozed = false AND is_archived = false AND is_spam = false AND is_deleted = false ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.folder,
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      isRead: email.is_read,
      isImportant: email.is_important,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emails', details: getErrorMessage(err) });
  }
});

// Get sent emails endpoint
app.get('/api/sent', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE sender = $1 AND is_snoozed = false AND is_archived = false AND is_spam = false AND is_deleted = false AND is_scheduled = false`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get sent emails (where user is the sender, not snoozed, not archived, not purchased, not scheduled, not important, not spam, not deleted, not subscription, not labeled)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      folder: string;
      is_starred: boolean;
      is_snoozed: boolean;
      is_read: boolean;
      is_important: boolean;
    }>(
      `SELECT id, subject, sender as "from", recipient as "to", sent_at as "date", body, 'sent' as folder, is_starred, is_snoozed, is_read, is_important
       FROM emails WHERE sender = $1 AND is_snoozed = false AND is_archived = false AND is_spam = false AND is_deleted = false AND is_scheduled = false ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.folder,
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      isRead: email.is_read,
      isImportant: email.is_important,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch emails', details: getErrorMessage(err) });
  }
});

// Get starred emails endpoint
app.get('/api/starred', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_starred = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get starred emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_read
       FROM emails
       WHERE is_starred = true AND (recipient = $1 OR sender = $1)
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch starred emails', details: getErrorMessage(err) });
  }
});

// Toggle star on email
app.put('/api/emails/:id/star', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // First, get the current starred status
    const emailResult = await pool.query<{ is_starred: boolean; sender: string; recipient: string }>(
      'SELECT is_starred, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow starring if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Toggle the starred status
    const newStarredStatus = !email.is_starred;
    await pool.query(
      'UPDATE emails SET is_starred = $1 WHERE id = $2',
      [newStarredStatus, id]
    );

    res.json({ message: 'Email starred status updated', isStarred: newStarredStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle star', details: getErrorMessage(err) });
  }
});

// Get snoozed emails endpoint
app.get('/api/snoozed', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_snoozed = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get snoozed emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_snoozed: boolean;
      snoozed_until: Date | null;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_snoozed, snoozed_until, is_read
       FROM emails
       WHERE is_snoozed = true AND (recipient = $1 OR sender = $1)
       ORDER BY snoozed_until DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch snoozed emails', details: getErrorMessage(err) });
  }
});

// Snooze email endpoint
app.put('/api/emails/:id/snooze', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { hours = 1 } = req.body;
  try {
    // First, get the email
    const emailResult = await pool.query<{ is_snoozed: boolean; sender: string; recipient: string }>(
      'SELECT is_snoozed, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow snoozeing if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Calculate snooze time
    const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    // Toggle the snoozed status
    const newSnoozedStatus = !email.is_snoozed;
    await pool.query(
      'UPDATE emails SET is_snoozed = $1, snoozed_until = $2 WHERE id = $3',
      [newSnoozedStatus, newSnoozedStatus ? snoozedUntil : null, id]
    );

    res.json({ message: 'Email snoozed status updated', isSnoozed: newSnoozedStatus, snoozedUntil: newSnoozedStatus ? snoozedUntil : null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to snooze email', details: getErrorMessage(err) });
  }
});

// Get drafts emails endpoint
app.get('/api/drafts', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE user_id = $1 AND is_draft = true`,
      [req.user!.id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get draft emails created by the user
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      is_starred: boolean;
    }>(
      `SELECT id, subject, sender as "from", recipient as "to", sent_at as "date", body, is_starred
       FROM emails
       WHERE user_id = $1 AND is_draft = true
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.id, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject || '(No subject)',
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body || '(No content)',
      isStarred: email.is_starred,
      isDraft: true,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drafts', details: getErrorMessage(err) });
  }
});

// Save a new draft
app.post('/api/emails/draft', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { to, subject, body } = req.body;
  if (!to) {
    res.status(400).json({ error: 'Recipient required' });
    return;
  }
  try {
    const result = await pool.query<{ id: number }>(
      'INSERT INTO emails (user_id, sender, recipient, subject, body, is_draft, sent_at) VALUES ($1, $2, $3, $4, $5, true, NOW()) RETURNING id',
      [req.user!.id, req.user!.email, to, subject || '', body || '']
    );
    const draftId = result.rows[0].id;
    res.status(201).json({ message: 'Draft saved', draftId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save draft', details: getErrorMessage(err) });
  }
});

// Update a draft
app.put('/api/emails/:id/draft', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { to, subject, body } = req.body;
  try {
    // Check if email is a draft and belongs to user
    const emailResult = await pool.query<{ is_draft: boolean; user_id: number }>(
      'SELECT is_draft, user_id FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    const email = emailResult.rows[0];
    if (!email.is_draft || email.user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Update the draft
    await pool.query(
      'UPDATE emails SET recipient = $1, subject = $2, body = $3 WHERE id = $4',
      [to || '', subject || '', body || '', id]
    );

    res.json({ message: 'Draft updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update draft', details: getErrorMessage(err) });
  }
});

// Send a draft (mark as sent)
app.put('/api/emails/:id/send', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // Check if email is a draft and belongs to user
    const emailResult = await pool.query<{ is_draft: boolean; user_id: number }>(
      'SELECT is_draft, user_id FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    if (!email.is_draft || email.user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Mark as sent (not a draft)
    await pool.query(
      'UPDATE emails SET is_draft = false, sent_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ message: 'Draft sent successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send draft', details: getErrorMessage(err) });
  }
});

// Delete a draft
app.delete('/api/emails/:id/draft', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // Check if email is a draft and belongs to user
    const emailResult = await pool.query<{ is_draft: boolean; user_id: number }>(
      'SELECT is_draft, user_id FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    const email = emailResult.rows[0];
    if (!email.is_draft || email.user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Delete the draft
    await pool.query('DELETE FROM emails WHERE id = $1', [id]);

    res.json({ message: 'Draft deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete draft', details: getErrorMessage(err) });
  }
});

// Get archived emails endpoint
app.get('/api/archived', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_archived = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get archived emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_read
       FROM emails
       WHERE is_archived = true AND (recipient = $1 OR sender = $1)
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isArchived: true,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch archived emails', details: getErrorMessage(err) });
  }
});

// Archive email endpoint
app.put('/api/emails/:id/archive', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // First, get the email
    const emailResult = await pool.query<{ is_archived: boolean; sender: string; recipient: string }>(
      'SELECT is_archived, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow archiving if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Toggle the archived status
    const newArchivedStatus = !email.is_archived;
    await pool.query(
      'UPDATE emails SET is_archived = $1 WHERE id = $2',
      [newArchivedStatus, id]
    );

    res.json({ message: 'Email archived status updated', isArchived: newArchivedStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive email', details: getErrorMessage(err) });
  }
});

// Mark email as read/unread
app.put('/api/emails/:id/read', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { is_read } = req.body;

  if (typeof is_read !== 'boolean') {
    res.status(400).json({ error: 'is_read must be a boolean' });
    return;
  }

  try {
    const emailResult = await pool.query<{ sender: string; recipient: string }>(
      'SELECT sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    await pool.query('UPDATE emails SET is_read = $1 WHERE id = $2', [is_read, id]);
    res.json({ message: 'Email read status updated', isRead: is_read });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update read status', details: getErrorMessage(err) });
  }
});

// Get purchased emails endpoint
app.get('/api/purchased', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_purchased = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get purchased emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_read
       FROM emails
       WHERE is_purchased = true AND (recipient = $1 OR sender = $1)
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isPurchased: true,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch purchased emails', details: getErrorMessage(err) });
  }
});

// Purchase email endpoint
app.put('/api/emails/:id/purchase', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // First, get the email
    const emailResult = await pool.query<{ is_purchased: boolean; sender: string; recipient: string }>(
      'SELECT is_purchased, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow purchasing if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Toggle the purchased status
    const newPurchasedStatus = !email.is_purchased;
    await pool.query(
      'UPDATE emails SET is_purchased = $1 WHERE id = $2',
      [newPurchasedStatus, id]
    );

    res.json({ message: 'Email purchased status updated', isPurchased: newPurchasedStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as purchased', details: getErrorMessage(err) });
  }
});

// Get all mails endpoint
app.get('/api/allmails', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE recipient = $1 OR sender = $1`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get all emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      is_snoozed: boolean;
      is_read: boolean;
      is_important: boolean;
      is_spam: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, is_read, is_important, is_spam
       FROM emails
       WHERE recipient = $1 OR sender = $1
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      isRead: email.is_read,
      isImportant: email.is_important,
      isSpam: email.is_spam,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch all mails', details: getErrorMessage(err) });
  }
});

// Get scheduled emails endpoint
app.get('/api/scheduled', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_scheduled = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get scheduled emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      scheduled_for: Date | null;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, scheduled_for, is_read
       FROM emails
       WHERE is_scheduled = true AND (recipient = $1 OR sender = $1)
       ORDER BY scheduled_for ASC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isScheduled: true,
      scheduledFor: email.scheduled_for,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch scheduled emails', details: getErrorMessage(err) });
  }
});

// Schedule email endpoint
app.put('/api/emails/:id/schedule', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { scheduledFor } = req.body;
  try {
    // First, get the email
    const emailResult = await pool.query<{ is_scheduled: boolean; sender: string; recipient: string }>(
      'SELECT is_scheduled, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow scheduling if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Toggle the scheduled status
    const newScheduledStatus = !email.is_scheduled;
    await pool.query(
      'UPDATE emails SET is_scheduled = $1, scheduled_for = $2 WHERE id = $3',
      [newScheduledStatus, newScheduledStatus && scheduledFor ? new Date(scheduledFor) : null, id]
    );

    res.json({ message: 'Email scheduled status updated', isScheduled: newScheduledStatus, scheduledFor: newScheduledStatus && scheduledFor ? new Date(scheduledFor) : null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule email', details: getErrorMessage(err) });
  }
});

// Get important emails endpoint
app.get('/api/important', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_important = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get important emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_read
       FROM emails
       WHERE is_important = true AND (recipient = $1 OR sender = $1)
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isImportant: true,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch important emails', details: getErrorMessage(err) });
  }
});

// Mark email as important endpoint
app.put('/api/emails/:id/important', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // First, get the email
    const emailResult = await pool.query<{ is_important: boolean; sender: string; recipient: string }>(
      'SELECT is_important, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow marking if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Toggle the important status
    const newImportantStatus = !email.is_important;
    await pool.query(
      'UPDATE emails SET is_important = $1 WHERE id = $2',
      [newImportantStatus, id]
    );

    res.json({ message: 'Email important status updated', isImportant: newImportantStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as important', details: getErrorMessage(err) });
  }
});

// Get spam emails endpoint
app.get('/api/spam', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_spam = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get spam emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_read
       FROM emails
       WHERE is_spam = true AND (recipient = $1 OR sender = $1)
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSpam: true,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spam emails', details: getErrorMessage(err) });
  }
});

// Mark email as spam endpoint
app.put('/api/emails/:id/spam', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // First, get the email
    const emailResult = await pool.query<{ is_spam: boolean; sender: string; recipient: string }>(
      'SELECT is_spam, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow marking if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Toggle the spam status
    const newSpamStatus = !email.is_spam;
    await pool.query(
      'UPDATE emails SET is_spam = $1 WHERE id = $2',
      [newSpamStatus, id]
    );

    res.json({ message: 'Email spam status updated', isSpam: newSpamStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as spam', details: getErrorMessage(err) });
  }
});

// Get trash emails endpoint
app.get('/api/trash', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_deleted = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get deleted emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_read
       FROM emails
       WHERE is_deleted = true AND (recipient = $1 OR sender = $1)
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isDeleted: true,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trash emails', details: getErrorMessage(err) });
  }
});

// Delete email endpoint
app.put('/api/emails/:id/delete', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // First, get the email
    const emailResult = await pool.query<{ is_deleted: boolean; sender: string; recipient: string }>(
      'SELECT is_deleted, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow deleting if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Toggle the deleted status
    const newDeletedStatus = !email.is_deleted;
    await pool.query(
      'UPDATE emails SET is_deleted = $1 WHERE id = $2',
      [newDeletedStatus, id]
    );

    res.json({ message: 'Email deleted status updated', isDeleted: newDeletedStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete email', details: getErrorMessage(err) });
  }
});

// Get subscription emails endpoint
app.get('/api/subscriptions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_subscription = true AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get subscription emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_read
       FROM emails
       WHERE is_subscription = true AND (recipient = $1 OR sender = $1)
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSubscription: true,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscription emails', details: getErrorMessage(err) });
  }
});

// Mark email as subscription endpoint
app.put('/api/emails/:id/subscription', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // First, get the email
    const emailResult = await pool.query<{ is_subscription: boolean; sender: string; recipient: string }>(
      'SELECT is_subscription, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow marking if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Toggle the subscription status
    const newSubscriptionStatus = !email.is_subscription;
    await pool.query(
      'UPDATE emails SET is_subscription = $1 WHERE id = $2',
      [newSubscriptionStatus, id]
    );

    res.json({ message: 'Email subscription status updated', isSubscription: newSubscriptionStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as subscription', details: getErrorMessage(err) });
  }
});

// Get all custom labels for user
app.get('/api/custom-labels', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ id: number; name: string; color: string; parent_label_id: number | null }>(
      'SELECT id, name, color, parent_label_id FROM labels WHERE user_id = $1 ORDER BY parent_label_id NULLS FIRST, created_at ASC',
      [req.user!.id]
    );

    // Build hierarchical structure with unlimited nesting levels
    const labels: any[] = [];
    const labelMap = new Map<number, any>();
    const childrenMap = new Map<number, any[]>();

    // First pass: create label objects
    result.rows.forEach(row => {
      labelMap.set(row.id, {
        id: row.id,
        name: row.name,
        color: row.color,
        parent_label_id: row.parent_label_id,
        children: [],
      });

      if (!childrenMap.has(row.parent_label_id || 0)) {
        childrenMap.set(row.parent_label_id || 0, []);
      }
      childrenMap.get(row.parent_label_id || 0)!.push(row.id);
    });

    // Second pass: build hierarchy by setting children
    labelMap.forEach(label => {
      const childIds = childrenMap.get(label.id) || [];
      label.children = childIds.map(id => labelMap.get(id)).filter(Boolean);
    });

    // Return only root-level labels (those without parent_label_id)
    result.rows.forEach(row => {
      if (!row.parent_label_id) {
        labels.push(labelMap.get(row.id));
      }
    });

    res.json({ labels });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch custom labels', details: getErrorMessage(err) });
  }
});

// Create a new custom label
app.post('/api/custom-labels', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { name, color, parent_label_id } = req.body;
  if (!name || name.trim().length === 0) {
    res.status(400).json({ error: 'Label name required' });
    return;
  }
  if (name.length > 50) {
    res.status(400).json({ error: 'Label name must be 50 characters or less' });
    return;
  }
  try {
    // Check for duplicate label name under the same parent
    const existingLabel = await pool.query(
      'SELECT id FROM labels WHERE user_id = $1 AND name = $2 AND parent_label_id IS NOT DISTINCT FROM $3',
      [req.user!.id, name, parent_label_id || null]
    );
    if (existingLabel.rows.length > 0) {
      res.status(409).json({ error: 'Label with this name already exists under this parent' });
      return;
    }

    // Validate parent_label_id if provided
    if (parent_label_id) {
      const parentLabel = await pool.query<{ id: number }>(
        'SELECT id FROM labels WHERE id = $1 AND user_id = $2',
        [parent_label_id, req.user!.id]
      );
      if (parentLabel.rows.length === 0) {
        res.status(404).json({ error: 'Parent label not found' });
        return;
      }
    }

    const result = await pool.query<{ id: number; name: string; color: string }>(
      'INSERT INTO labels (user_id, name, color, parent_label_id) VALUES ($1, $2, $3, $4) RETURNING id, name, color',
      [req.user!.id, name, color || '#9c27b0', parent_label_id || null]
    );
    res.status(201).json({ label: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create custom label', details: getErrorMessage(err) });
  }
});

// Delete a custom label
app.delete('/api/custom-labels/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const labelId = parseInt(id, 10);

  if (isNaN(labelId)) {
    res.status(400).json({ error: 'Invalid label ID' });
    return;
  }

  try {
    // Get the label to find its name and check if it's a parent
    const labelResult = await pool.query<{ name: string; parent_label_id: number | null }>(
      'SELECT name, parent_label_id FROM labels WHERE id = $1 AND user_id = $2',
      [labelId, req.user!.id]
    );

    if (labelResult.rows.length === 0) {
      res.status(404).json({ error: 'Label not found' });
      return;
    }

    const { name: labelName, parent_label_id: parentLabelId } = labelResult.rows[0];

    // Clear the label from all emails that have it
    await pool.query('UPDATE emails SET label_name = NULL WHERE label_name = $1', [labelName]);

    // If this is a parent label, also clear child labels from emails
    if (parentLabelId === null) {
      const childLabels = await pool.query<{ name: string }>(
        'SELECT name FROM labels WHERE parent_label_id = $1 AND user_id = $2',
        [labelId, req.user!.id]
      );

      for (const child of childLabels.rows) {
        await pool.query('UPDATE emails SET label_name = NULL WHERE label_name = $1', [child.name]);
      }
    }

    // Delete the label (cascades to children via ON DELETE CASCADE)
    await pool.query('DELETE FROM labels WHERE id = $1 AND user_id = $2', [labelId, req.user!.id]);

    res.json({ message: 'Label deleted successfully' });
  } catch (err) {
    console.error('Delete label error:', err);
    res.status(500).json({ error: 'Failed to delete custom label', details: getErrorMessage(err) });
  }
});

// Batch update emails
app.put('/api/emails/batch', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { action, ids, all, type, value } = req.body;

  if (!all && (!ids || !Array.isArray(ids) || ids.length === 0)) {
    res.status(400).json({ error: 'No emails selected' });
    return;
  }

  try {
    let query = '';
    let params: any[] = [];

    // Construct the WHERE clause
    let whereClause = '';
    if (all) {
      // For "Select All", we target based on the current folder type
      // This is a simplified implementation. In a real app, you'd replicate the filter logic of each folder.
      if (type === 'inbox') {
        whereClause = 'recipient = $1 AND is_archived = false AND is_deleted = false AND is_spam = false';
      } else if (type === 'sent') {
        whereClause = 'sender = $1 AND is_archived = false AND is_deleted = false';
      } else if (type === 'trash') {
        whereClause = '(recipient = $1 OR sender = $1) AND is_deleted = true';
      } else {
        // Fallback for other folders or safety
        whereClause = '(recipient = $1 OR sender = $1)';
      }
      params = [req.user!.email];
    } else {
      whereClause = 'id = ANY($1::int[]) AND (recipient = $2 OR sender = $2)';
      params = [ids, req.user!.email];
    }

    // Construct the UPDATE query based on action
    if (action === 'archive') {
      query = `UPDATE emails SET is_archived = true, is_inbox = false WHERE ${whereClause}`;
    } else if (action === 'delete') {
      query = `UPDATE emails SET is_deleted = true WHERE ${whereClause}`;
    } else if (action === 'read') {
      query = `UPDATE emails SET is_read = ${value ? 'true' : 'false'} WHERE ${whereClause}`;
    } else if (action === 'star') {
      query = `UPDATE emails SET is_starred = ${value ? 'true' : 'false'} WHERE ${whereClause}`;
    }

    if (query) {
      await pool.query(query, params);
      res.json({ message: 'Batch update successful' });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Batch update failed', details: getErrorMessage(err) });
  }
});

// Get emails for a specific label
app.get('/api/labels/:labelName', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const labelName = Array.isArray(req.params.labelName) ? req.params.labelName[0] : req.params.labelName;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE label_name = $1 AND (recipient = $2 OR sender = $2)`,
      [decodeURIComponent(labelName), req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      label_name: string | null;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, label_name, is_read
       FROM emails
       WHERE label_name = $1 AND (recipient = $2 OR sender = $2)
       ORDER BY sent_at DESC LIMIT $3 OFFSET $4`,
      [decodeURIComponent(labelName), req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isLabeled: true,
      label: email.label_name,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch label emails', details: getErrorMessage(err) });
  }
});

// Get labeled emails endpoint (all labeled emails)
app.get('/api/labels', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE label_name IS NOT NULL AND (recipient = $1 OR sender = $1)`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get labeled emails (both inbox and sent)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      is_starred: boolean;
      label_name: string | null;
      is_read: boolean;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, label_name, is_read
       FROM emails
       WHERE label_name IS NOT NULL AND (recipient = $1 OR sender = $1)
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isLabeled: true,
      label: email.label_name,
      isRead: email.is_read,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch labeled emails', details: getErrorMessage(err) });
  }
});

// Mark email with label endpoint
app.put('/api/emails/:id/label', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { label_name } = req.body;
  try {
    // First, get the email
    const emailResult = await pool.query<{ label_name: string | null; sender: string; recipient: string }>(
      'SELECT label_name, sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow labeling if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Set or clear the label based on provided label_name
    const newLabelName = label_name || null;
    await pool.query(
      'UPDATE emails SET label_name = $1 WHERE id = $2',
      [newLabelName, id]
    );

    res.json({ message: 'Email label updated', label: newLabelName });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark with label', details: getErrorMessage(err) });
  }
});

// Health check
app.get('/', (req: Request, res: Response): void => {
  res.send('Mail App Backend Running');
});

// Start server
const PORT = process.env.PORT ?? 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
