import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Pool, QueryResult } from 'pg';
import bcrypt from 'bcrypt';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import mailService from './mailService';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

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

interface AttachmentPayload {
  name: string;
  size: number;
  dataUrl: string;
}

interface SendEmailBody {
  to: string;
  subject: string;
  text?: string;
  body?: string;
  cc?: string;
  bcc?: string;
  is_scheduled?: boolean;
  scheduled_for?: string;
  has_attachments?: boolean;
  attachments?: AttachmentPayload[];
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
app.use(express.json({ limit: '50mb' }));

// File upload setup
const uploadsDir = path.join(__dirname, '../uploads/attachments');
fs.mkdirSync(uploadsDir, { recursive: true });
const multerStorage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});
const upload = multer({ storage: multerStorage, limits: { fileSize: 50 * 1024 * 1024 } });
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Attachment upload endpoint
app.post('/api/attachments/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file provided' }); return; }
  const fileUrl = `/uploads/attachments/${req.file.filename}`;

  // Save thumbnail if provided as base64
  let thumbUrl = fileUrl;
  const { thumbnail } = req.body as { thumbnail?: string };
  if (thumbnail) {
    try {
      const base64Data = thumbnail.replace(/^data:image\/\w+;base64,/, '');
      const thumbFilename = 'thumb_' + path.basename(req.file.filename, path.extname(req.file.filename)) + '.jpg';
      fs.writeFileSync(path.join(uploadsDir, thumbFilename), Buffer.from(base64Data, 'base64'));
      thumbUrl = `/uploads/attachments/${thumbFilename}`;
    } catch {}
  }

  res.json({ url: fileUrl, thumbUrl, name: req.file.originalname, size: req.file.size });
});

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

      { name: 'is_spam', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_important', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_subscription', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_report', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'is_pinned', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'label_name', type: 'VARCHAR(50)' },
      { name: 'is_muted', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'has_attachments', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'cc', type: 'VARCHAR(500)' },
      { name: 'bcc', type: 'VARCHAR(500)' },
      { name: 'snooze_dates', type: 'TIMESTAMP[] DEFAULT ARRAY[]::TIMESTAMP[]' },
      { name: 'is_purchased', type: 'BOOLEAN DEFAULT FALSE' },
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

    // Create groups tables if they don't exist
    const tablesToCreate = [
      {
        name: 'groups',
        sql: `CREATE TABLE IF NOT EXISTS groups (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(20) DEFAULT '#1976d2',
          description TEXT,
          photo_url VARCHAR(500),
          email_local VARCHAR(50) UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (user_id, name)
        )`
      },
      {
        name: 'group_members',
        sql: `CREATE TABLE IF NOT EXISTS group_members (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (group_id, email)
        )`
      },
      {
        name: 'email_groups',
        sql: `CREATE TABLE IF NOT EXISTS email_groups (
          email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          tagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (email_id, group_id)
        )`
      },
      {
        name: 'group_events',
        sql: `CREATE TABLE IF NOT EXISTS group_events (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          event_date TIMESTAMP NOT NULL,
          end_date TIMESTAMP,
          location VARCHAR(255),
          is_online BOOLEAN DEFAULT FALSE,
          attendees TEXT[] DEFAULT ARRAY[]::TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'error_reports',
        sql: `CREATE TABLE IF NOT EXISTS error_reports (
          id SERIAL PRIMARY KEY,
          error_message TEXT,
          stack_trace TEXT,
          user_agent TEXT,
          url TEXT,
          screenshot_path TEXT,
          status VARCHAR(20) DEFAULT 'new',
          notes TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'feedback',
        sql: `CREATE TABLE IF NOT EXISTS feedback (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          user_email VARCHAR(255),
          category VARCHAR(50) DEFAULT 'general',
          subject VARCHAR(255),
          message TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'new',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      }
    ];

    for (const table of tablesToCreate) {
      await pool.query(table.sql);
      console.log(`✓ Table '${table.name}' ready`);
    }

    // groups table may already exist from before description/photo_url/email_local were added
    const groupsColumnsResult = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'groups'
    `);
    const existingGroupsColumns = new Set(groupsColumnsResult.rows.map(row => row.column_name));
    for (const column of [{ name: 'description', type: 'TEXT' }, { name: 'photo_url', type: 'VARCHAR(500)' }, { name: 'email_local', type: 'VARCHAR(50) UNIQUE' }]) {
      if (!existingGroupsColumns.has(column.name)) {
        await pool.query(`ALTER TABLE groups ADD COLUMN ${column.name} ${column.type}`);
        console.log(`✓ Added groups.${column.name}`);
      }
    }

    // group_events table may already exist from before end_date/is_online were added
    const eventsColumnsResult = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'group_events'
    `);
    const existingEventsColumns = new Set(eventsColumnsResult.rows.map(row => row.column_name));
    for (const column of [{ name: 'end_date', type: 'TIMESTAMP' }, { name: 'is_online', type: 'BOOLEAN DEFAULT FALSE' }, { name: 'attendees', type: 'TEXT[] DEFAULT ARRAY[]::TEXT[]' }]) {
      if (!existingEventsColumns.has(column.name)) {
        await pool.query(`ALTER TABLE group_events ADD COLUMN ${column.name} ${column.type}`);
        console.log(`✓ Added group_events.${column.name}`);
      }
    }

    // Tags a group-compose send so Chat Mail can show it as its own group thread instead
    // of folding it into whichever member's individual conversation. Added here (after
    // the groups table above is guaranteed to exist) since it's a FK to groups(id).
    const emailsGroupIdResult = await pool.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'group_id'
    `);
    if (emailsGroupIdResult.rows.length === 0) {
      await pool.query(`ALTER TABLE emails ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL`);
      console.log('✓ Added emails.group_id');
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
    res.status(401).json({ error: 'Missing authentication token' });
    return;
  }
  jwt.verify(token, process.env.JWT_SECRET ?? 'secret', (err, decoded) => {
    if (err || !decoded) {
      res.status(403).json({ error: 'Invalid authentication token' });
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
app.post('/api/send', authenticateToken, async (req: Request<{}, {}, SendEmailBody & { groupId?: number }>, res: Response): Promise<void> => {
  const { to, subject, cc, bcc, is_scheduled, scheduled_for, attachments, groupId } = req.body;
  const emailBody = req.body.body || req.body.text || '';
  if (!to || !subject || !emailBody) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }
  const has_attachments = !!(attachments && attachments.length > 0) || !!req.body.has_attachments || /data-file-card/i.test(emailBody);
  try {
    // Insert into DB first — respond immediately so the client is unblocked
    await pool.query(
      `INSERT INTO emails (user_id, sender, recipient, subject, body, cc, bcc, is_scheduled, scheduled_for, has_attachments, group_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        req.user!.id,
        req.user!.email,
        to,
        subject,
        emailBody,
        cc || null,
        bcc || null,
        is_scheduled || false,
        scheduled_for || null,
        has_attachments || false,
        groupId || null,
      ]
    );
    res.json({ message: 'Email sent successfully!', info: { to, subject } });

    // A group-compose send stores one row (above) as the sender's own Sent-folder copy,
    // with the full recipient list joined into a single string. That string never equals
    // any individual member's email, so it would otherwise never appear in their own
    // Inbox — deliver each other member their own row, tagged with the same group_id, so
    // Chat Mail can recognize and group them into one thread instead of an orphaned message.
    if (!is_scheduled && groupId) {
      const otherRecipients = String(to)
        .split(',')
        .map(addr => addr.trim())
        .filter(addr => addr && addr.toLowerCase() !== req.user!.email.toLowerCase());
      for (const recipientEmail of otherRecipients) {
        await pool.query(
          `INSERT INTO emails (user_id, sender, recipient, subject, body, has_attachments, group_id, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [req.user!.id, req.user!.email, recipientEmail, subject, emailBody, has_attachments || false, groupId]
        ).catch((err: unknown) => console.error('Failed to deliver group copy:', err));
      }
    }

    // Fire SMTP in background — only attachments with valid base64 data are included
    if (!is_scheduled) {
      const nodeAttachments = (attachments || [])
        .filter((att: AttachmentPayload) => att.dataUrl && att.dataUrl.includes(','))
        .map((att: AttachmentPayload) => {
          const [meta, b64] = att.dataUrl.split(',');
          const mimeType = meta.replace('data:', '').replace(';base64', '');
          return { filename: att.name, content: Buffer.from(b64, 'base64'), contentType: mimeType };
        });
      mailService.sendEmail({ to, subject, text: emailBody, attachments: nodeAttachments })
        .catch((err: unknown) => console.error('SMTP send failed:', err));
    }
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
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE recipient = $1 AND is_snoozed = false AND is_archived = false AND is_spam = false AND is_deleted = false AND is_scheduled = false AND is_draft = false ${groupExclusion}`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get received emails (where user is the recipient, not snoozed, not archived, not purchased, not scheduled, not spam, not deleted, not subscription, not labeled)
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
      is_muted: boolean;
      has_attachments: boolean;
      cc: string | null;
      bcc: string | null;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      snoozed_until: Date | null;
      is_report: boolean;
      is_pinned: boolean;
      group_id: number | null;
    }>(
      `SELECT id, subject, sender as "from", recipient as "to", sent_at as "date", body, 'inbox' as folder, is_starred, is_snoozed, snoozed_until, is_read, is_muted, has_attachments, cc, bcc, is_scheduled, is_draft, scheduled_for, is_report, is_pinned, group_id
       FROM emails WHERE recipient = $1 AND is_snoozed = false AND is_archived = false AND is_spam = false AND is_deleted = false AND is_scheduled = false AND is_draft = false ${groupExclusion} ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
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
      snoozedUntil: email.snoozed_until,
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      cc: email.cc || null,
      bcc: email.bcc || null,
      isReport: email.is_report || false,
      isPinned: email.is_pinned || false,
      groupId: email.group_id || null,
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
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE sender = $1 AND is_archived = false AND is_spam = false AND is_deleted = false AND is_scheduled = false AND is_draft = false ${groupExclusion}`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get sent emails
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
      snoozed_until: Date | null;
      is_read: boolean;
      is_muted: boolean;
      has_attachments: boolean;
      cc: string | null;
      bcc: string | null;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      is_report: boolean;
      is_pinned: boolean;
    }>(
      `SELECT id, subject, sender as "from", recipient as "to", sent_at as "date", body, 'sent' as folder, is_starred, is_snoozed, snoozed_until, is_read, is_muted, has_attachments, cc, bcc, is_scheduled, is_draft, scheduled_for, is_report, is_pinned
       FROM emails WHERE sender = $1 AND is_archived = false AND is_spam = false AND is_deleted = false AND is_scheduled = false AND is_draft = false ${groupExclusion} ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
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
      snoozedUntil: email.snoozed_until,
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      cc: email.cc || null,
      bcc: email.bcc || null,
      isReport: email.is_report || false,
      isPinned: email.is_pinned || false,
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
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_starred = true AND (recipient = $1 OR sender = $1) AND is_deleted = false ${groupExclusion}`,
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
      is_snoozed: boolean;
      is_read: boolean;
      is_muted: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      snoozed_until: Date | null;
      group_id: number | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, is_read, is_muted, has_attachments, is_scheduled, is_draft, scheduled_for, group_id
       FROM emails
       WHERE is_starred = true AND (recipient = $1 OR sender = $1) AND is_deleted = false ${groupExclusion}
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      groupId: email.group_id || null,
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

    const newStarredStatus = !email.is_starred;
    await pool.query(
      'UPDATE emails SET is_starred = $1, is_deleted = false WHERE id = $2',
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
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_snoozed = true AND (recipient = $1 OR sender = $1) AND is_deleted = false ${groupExclusion}`,
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
      is_starred: boolean;
      is_snoozed: boolean;
      snoozed_until: Date | null;
      snooze_count: string;
      is_read: boolean;
      is_muted: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      group_id: number | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, COALESCE(array_length(snooze_dates, 1), 0) as snooze_count, is_read, is_muted, has_attachments, is_scheduled, is_draft, scheduled_for, group_id
       FROM emails
       WHERE is_snoozed = true AND (recipient = $1 OR sender = $1) AND is_deleted = false ${groupExclusion}
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
          isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      snoozeCount: Number(email.snooze_count),
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      groupId: email.group_id || null,
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

    const newSnoozedStatus = hours > 0;
    const snoozedUntil = newSnoozedStatus ? new Date(Date.now() + hours * 60 * 60 * 1000) : null;
    await pool.query(
      'UPDATE emails SET is_snoozed = $1, snoozed_until = $2, is_deleted = false WHERE id = $3',
      [newSnoozedStatus, snoozedUntil, id]
    );

    res.json({ message: 'Email snoozed status updated', isSnoozed: newSnoozedStatus, snoozedUntil });
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
      `SELECT COUNT(*) as count FROM emails WHERE user_id = $1 AND is_draft = true AND is_deleted = false`,
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
      is_snoozed: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      cc: string | null;
      bcc: string | null;
      snoozed_until: Date | null;
    }>(
      `SELECT id, subject, sender as "from", recipient as "to", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, has_attachments, is_scheduled, is_draft, scheduled_for, cc, bcc
       FROM emails
       WHERE user_id = $1 AND is_draft = true AND is_deleted = false
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
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      cc: email.cc,
      bcc: email.bcc,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drafts', details: getErrorMessage(err) });
  }
});

// Save a new draft
app.post('/api/emails/draft', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { to, subject, body, cc, bcc } = req.body;
  const has_attachments = !!req.body.has_attachments || /data-file-card/i.test(body || '');
  try {
    const result = await pool.query<{ id: number }>(
      'INSERT INTO emails (user_id, sender, recipient, subject, body, cc, bcc, is_draft, has_attachments, sent_at) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW()) RETURNING id',
      [req.user!.id, req.user!.email, to || '', subject || '', body || '', cc || null, bcc || null, has_attachments]
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
  const { to, subject, body, cc, bcc } = req.body;
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
    const has_attachments = !!req.body.has_attachments || /data-file-card/i.test(body || '');
    await pool.query(
      'UPDATE emails SET recipient = $1, subject = $2, body = $3, cc = $4, bcc = $5, has_attachments = $6 WHERE id = $7',
      [to || '', subject || '', body || '', cc || null, bcc || null, has_attachments, id]
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
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_archived = true AND (recipient = $1 OR sender = $1) AND is_deleted = false AND is_scheduled = false ${groupExclusion}`,
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
      is_snoozed: boolean;
      is_read: boolean;
      is_muted: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      snoozed_until: Date | null;
      group_id: number | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, is_read, is_muted, has_attachments, is_scheduled, is_draft, scheduled_for, group_id
       FROM emails
       WHERE is_archived = true AND (recipient = $1 OR sender = $1) AND is_deleted = false AND is_scheduled = false ${groupExclusion}
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isArchived: true,
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      groupId: email.group_id || null,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch archived emails', details: getErrorMessage(err) });
  }
});

// Archive email endpoint
app.put('/api/emails/:id/archive', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { is_archived } = req.body;
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

    const newArchivedStatus = typeof is_archived === 'boolean' ? is_archived : !email.is_archived;
    await pool.query(
      'UPDATE emails SET is_archived = $1, is_deleted = false WHERE id = $2',
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
      `SELECT COUNT(*) as count FROM emails WHERE is_purchased = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`,
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
      is_snoozed: boolean;
      is_read: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      snoozed_until: Date | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, is_read, has_attachments, is_scheduled, is_draft
       FROM emails
       WHERE is_purchased = true AND (recipient = $1 OR sender = $1) AND is_deleted = false
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isPurchased: true,
      isRead: email.is_read,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
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

// Groups endpoints

// Cosmetic-only address shown in the group editor, styled after Outlook's auto-generated
// group email — this app has no distribution-list/routing concept, so it's display-only.
// Falls back to a slug+id when the user hasn't picked a custom local part.
function buildGroupEmail(name: string, id: number, emailLocal?: string | null): string {
  if (emailLocal) return `${emailLocal}@groups.local`;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'group';
  return `${slug}${id}@groups.local`;
}

function normalizeEmailLocal(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 50);
}

// Viewing a group's members/events/emails is allowed for its owner or for any of its
// members (so a member sees the same group data the owner does, like Outlook/Google Groups).
async function getGroupViewAccess(groupId: string | string[], userId: number, userEmail: string): Promise<{ found: boolean; allowed: boolean; isOwner: boolean }> {
  const groupResult = await pool.query<{ user_id: number }>('SELECT user_id FROM groups WHERE id = $1', [groupId]);
  if (groupResult.rows.length === 0) return { found: false, allowed: false, isOwner: false };
  const isOwner = groupResult.rows[0].user_id === userId;
  if (isOwner) return { found: true, allowed: true, isOwner: true };
  const memberResult = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND email = $2',
    [groupId, userEmail]
  );
  return { found: true, allowed: memberResult.rows.length > 0, isOwner: false };
}

// Get all groups for the user
app.get('/api/groups', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ id: number; name: string; color: string; description: string | null; photo_url: string | null; email_local: string | null; member_count: string }>(
      `SELECT g.id, g.name, g.color, g.description, g.photo_url, g.email_local, COUNT(gm.id)::varchar as member_count
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [req.user!.id]
    );
    const groups = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      description: row.description,
      photoUrl: row.photo_url,
      emailLocal: row.email_local,
      groupEmail: buildGroupEmail(row.name, row.id, row.email_local),
      memberCount: parseInt(row.member_count, 10)
    }));
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups', details: getErrorMessage(err) });
  }
});

// Groups the current user has been added to as a member (by another user/owner) — mirrors
// how an Outlook/Google Group shows up in a member's own client, not just the owner's.
app.get('/api/groups/member-of', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ id: number; name: string; color: string; description: string | null; photo_url: string | null; email_local: string | null; owner_email: string; member_count: string }>(
      `SELECT g.id, g.name, g.color, g.description, g.photo_url, g.email_local, u.email as owner_email, COUNT(gm2.id)::varchar as member_count
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id AND gm.email = $1
       JOIN users u ON u.id = g.user_id
       LEFT JOIN group_members gm2 ON gm2.group_id = g.id
       WHERE g.user_id != $2
       GROUP BY g.id, u.email
       ORDER BY g.created_at DESC`,
      [req.user!.email, req.user!.id]
    );
    const groups = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      description: row.description,
      photoUrl: row.photo_url,
      emailLocal: row.email_local,
      groupEmail: buildGroupEmail(row.name, row.id, row.email_local),
      ownerEmail: row.owner_email,
      memberCount: parseInt(row.member_count, 10)
    }));
    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups you belong to', details: getErrorMessage(err) });
  }
});

// Check whether a group email local-part is available (globally unique across all groups)
app.get('/api/groups/check-email', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const raw = (req.query.local as string) || '';
  const excludeId = req.query.excludeId as string | undefined;
  const local = normalizeEmailLocal(raw);
  if (!local || local.length < 3) {
    res.json({ available: false, reason: 'Must be at least 3 characters' });
    return;
  }
  try {
    const result = await pool.query<{ id: number }>(
      'SELECT id FROM groups WHERE email_local = $1' + (excludeId ? ' AND id != $2' : ''),
      excludeId ? [local, excludeId] : [local]
    );
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check availability', details: getErrorMessage(err) });
  }
});

// All email addresses that belong to any of the current user's groups — lets the client
// determine "is this contact already grouped" without N+1 fetching each group's members.
app.get('/api/group-members/all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ email: string }>(
      `SELECT DISTINCT gm.email
       FROM group_members gm
       JOIN groups g ON gm.group_id = g.id
       WHERE g.user_id = $1`,
      [req.user!.id]
    );
    res.json({ emails: result.rows.map(row => row.email) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group members', details: getErrorMessage(err) });
  }
});

// Create a new group
app.post('/api/groups', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { name, color, description, photoUrl, emailLocal } = req.body;
  if (!name || name.trim().length === 0) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }
  if (name.length > 100) {
    res.status(400).json({ error: 'Group name is too long' });
    return;
  }
  const normalizedEmailLocal = emailLocal ? normalizeEmailLocal(emailLocal) : null;
  if (emailLocal && (!normalizedEmailLocal || normalizedEmailLocal.length < 3)) {
    res.status(400).json({ error: 'Group email must be at least 3 characters' });
    return;
  }
  try {
    const result = await pool.query<{ id: number; name: string; color: string; description: string | null; photo_url: string | null; email_local: string | null }>(
      'INSERT INTO groups (user_id, name, color, description, photo_url, email_local) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, color, description, photo_url, email_local',
      [req.user!.id, name, color || '#1976d2', description || null, photoUrl || null, normalizedEmailLocal]
    );
    const group = result.rows[0];
    res.status(201).json({
      group: {
        id: group.id,
        name: group.name,
        color: group.color,
        description: group.description,
        photoUrl: group.photo_url,
        emailLocal: group.email_local,
        groupEmail: buildGroupEmail(group.name, group.id, group.email_local),
        memberCount: 0
      }
    });
  } catch (err: any) {
    if (getPgErrorCode(err) === '23505') {
      const detail = getErrorMessage(err);
      if (detail.includes('email_local')) {
        res.status(409).json({ error: 'Group email address is already taken' });
      } else {
        res.status(409).json({ error: 'Group name already exists' });
      }
    } else {
      res.status(500).json({ error: 'Failed to create group', details: getErrorMessage(err) });
    }
  }
});

// Update a group's name, color, description, photo, or email local-part
app.patch('/api/groups/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, color, description, photoUrl, emailLocal } = req.body;
  if (name !== undefined && name.trim().length === 0) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }
  if (name !== undefined && name.length > 100) {
    res.status(400).json({ error: 'Group name is too long' });
    return;
  }
  const normalizedEmailLocal = emailLocal !== undefined ? normalizeEmailLocal(emailLocal) : undefined;
  if (normalizedEmailLocal !== undefined && normalizedEmailLocal.length < 3) {
    res.status(400).json({ error: 'Group email must be at least 3 characters' });
    return;
  }
  try {
    const groupResult = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM groups WHERE id = $1',
      [id]
    );
    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (groupResult.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    const result = await pool.query<{ id: number; name: string; color: string; description: string | null; photo_url: string | null; email_local: string | null }>(
      `UPDATE groups SET
         name = COALESCE($1, name),
         color = COALESCE($2, color),
         description = COALESCE($3, description),
         photo_url = COALESCE($4, photo_url),
         email_local = COALESCE($5, email_local)
       WHERE id = $6
       RETURNING id, name, color, description, photo_url, email_local`,
      [name ?? null, color ?? null, description ?? null, photoUrl ?? null, normalizedEmailLocal ?? null, id]
    );
    const group = result.rows[0];
    res.json({
      group: {
        id: group.id,
        name: group.name,
        color: group.color,
        description: group.description,
        photoUrl: group.photo_url,
        emailLocal: group.email_local,
        groupEmail: buildGroupEmail(group.name, group.id, group.email_local)
      }
    });
  } catch (err: any) {
    if (getPgErrorCode(err) === '23505') {
      const detail = getErrorMessage(err);
      if (detail.includes('email_local')) {
        res.status(409).json({ error: 'Group email address is already taken' });
      } else {
        res.status(409).json({ error: 'Group name already exists' });
      }
    } else {
      res.status(500).json({ error: 'Failed to update group', details: getErrorMessage(err) });
    }
  }
});

// Delete a group
app.delete('/api/groups/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // Verify group ownership
    const groupResult = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM groups WHERE id = $1',
      [id]
    );
    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (groupResult.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    await pool.query('DELETE FROM groups WHERE id = $1', [id]);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group', details: getErrorMessage(err) });
  }
});

// Get members of a group
app.get('/api/groups/:id/members', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const access = await getGroupViewAccess(id, req.user!.id, req.user!.email);
    if (!access.found) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (!access.allowed) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    const result = await pool.query<{ email: string }>(
      'SELECT email FROM group_members WHERE group_id = $1 ORDER BY added_at ASC',
      [id]
    );
    res.json({ members: result.rows.map(row => row.email) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members', details: getErrorMessage(err) });
  }
});

// Add a member to a group
app.post('/api/groups/:id/members', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { email } = req.body;
  if (!email || email.trim().length === 0) {
    res.status(400).json({ error: 'Member email is required' });
    return;
  }
  try {
    // Verify group ownership
    const groupResult = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM groups WHERE id = $1',
      [id]
    );
    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (groupResult.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    await pool.query(
      'INSERT INTO group_members (group_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, email]
    );
    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member', details: getErrorMessage(err) });
  }
});

// Remove a member from a group — the owner can remove anyone; a member can remove themselves
// (self-service "leave group", same as Outlook/Google Groups membership).
app.delete('/api/groups/:id/members/:email', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id, email } = req.params;
  const decodedEmail = decodeURIComponent(Array.isArray(email) ? email[0] : email);
  try {
    const groupResult = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM groups WHERE id = $1',
      [id]
    );
    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    const isOwner = groupResult.rows[0].user_id === req.user!.id;
    const isSelf = decodedEmail.toLowerCase() === req.user!.email.toLowerCase();
    if (!isOwner && !isSelf) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND email = $2', [id, decodedEmail]);
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member', details: getErrorMessage(err) });
  }
});

// Get events for a group
app.get('/api/groups/:id/events', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const access = await getGroupViewAccess(id, req.user!.id, req.user!.email);
    if (!access.found) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (!access.allowed) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    const result = await pool.query<{ id: number; title: string; description: string | null; event_date: Date; end_date: Date | null; location: string | null; is_online: boolean; attendees: string[] | null }>(
      'SELECT id, title, description, event_date, end_date, location, is_online, attendees FROM group_events WHERE group_id = $1 ORDER BY event_date ASC',
      [id]
    );
    const events = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.event_date,
      endDate: row.end_date,
      location: row.location,
      isOnline: row.is_online,
      attendees: row.attendees || []
    }));
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events', details: getErrorMessage(err) });
  }
});

// Create an event for a group
app.post('/api/groups/:id/events', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, description, date, endDate, location, isOnline, attendees } = req.body;
  if (!title || title.trim().length === 0) {
    res.status(400).json({ error: 'Event title is required' });
    return;
  }
  if (!date) {
    res.status(400).json({ error: 'Event date is required' });
    return;
  }
  try {
    // Verify group ownership
    const groupResult = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM groups WHERE id = $1',
      [id]
    );
    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (groupResult.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    const result = await pool.query<{ id: number; title: string; description: string | null; event_date: Date; end_date: Date | null; location: string | null; is_online: boolean; attendees: string[] | null }>(
      'INSERT INTO group_events (group_id, title, description, event_date, end_date, location, is_online, attendees) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, title, description, event_date, end_date, location, is_online, attendees',
      [id, title, description || null, date, endDate || null, location || null, !!isOnline, Array.isArray(attendees) ? attendees : []]
    );
    const event = result.rows[0];
    res.status(201).json({
      event: {
        id: event.id, title: event.title, description: event.description,
        date: event.event_date, endDate: event.end_date, location: event.location, isOnline: event.is_online,
        attendees: event.attendees || []
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event', details: getErrorMessage(err) });
  }
});

// Update an event's time/title/location/etc. — used by the drag-to-resize day view
app.patch('/api/groups/:id/events/:eventId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id, eventId } = req.params;
  const { title, description, date, endDate, location, isOnline, attendees } = req.body;
  try {
    const groupResult = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM groups WHERE id = $1',
      [id]
    );
    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (groupResult.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    const result = await pool.query<{ id: number; title: string; description: string | null; event_date: Date; end_date: Date | null; location: string | null; is_online: boolean; attendees: string[] | null }>(
      `UPDATE group_events SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         event_date = COALESCE($3, event_date),
         end_date = COALESCE($4, end_date),
         location = COALESCE($5, location),
         is_online = COALESCE($6, is_online),
         attendees = COALESCE($7, attendees)
       WHERE id = $8 AND group_id = $9
       RETURNING id, title, description, event_date, end_date, location, is_online, attendees`,
      [title ?? null, description ?? null, date ?? null, endDate ?? null, location ?? null, isOnline ?? null, Array.isArray(attendees) ? attendees : null, eventId, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    const event = result.rows[0];
    res.json({
      event: {
        id: event.id, title: event.title, description: event.description,
        date: event.event_date, endDate: event.end_date, location: event.location, isOnline: event.is_online,
        attendees: event.attendees || []
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event', details: getErrorMessage(err) });
  }
});

// Delete an event from a group
app.delete('/api/groups/:id/events/:eventId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id, eventId } = req.params;
  try {
    // Verify group ownership
    const groupResult = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM groups WHERE id = $1',
      [id]
    );
    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (groupResult.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    await pool.query('DELETE FROM group_events WHERE id = $1 AND group_id = $2', [eventId, id]);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event', details: getErrorMessage(err) });
  }
});

// Maps the group emails filter tabs (all/inbox/sent/schedule/...) to a SQL condition on `e`.
// $1 is always the current user's email in the queries this is spliced into.
// When the caller (the regular Inbox/Sent/etc. folder views in AllMailsPage) passes
// excludeGroups=true, hide group-compose messages — those live only in the Groups page
// and Chat Mail's dedicated group thread, never mixed into an individual mail folder.
function excludeGroupsClause(req: Request, alias = ''): string {
  if (req.query.excludeGroups !== 'true') return '';
  return `AND ${alias ? alias + '.' : ''}group_id IS NULL`;
}

function groupEmailFilterClause(filter: unknown): string {
  switch (filter) {
    case 'inbox': return 'e.sender != $1 AND e.is_draft = false AND e.is_archived = false AND e.is_deleted = false AND e.is_scheduled = false';
    case 'sent': return 'e.sender = $1';
    case 'schedule': return 'e.is_scheduled = true';
    case 'starred': return 'e.is_starred = true';
    case 'snoozed': return 'e.is_snoozed = true';
    case 'draft': return 'e.is_draft = true';
    case 'archive': return 'e.is_archived = true';
    case 'report': return 'e.is_report = true';
    case 'delete': return 'e.is_deleted = true';
    case 'all':
    default: return 'e.is_deleted = false';
  }
}

// Get this group's own messages — emails actually sent via "Compose to group" (tagged
// with this group's id), not just any email exchanged with one of its members.
app.get('/api/groups/:id/emails', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const filterClause = groupEmailFilterClause(req.query.filter);
  try {
    const access = await getGroupViewAccess(id, req.user!.id, req.user!.email);
    if (!access.found) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (!access.allowed) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // A group send stores one row per recipient (so each member's own inbox actually gets
    // it — see /api/send). For the sender, that means N rows all with sender = them; only
    // the original row (recipient = the full joined list, not any one member's exact
    // address) represents "my own copy" — exclude the rows that exist purely to deliver
    // the message into another specific member's inbox.
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT e.id) as count FROM emails e
       WHERE e.group_id = $2 AND ${filterClause}
         AND (e.recipient = $1 OR (e.sender = $1 AND NOT EXISTS (
           SELECT 1 FROM group_members gm2 WHERE gm2.group_id = $2 AND gm2.email = e.recipient AND gm2.email != $1
         )))`,
      [req.user!.email, id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query<{
      id: number;
      subject: string | null;
      sender: string;
      recipient: string;
      sent_at: Date;
      body: string | null;
      is_starred: boolean;
      is_snoozed: boolean;
      is_read: boolean;
      is_draft: boolean;
      is_archived: boolean;
      is_deleted: boolean;
      is_scheduled: boolean;
      scheduled_for: Date | null;
      is_report: boolean;
      has_attachments: boolean;
      label_name: string | null;
      snoozed_until: Date | null;
    }>(
      `SELECT DISTINCT e.id, e.subject, e.sender, e.recipient, e.sent_at, e.body, e.is_starred, e.is_snoozed, e.snoozed_until, e.is_read, e.is_draft,
              e.is_archived, e.is_deleted, e.is_scheduled, e.scheduled_for, e.is_report, e.has_attachments, e.label_name
       FROM emails e
       WHERE e.group_id = $2 AND ${filterClause}
         AND (e.recipient = $1 OR (e.sender = $1 AND NOT EXISTS (
           SELECT 1 FROM group_members gm2 WHERE gm2.group_id = $2 AND gm2.email = e.recipient AND gm2.email != $1
         )))
       ORDER BY e.sent_at DESC LIMIT $3 OFFSET $4`,
      [req.user!.email, id, limit, offset]
    );

    const emails = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.sender,
      to: email.recipient,
      date: email.sent_at,
      body: email.body,
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isRead: email.is_read,
      isDraft: email.is_draft,
      isArchived: email.is_archived,
      isDeleted: email.is_deleted,
      isScheduled: email.is_scheduled,
      scheduledFor: email.scheduled_for,
      isReport: email.is_report,
      hasAttachments: email.has_attachments,
      label: email.label_name,
      label_name: email.label_name
    }));

    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group emails', details: getErrorMessage(err) });
  }
});

// Tag/untag an email to a group
app.put('/api/emails/:emailId/group-tag', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { emailId } = req.params;
  const { groupId, tagged } = req.body;
  if (groupId === undefined || tagged === undefined) {
    res.status(400).json({ error: 'groupId and tagged are required' });
    return;
  }
  try {
    // Verify email ownership
    const emailResult = await pool.query<{ sender: string; recipient: string }>(
      'SELECT sender, recipient FROM emails WHERE id = $1',
      [emailId]
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

    // Verify group ownership
    const groupResult = await pool.query<{ user_id: number }>(
      'SELECT user_id FROM groups WHERE id = $1',
      [groupId]
    );
    if (groupResult.rows.length === 0) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    if (groupResult.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    if (tagged) {
      await pool.query(
        'INSERT INTO email_groups (email_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [emailId, groupId]
      );
    } else {
      await pool.query('DELETE FROM email_groups WHERE email_id = $1 AND group_id = $2', [emailId, groupId]);
    }

    res.json({ message: 'Email group tag updated', tagged });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group tag', details: getErrorMessage(err) });
  }
});

// Get all mails endpoint
app.get('/api/allmails', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const groupExclusion = excludeGroupsClause(req, 'e');

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE (recipient = $1 OR sender = $1) ${excludeGroupsClause(req)}`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get all emails including drafts (inbox, sent, drafts, scheduled, labeled, starred, snoozed, important, spam, delete, etc.)
    const result = await pool.query<{
      id: number;
      subject: string | null;
      from: string;
      to: string;
      date: Date;
      body: string | null;
      sender: string;
      recipient: string;
      is_starred: boolean;
      is_snoozed: boolean;
      snoozed_until: Date | null;
      snooze_count: string;
      is_read: boolean;
      is_spam: boolean;
      is_muted: boolean;
      is_scheduled: boolean;
      scheduled_for: Date | null;
      is_draft: boolean;
      is_archived: boolean;
      is_deleted: boolean;
      label_name: string | null;
      label_color: string | null;
      has_attachments: boolean;
      is_report: boolean;
      is_pinned: boolean;
      group_id: number | null;
    }>(
      `SELECT e.id, e.subject, e.sender, e.recipient, e.recipient as "to", e.sender as "from", e.sent_at as "date", e.body, e.is_starred, e.is_snoozed, e.snoozed_until, COALESCE(array_length(e.snooze_dates, 1), 0) as snooze_count, e.is_read, e.is_spam, e.is_muted, e.is_scheduled, e.scheduled_for, e.is_draft, e.is_archived, e.is_deleted, e.label_name, l.color as label_color, e.has_attachments, e.is_report, e.is_pinned, e.group_id
       FROM emails e
       LEFT JOIN labels l ON e.label_name = l.name AND l.user_id = $2
       WHERE (e.recipient = $1 OR e.sender = $1) ${groupExclusion}
       ORDER BY e.is_pinned DESC, e.sent_at DESC LIMIT $3 OFFSET $4`,
      [req.user!.email, req.user!.id, limit, offset]
    );
    const emails: any[] = result.rows.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      snoozeCount: Number(email.snooze_count),
      isRead: email.is_read,
      isSpam: email.is_spam,
      isMuted: email.is_muted,
      isArchived: email.is_archived,
      isDeleted: email.is_deleted,
      label_name: email.label_name,
      label_color: email.label_color,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      scheduledFor: email.scheduled_for,
      isDraft: email.is_draft || false,
      isReport: email.is_report || false,
      isPinned: email.is_pinned || false,
      groupId: email.group_id || null,
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
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE scheduled_for IS NOT NULL AND (recipient = $1 OR sender = $1) AND is_deleted = false ${groupExclusion}`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get all scheduled emails: pending (is_scheduled=true) and already sent (is_scheduled=false but scheduled_for set)
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
      snoozed_until: Date | null;
      scheduled_for: Date | null;
      is_read: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      group_id: number | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, scheduled_for, is_read, has_attachments, is_scheduled, is_draft, group_id
       FROM emails
       WHERE scheduled_for IS NOT NULL AND (recipient = $1 OR sender = $1) AND is_deleted = false ${groupExclusion}
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      scheduledFor: email.scheduled_for,
      isRead: email.is_read,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      groupId: email.group_id || null,
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
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_important = true AND (recipient = $1 OR sender = $1) AND is_deleted = false ${groupExclusion}`,
      [req.user!.email]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body,
              is_starred, is_snoozed, snoozed_until, is_read, is_muted, has_attachments,
              is_scheduled, is_draft, scheduled_for, is_archived, is_deleted, is_spam, label_name, group_id
       FROM emails
       WHERE is_important = true AND (recipient = $1 OR sender = $1) AND is_deleted = false ${groupExclusion}
       ORDER BY sent_at DESC LIMIT $2 OFFSET $3`,
      [req.user!.email, limit, offset]
    );
    const emails: any[] = result.rows.map((email: any) => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      isArchived: email.is_archived,
      isDeleted: email.is_deleted,
      isSpam: email.is_spam,
      isImportant: true,
      label_name: email.label_name,
      groupId: email.group_id || null,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch important emails', details: getErrorMessage(err) });
  }
});

// Toggle important status endpoint
app.put('/api/emails/:id/important', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const check = await pool.query<{ is_important: boolean; sender: string; recipient: string }>(
      'SELECT is_important, sender, recipient FROM emails WHERE id = $1',
      [id]
    );
    if (check.rows.length === 0) { res.status(404).json({ error: 'Email not found' }); return; }
    const { sender, recipient } = check.rows[0];
    if (sender !== req.user!.email && recipient !== req.user!.email) { res.status(403).json({ error: 'Unauthorized' }); return; }
    const newVal = !check.rows[0].is_important;
    await pool.query('UPDATE emails SET is_important = $1 WHERE id = $2', [newVal, id]);
    res.json({ message: 'Important status updated', isImportant: newVal });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle important status', details: getErrorMessage(err) });
  }
});

// Get spam emails endpoint
app.get('/api/spam', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_spam = true AND recipient = $1 AND is_scheduled = false AND is_deleted = false ${groupExclusion}`,
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
      is_snoozed: boolean;
      is_read: boolean;
      is_muted: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      snoozed_until: Date | null;
      group_id: number | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, is_read, is_muted, has_attachments, is_scheduled, is_draft, scheduled_for, group_id
       FROM emails
       WHERE is_spam = true AND recipient = $1 AND is_scheduled = false AND is_deleted = false ${groupExclusion}
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isSpam: true,
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      groupId: email.group_id || null,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch spam emails', details: getErrorMessage(err) });
  }
});

// Mark email as spam endpoint
app.put('/api/emails/:id/spam', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { is_spam } = req.body;
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

    const newSpamStatus = typeof is_spam === 'boolean' ? is_spam : !email.is_spam;
    await pool.query(
      'UPDATE emails SET is_spam = $1, is_deleted = false WHERE id = $2',
      [newSpamStatus, id]
    );

    res.json({ message: 'Email spam status updated', isSpam: newSpamStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as spam', details: getErrorMessage(err) });
  }
});

// Mute/unmute email endpoint
app.put('/api/emails/:id/mute', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { is_muted } = req.body;

  try {
    // First, get the email
    const emailResult = await pool.query<{ sender: string; recipient: string }>(
      'SELECT sender, recipient FROM emails WHERE id = $1',
      [id]
    );

    if (emailResult.rows.length === 0) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    const email = emailResult.rows[0];
    // Only allow if user is sender or recipient
    if (email.sender !== req.user!.email && email.recipient !== req.user!.email) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // Update the muted status
    await pool.query(
      'UPDATE emails SET is_muted = $1 WHERE id = $2',
      [is_muted, id]
    );

    res.json({ message: 'Email mute status updated', isMuted: is_muted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update mute status', details: getErrorMessage(err) });
  }
});

// Get delete emails endpoint
app.get('/api/delete', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_deleted = true AND (recipient = $1 OR sender = $1) ${groupExclusion}`,
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
      is_snoozed: boolean;
      is_read: boolean;
      is_muted: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      snoozed_until: Date | null;
      group_id: number | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, is_read, is_muted, has_attachments, is_scheduled, is_draft, scheduled_for, group_id
       FROM emails
       WHERE is_deleted = true AND (recipient = $1 OR sender = $1) ${groupExclusion}
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isDeleted: true,
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      groupId: email.group_id || null,
    }));
    res.json({ emails, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch delete emails', details: getErrorMessage(err) });
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

    // Toggle the deleted status; when deleting, strip all folder/label flags
    const newDeletedStatus = !email.is_deleted;
    if (newDeletedStatus) {
      await pool.query(
        `UPDATE emails SET is_deleted = true,
          is_starred = false, is_archived = false, is_snoozed = false,
          is_spam = false, is_subscription = false,
          is_scheduled = false, label_name = NULL
         WHERE id = $1`,
        [id]
      );
    } else {
      await pool.query('UPDATE emails SET is_deleted = false WHERE id = $1', [id]);
    }

    res.json({ message: 'Email deleted status updated', isDeleted: newDeletedStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete email', details: getErrorMessage(err) });
  }
});

app.put('/api/emails/:id/restore', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE emails SET is_deleted = false WHERE id = $1 AND (recipient = $2 OR sender = $2)`,
      [id, req.user!.email]
    );
    if (result.rowCount === 0) { res.status(404).json({ error: 'Email not found' }); return; }
    res.json({ message: 'Email restored' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore email', details: getErrorMessage(err) });
  }
});

app.put('/api/emails/:id/move', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { destination } = req.body;
  try {
    const check = await pool.query('SELECT sender, recipient FROM emails WHERE id = $1', [id]);
    if (check.rows.length === 0) { res.status(404).json({ error: 'Email not found' }); return; }
    const { sender, recipient } = check.rows[0];
    if (sender !== req.user!.email && recipient !== req.user!.email) { res.status(403).json({ error: 'Unauthorized' }); return; }

    const updates: Record<string, string> = {
      inbox:     'is_deleted=false, is_archived=false, is_spam=false, is_snoozed=false',
      archive:   'is_archived=true,  is_deleted=false, is_spam=false',
      spam:      'is_spam=true,      is_deleted=false, is_archived=false',
      trash:     'is_deleted=true,   is_archived=false, is_spam=false',
      starred:   'is_starred=true',
      important: 'is_important=true',
    };
    if (!updates[destination]) { res.status(400).json({ error: 'Invalid destination' }); return; }
    await pool.query(`UPDATE emails SET ${updates[destination]} WHERE id = $1`, [id]);
    res.json({ message: 'Email moved', destination });
  } catch (err) {
    res.status(500).json({ error: 'Failed to move email', details: String(err) });
  }
});

app.delete('/api/emails/:id/permanent', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userEmail = req.user!.email;
  try {
    const result = await pool.query(
      'DELETE FROM emails WHERE id = $1 AND (recipient = $2 OR sender = $2)',
      [id, userEmail]
    );
    if (result.rowCount === 0) { res.status(404).json({ error: 'Email not found' }); return; }
    res.json({ message: 'Email permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to permanently delete email', details: getErrorMessage(err) });
  }
});

// Get subscription emails endpoint
app.get('/api/subscriptions', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const groupExclusion = excludeGroupsClause(req);

    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM emails WHERE is_subscription = true AND (recipient = $1 OR sender = $1) AND is_deleted = false AND is_scheduled = false ${groupExclusion}`,
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
      is_snoozed: boolean;
      is_read: boolean;
      is_muted: boolean;
      has_attachments: boolean;
      is_scheduled: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      snoozed_until: Date | null;
      group_id: number | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, is_read, is_muted, has_attachments, is_scheduled, is_draft, scheduled_for, group_id
       FROM emails
       WHERE is_subscription = true AND (recipient = $1 OR sender = $1) AND is_deleted = false AND is_scheduled = false ${groupExclusion}
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isSubscription: true,
      isRead: email.is_read,
      isMuted: email.is_muted,
      hasAttachments: email.has_attachments,
      isScheduled: email.is_scheduled || false,
      isDraft: email.is_draft || false,
      scheduledFor: email.scheduled_for,
      groupId: email.group_id || null,
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

// Get report emails endpoint
app.get('/api/reports', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const userEmail = req.user!.email;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;
  const groupExclusion = excludeGroupsClause(req, 'e');
  try {
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM emails WHERE is_report = true AND (recipient = $1 OR sender = $1) AND is_deleted = false ${excludeGroupsClause(req)}`,
      [userEmail]
    );
    const total = parseInt(countResult.rows[0].count);
    const unreadResult = await pool.query(
      `SELECT COUNT(*) as count FROM emails WHERE is_report = true AND recipient = $1 AND is_read = false AND is_deleted = false ${excludeGroupsClause(req)}`,
      [userEmail]
    );
    const unread = parseInt(unreadResult.rows[0].count);
    const result = await pool.query(
      `SELECT e.id, e.subject, e.sender as "from", e.recipient as "to", e.sent_at as "date", e.body,
              e.is_starred as "isStarred", e.is_read as "isRead", e.is_snoozed as "isSnoozed", e.snoozed_until as "snoozedUntil",
              e.is_spam as "isSpam", e.is_deleted as "isDeleted",
              e.is_archived as "isArchived", e.is_scheduled as "isScheduled", e.scheduled_for as "scheduledFor", e.is_muted as "isMuted",
              e.has_attachments as "hasAttachments", e.label_name, l.color as label_color, e.group_id as "groupId",
              CASE WHEN e.sender = $1 THEN 'sent' ELSE 'inbox' END as folder
       FROM emails e
       LEFT JOIN labels l ON e.label_name = l.name AND l.user_id = (SELECT id FROM users WHERE email = $1 LIMIT 1)
       WHERE e.is_report = true AND (e.recipient = $1 OR e.sender = $1) AND e.is_deleted = false ${groupExclusion}
       ORDER BY e.sent_at DESC LIMIT $2 OFFSET $3`,
      [userEmail, limit, offset]
    );
    res.json({ emails: result.rows, total, unread });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report emails', details: getErrorMessage(err) });
  }
});

// Toggle pin status
app.put('/api/emails/:id/pin', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userEmail = req.user!.email;
  const { is_pinned } = req.body;
  try {
    const result = await pool.query<{ is_pinned: boolean }>(
      'SELECT is_pinned FROM emails WHERE id = $1 AND (recipient = $2 OR sender = $2)',
      [id, userEmail]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Email not found' }); return; }
    const newVal = typeof is_pinned === 'boolean' ? is_pinned : !result.rows[0].is_pinned;
    await pool.query('UPDATE emails SET is_pinned = $1 WHERE id = $2', [newVal, id]);
    res.json({ isPinned: newVal });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle pin', details: getErrorMessage(err) });
  }
});

// Toggle report status
app.put('/api/emails/:id/report', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userEmail = req.user!.email;
  const { is_report } = req.body;
  try {
    const result = await pool.query<{ is_report: boolean }>(
      'SELECT is_report FROM emails WHERE id = $1 AND (recipient = $2 OR sender = $2)',
      [id, userEmail]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Email not found' }); return; }
    const newVal = typeof is_report === 'boolean' ? is_report : !result.rows[0].is_report;
    await pool.query('UPDATE emails SET is_report = $1 WHERE id = $2', [newVal, id]);
    res.json({ isReport: newVal });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle report', details: getErrorMessage(err) });
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

// Rename, recolor, or reparent a custom label
app.patch('/api/custom-labels/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const labelId = parseInt(id, 10);
  if (isNaN(labelId)) { res.status(400).json({ error: 'Invalid label ID' }); return; }
  const { name, color, parent_label_id } = req.body;
  if (!name && !color && parent_label_id === undefined) { res.status(400).json({ error: 'Provide name, color, or parent_label_id to update' }); return; }

  const fullPathCTE = `
    WITH RECURSIVE label_path AS (
      SELECT id, name, parent_label_id, name::text AS full_path
      FROM labels WHERE id = $1
      UNION ALL
      SELECT l.id, l.name, l.parent_label_id, (l.name || ' / ' || lp.full_path)::text
      FROM labels l
      INNER JOIN label_path lp ON l.id = lp.parent_label_id
    )
    SELECT full_path FROM label_path WHERE parent_label_id IS NULL`;

  try {
    // Verify label belongs to user
    const check = await pool.query('SELECT name FROM labels WHERE id = $1 AND user_id = $2', [labelId, req.user!.id]);
    if (check.rows.length === 0) { res.status(404).json({ error: 'Label not found' }); return; }

    // Capture old full path BEFORE any update
    const oldPathResult = await pool.query<{ full_path: string }>(fullPathCTE, [labelId]);
    const oldFullPath = oldPathResult.rows[0]?.full_path ?? check.rows[0].name;

    // Apply updates
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    let i = 1;
    if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
    if (color !== undefined) { fields.push(`color = $${i++}`); values.push(color); }
    if (parent_label_id !== undefined) { fields.push(`parent_label_id = $${i++}`); values.push(parent_label_id); }
    values.push(labelId, req.user!.id);
    const result = await pool.query(
      `UPDATE labels SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING id, name, color`,
      values
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Label not found' }); return; }

    // Capture new full path AFTER update (name or parent may have changed)
    const newPathResult = await pool.query<{ full_path: string }>(fullPathCTE, [labelId]);
    const newFullPath = newPathResult.rows[0]?.full_path ?? (name ?? check.rows[0].name);

    // Cascade to emails whenever the full path changed (rename OR reparent)
    if (newFullPath !== oldFullPath) {
      await pool.query(`
        UPDATE emails
        SET label_name = $1 || SUBSTRING(label_name FROM LENGTH($2) + 1)
        WHERE (label_name = $2 OR label_name LIKE $3)
          AND (recipient = $4 OR sender = $4)
      `, [newFullPath, oldFullPath, oldFullPath + ' / %', req.user!.email]);
    }

    res.json({ label: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update label', details: getErrorMessage(err) });
  }
});

// Mark all emails in a label as read or unread
app.put('/api/labels/:labelName/mark-all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { labelName } = req.params;
  const { is_read } = req.body;
  if (typeof is_read !== 'boolean') { res.status(400).json({ error: 'is_read boolean required' }); return; }
  try {
    await pool.query(
      'UPDATE emails SET is_read = $1 WHERE label_name = $2 AND recipient = $3',
      [is_read, labelName, req.user!.email]
    );
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update emails', details: getErrorMessage(err) });
  }
});

// Star/unstar all emails in a label
app.put('/api/labels/:labelName/star-all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const labelName = decodeURIComponent(Array.isArray(req.params.labelName) ? req.params.labelName[0] : req.params.labelName);
  const { is_starred } = req.body;
  if (typeof is_starred !== 'boolean') { res.status(400).json({ error: 'is_starred boolean required' }); return; }
  try {
    await pool.query(
      'UPDATE emails SET is_starred = $1 WHERE label_name = $2 AND (recipient = $3 OR sender = $3) AND is_deleted = false',
      [is_starred, labelName, req.user!.email]
    );
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to star emails', details: getErrorMessage(err) });
  }
});

// Snooze/unsnooze all emails in a label
app.put('/api/labels/:labelName/snooze-all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const labelName = decodeURIComponent(Array.isArray(req.params.labelName) ? req.params.labelName[0] : req.params.labelName);
  const { is_snoozed, hours = 24, undo_ids } = req.body;
  if (typeof is_snoozed !== 'boolean') { res.status(400).json({ error: 'is_snoozed boolean required' }); return; }
  try {
    if (undo_ids && Array.isArray(undo_ids)) {
      if (undo_ids.length === 0) { res.json({ message: 'Updated', ids: [] }); return; }
      if (is_snoozed) {
        await pool.query(`
          UPDATE emails SET is_snoozed = true,
            snoozed_until = CASE
              WHEN is_snoozed = true AND snoozed_until IS NOT NULL THEN snoozed_until + ($1 * interval '1 hour')
              ELSE NOW() + ($1 * interval '1 hour')
            END
          WHERE id = ANY($2::int[]) AND (recipient = $3 OR sender = $3) AND is_deleted = false
        `, [hours, undo_ids, req.user!.email]);
      } else {
        await pool.query(
          'UPDATE emails SET is_snoozed = false, snoozed_until = NULL WHERE id = ANY($1::int[]) AND (recipient = $2 OR sender = $2) AND is_deleted = false',
          [undo_ids, req.user!.email]
        );
      }
      res.json({ message: 'Updated', ids: undo_ids });
      return;
    }

    let result;
    if (is_snoozed) {
      result = await pool.query(`
        UPDATE emails SET is_snoozed = true,
          snoozed_until = CASE
            WHEN is_snoozed = true AND snoozed_until IS NOT NULL THEN snoozed_until + ($1 * interval '1 hour')
            ELSE NOW() + ($1 * interval '1 hour')
          END
        WHERE label_name = $2 AND (recipient = $3 OR sender = $3) AND is_deleted = false
        RETURNING id
      `, [hours, labelName, req.user!.email]);
    } else {
      result = await pool.query(
        'UPDATE emails SET is_snoozed = false, snoozed_until = NULL WHERE label_name = $1 AND (recipient = $2 OR sender = $2) AND is_deleted = false RETURNING id',
        [labelName, req.user!.email]
      );
    }
    res.json({ message: 'Updated', ids: result.rows.map(r => r.id) });
  } catch (err) { res.status(500).json({ error: getErrorMessage(err) }); }
});

// Empty a label (move all its emails to trash)
app.delete('/api/labels/:labelName/emails', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { labelName } = req.params;
  try {
    await pool.query(
      'UPDATE emails SET is_deleted = true, label_name = NULL WHERE label_name = $1 AND (recipient = $2 OR sender = $2)',
      [labelName, req.user!.email]
    );
    res.json({ message: 'Label emptied' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to empty label', details: getErrorMessage(err) });
  }
});

// Folder bulk operations (mark-all, star-all, important-all, empty)
app.put('/api/folders/:type/mark-all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const type = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
  const { is_read } = req.body;
  const userEmail = req.user!.email;
  const conditions: Record<string, string> = {
    inbox: `recipient = $2 AND is_deleted = false AND is_archived = false AND is_spam = false AND is_scheduled = false`,
    starred: `is_starred = true AND recipient = $2 AND is_deleted = false`,
    snoozed: `is_snoozed = true AND recipient = $2 AND is_deleted = false`,
    archived: `is_archived = true AND is_deleted = false AND recipient = $2`,
    archive: `is_archived = true AND is_deleted = false AND recipient = $2`,
    groups: `recipient = $2 AND is_deleted = false`,
    all: `recipient = $2 AND is_scheduled = false AND is_deleted = false`,
    spam: `is_spam = true AND recipient = $2 AND is_deleted = false`,
    delete: `is_deleted = true AND recipient = $2`,
    subscriptions: `is_subscription = true AND recipient = $2 AND is_deleted = false`,
    reports: `is_report = true AND recipient = $2 AND is_deleted = false`,
  };
  const where = conditions[type];
  if (!where) { res.status(400).json({ error: 'Unknown folder' }); return; }
  try {
    await pool.query(`UPDATE emails SET is_read = $1 WHERE ${where}`, [is_read, userEmail]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: getErrorMessage(err) }); }
});

app.put('/api/folders/:type/star-all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const type = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
  const { is_starred } = req.body;
  const userEmail = req.user!.email;
  const conditions: Record<string, string> = {
    inbox: `recipient = '${userEmail}' AND is_deleted = false AND is_archived = false AND is_spam = false`,
    sent: `sender = '${userEmail}' AND is_deleted = false`,
    starred: `is_starred = true AND (recipient = '${userEmail}' OR sender = '${userEmail}') AND is_deleted = false`,
    snoozed: `is_snoozed = true AND (recipient = '${userEmail}' OR sender = '${userEmail}') AND is_deleted = false`,
    drafts: `is_draft = true AND (recipient = '${userEmail}' OR sender = '${userEmail}') AND is_deleted = false`,
    archived: `is_archived = true AND is_deleted = false AND (recipient = '${userEmail}' OR sender = '${userEmail}')`,
    archive: `is_archived = true AND is_deleted = false AND (recipient = '${userEmail}' OR sender = '${userEmail}')`,
    groups: `recipient = '${userEmail}' AND is_deleted = false`,
    all: `(recipient = '${userEmail}' OR sender = '${userEmail}')`,
    scheduled: `is_scheduled = true AND (recipient = '${userEmail}' OR sender = '${userEmail}') AND is_deleted = false`,
    spam: `is_spam = true AND (recipient = '${userEmail}' OR sender = '${userEmail}') AND is_deleted = false`,
    delete: `is_deleted = true AND (recipient = '${userEmail}' OR sender = '${userEmail}')`,
    subscriptions: `is_subscription = true AND recipient = '${userEmail}' AND is_deleted = false`,
    reports: `is_report = true AND (recipient = '${userEmail}' OR sender = '${userEmail}') AND is_deleted = false`,
  };
  const where = conditions[type];
  if (!where) { res.status(400).json({ error: 'Unknown folder' }); return; }
  try {
    if (type === 'all' && is_starred) {
      // Star all non-deleted emails
      await pool.query(`UPDATE emails SET is_starred = true WHERE (recipient = '${userEmail}' OR sender = '${userEmail}') AND is_deleted = false`);
      // Star + restore ALL deleted items (sent, draft, scheduled, received), clear label
      await pool.query(`UPDATE emails SET is_starred = true, is_deleted = false, label_name = NULL WHERE (recipient = '${userEmail}' OR sender = '${userEmail}') AND is_deleted = true`);
    } else {
      await pool.query(`UPDATE emails SET is_starred = $1 WHERE ${where}`, [is_starred]);
    }
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: getErrorMessage(err) }); }
});

app.put('/api/folders/delete/restore-all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const userEmail = req.user!.email;
  try {
    await pool.query(
      `UPDATE emails SET is_deleted = false WHERE is_deleted = true AND (recipient = $1 OR sender = $1)`,
      [userEmail]
    );
    res.json({ message: 'All deleted emails restored' });
  } catch (err) { res.status(500).json({ error: getErrorMessage(err) }); }
});

app.put('/api/folders/:type/snooze-all', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const type = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
  const { is_snoozed, hours = 24, undo_ids } = req.body;
  const userEmail = req.user!.email;
  const conditions: Record<string, string> = {
    inbox: `recipient = $1 AND is_deleted = false AND is_archived = false AND is_spam = false AND is_scheduled = false`,
    sent: `sender = $1 AND is_deleted = false`,
    starred: `is_starred = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`,
    snoozed: `is_snoozed = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`,
    drafts: `is_draft = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`,
    archived: `is_archived = true AND is_deleted = false AND (recipient = $1 OR sender = $1)`,
    archive: `is_archived = true AND is_deleted = false AND (recipient = $1 OR sender = $1)`,
    groups: `recipient = $1 AND is_deleted = false`,
    all: `(recipient = $1 OR sender = $1)`,
    scheduled: `is_scheduled = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`,
    reports: `is_report = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`,
    spam: `is_spam = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`,
    delete: `is_deleted = true AND (recipient = $1 OR sender = $1)`,
    subscriptions: `is_subscription = true AND recipient = $1 AND is_deleted = false`,
  };

  if (undo_ids && Array.isArray(undo_ids)) {
    if (undo_ids.length === 0) { res.json({ message: 'Updated', ids: [] }); return; }
    try {
      if (is_snoozed) {
        await pool.query(`
          UPDATE emails 
          SET 
            is_snoozed = true, 
            snoozed_until = CASE 
              WHEN is_snoozed = true AND snoozed_until IS NOT NULL THEN snoozed_until + ($1 * interval '1 hour')
              ELSE NOW() + ($1 * interval '1 hour')
            END
          WHERE id = ANY($2::int[]) AND (recipient = $3 OR sender = $3)
        `, [hours, undo_ids, userEmail]);
      } else {
        await pool.query(`UPDATE emails SET is_snoozed = false, snoozed_until = NULL WHERE id = ANY($1::int[]) AND (recipient = $2 OR sender = $2)`, [undo_ids, userEmail]);
      }
      res.json({ message: 'Updated', ids: undo_ids });
    } catch (err) { res.status(500).json({ error: getErrorMessage(err) }); }
    return;
  }

  const where = conditions[type];
  if (!where) { res.status(400).json({ error: 'Unknown folder' }); return; }
  try {
    let result;
    if (is_snoozed) {
      result = await pool.query(`
        UPDATE emails 
        SET 
          is_snoozed = true, 
          snoozed_until = CASE 
            WHEN is_snoozed = true AND snoozed_until IS NOT NULL THEN snoozed_until + ($2 * interval '1 hour')
            ELSE NOW() + ($2 * interval '1 hour')
          END
        WHERE ${where}
        RETURNING id
      `, [userEmail, hours]);
    } else {
      result = await pool.query(`UPDATE emails SET is_snoozed = false, snoozed_until = NULL WHERE ${where} RETURNING id`, [userEmail]);
    }
    res.json({ message: 'Updated', ids: result.rows.map(r => r.id) });
  } catch (err) { res.status(500).json({ error: getErrorMessage(err) }); }
});

app.delete('/api/folders/:type/empty', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const type = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
  const userEmail = req.user!.email;
  try {
    if (type === 'delete') {
      await pool.query(`DELETE FROM emails WHERE is_deleted = true AND (recipient = $1 OR sender = $1)`, [userEmail]);
    } else if (type === 'spam') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE is_spam = true AND (recipient = $1 OR sender = $1)`, [userEmail]);
    } else if (type === 'drafts') {
      await pool.query(`DELETE FROM emails WHERE is_draft = true AND (recipient = $1 OR sender = $1)`, [userEmail]);
    } else if (type === 'archive' || type === 'archived') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE is_archived = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`, [userEmail]);
    } else if (type === 'inbox') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE recipient = $1 AND is_deleted = false AND is_archived = false AND is_spam = false AND is_scheduled = false`, [userEmail]);
    } else if (type === 'sent') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE sender = $1 AND is_deleted = false`, [userEmail]);
    } else if (type === 'starred') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE is_starred = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`, [userEmail]);
    } else if (type === 'snoozed') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE is_snoozed = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`, [userEmail]);
    } else if (type === 'subscriptions') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE is_subscription = true AND recipient = $1 AND is_deleted = false`, [userEmail]);
    } else if (type === 'scheduled') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE is_scheduled = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`, [userEmail]);
    } else if (type === 'reports') {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE is_report = true AND (recipient = $1 OR sender = $1) AND is_deleted = false`, [userEmail]);
    } else {
      await pool.query(`UPDATE emails SET is_deleted = true, is_starred = false, is_archived = false, is_snoozed = false, is_spam = false, is_subscription = false, is_scheduled = false, label_name = NULL WHERE (recipient = $1 OR sender = $1) AND is_deleted = false`, [userEmail]);
    }
    res.json({ message: 'Emptied' });
  } catch (err) { res.status(500).json({ error: getErrorMessage(err) }); }
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
      } else if (type === 'delete') {
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
      query = `UPDATE emails SET is_archived = true, is_deleted = false WHERE ${whereClause}`;
    } else if (action === 'delete') {
      query = `UPDATE emails SET is_deleted = true,
        is_starred = false, is_archived = false, is_snoozed = false,
        is_spam = false, is_subscription = false,
        is_scheduled = false, label_name = NULL
       WHERE ${whereClause}`;
    } else if (action === 'read') {
      // Always exclude sent/draft/scheduled from mark read/unread
      const readClause = all
        ? `recipient = $1 AND is_draft = false AND is_scheduled = false AND is_deleted = false`
        : `id = ANY($1::int[]) AND recipient = $2 AND is_draft = false AND is_scheduled = false`;
      query = `UPDATE emails SET is_read = ${value ? 'true' : 'false'} WHERE ${readClause}`;
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
    const labelName = decodeURIComponent(Array.isArray(req.params.labelName) ? req.params.labelName[0] : req.params.labelName);
    const userEmail = req.user!.email;

    const countResult = await pool.query<{ count: string; unread_count: string }>(
      `SELECT COUNT(*) as count, COUNT(CASE WHEN is_read = false AND recipient = $2 AND is_draft = false AND is_scheduled = false THEN 1 END) as unread_count
       FROM emails WHERE label_name = $1 AND (recipient = $2 OR sender = $2) AND is_deleted = false`,
      [labelName, userEmail]
    );
    const total = parseInt(countResult.rows[0].count, 10);
    const unread = parseInt(countResult.rows[0].unread_count, 10);

    const result = await pool.query(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, label_name, is_read, is_draft, scheduled_for, is_scheduled
       FROM emails
       WHERE label_name = $1 AND (recipient = $2 OR sender = $2) AND is_deleted = false
       ORDER BY sent_at DESC LIMIT $3 OFFSET $4`,
      [labelName, userEmail, limit, offset]
    );

    const emails: any[] = result.rows.map((email: any) => ({
      id: email.id,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      body: email.body,
      folder: email.is_draft ? 'drafts' : email.sender === userEmail ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isLabeled: true,
      label: email.label_name,
      label_name: email.label_name,
      isRead: email.is_read,
      isScheduled: email.is_scheduled || false,
      scheduledFor: email.scheduled_for,
    }));
    res.json({ emails, total, unread });
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
      `SELECT COUNT(*) as count FROM emails WHERE label_name IS NOT NULL AND (recipient = $1 OR sender = $1) AND is_deleted = false`,
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
      is_snoozed: boolean;
      label_name: string | null;
      is_read: boolean;
      is_draft: boolean;
      scheduled_for: Date | null;
      is_scheduled: boolean;
      snoozed_until: Date | null;
    }>(
      `SELECT id, subject, sender, recipient as "to", sender as "from", sent_at as "date", body, is_starred, is_snoozed, snoozed_until, label_name, is_read, is_draft, scheduled_for, is_scheduled
       FROM emails
       WHERE label_name IS NOT NULL AND (recipient = $1 OR sender = $1) AND is_deleted = false
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
      folder: email.is_draft ? 'drafts' : email.sender === req.user!.email ? 'sent' : 'inbox',
      isStarred: email.is_starred,
      isSnoozed: email.is_snoozed,
      snoozedUntil: email.snoozed_until,
      isLabeled: true,
      label: email.label_name,
      isRead: email.is_read,
      isScheduled: email.is_scheduled || false,
      scheduledFor: email.scheduled_for,
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

    const newLabelName = label_name || null;
    await pool.query(
      'UPDATE emails SET label_name = $1, is_deleted = false WHERE id = $2',
      [newLabelName, id]
    );

    res.json({ message: 'Email label updated', label: newLabelName });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark with label', details: getErrorMessage(err) });
  }
});

// Health check
app.get('/api/counts', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const email = req.user!.email;
    const userId = req.user!.id;
    const result = await pool.query(
      `SELECT
        COUNT(DISTINCT e.id) FILTER (WHERE e.recipient=$1 AND e.is_deleted=false AND e.is_archived=false AND e.is_spam=false AND e.is_snoozed=false AND e.is_scheduled=false AND e.is_draft=false) AS inbox_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.recipient=$1 AND e.is_deleted=false AND e.is_archived=false AND e.is_spam=false AND e.is_snoozed=false AND e.is_scheduled=false AND e.is_draft=false AND e.is_read=false) AS inbox_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE e.sender=$1 AND e.is_deleted=false AND e.is_archived=false AND e.is_spam=false AND e.is_snoozed=false AND e.is_scheduled=false AND e.is_draft=false) AS sent_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_starred=true AND (e.recipient=$1 OR e.sender=$1) AND e.is_deleted=false) AS starred_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_starred=true AND e.recipient=$1 AND e.is_deleted=false AND e.is_scheduled=false AND e.is_draft=false AND e.is_read=false) AS starred_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_snoozed=true AND (e.recipient=$1 OR e.sender=$1) AND e.is_deleted=false) AS snoozed_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_snoozed=true AND e.recipient=$1 AND e.is_deleted=false AND e.is_scheduled=false AND e.is_draft=false AND e.is_read=false) AS snoozed_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_draft=true AND e.user_id=$2 AND e.is_deleted=false) AS drafts_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_archived=true AND (e.recipient=$1 OR e.sender=$1) AND e.is_deleted=false AND e.is_scheduled=false) AS archived_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_archived=true AND e.recipient=$1 AND e.is_deleted=false AND e.is_scheduled=false AND e.is_read=false) AS archived_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE e.scheduled_for IS NOT NULL AND (e.recipient=$1 OR e.sender=$1) AND e.is_deleted=false) AS scheduled_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_spam=true AND e.recipient=$1 AND e.is_deleted=false AND e.is_scheduled=false) AS spam_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_spam=true AND e.recipient=$1 AND e.is_deleted=false AND e.is_scheduled=false AND e.is_read=false) AS spam_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_deleted=true AND (e.recipient=$1 OR e.sender=$1)) AS delete_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_deleted=true AND e.recipient=$1 AND e.is_read=false AND e.is_draft=false AND e.is_scheduled=false) AS delete_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE e.recipient=$1 OR e.sender=$1) AS all_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.recipient=$1 AND e.is_deleted=false AND e.is_read=false AND e.is_draft=false AND e.is_scheduled=false) AS all_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_subscription=true AND (e.recipient=$1 OR e.sender=$1) AND e.is_deleted=false AND e.is_scheduled=false) AS subscriptions_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_subscription=true AND e.recipient=$1 AND e.is_deleted=false AND e.is_scheduled=false AND e.is_read=false) AS subscriptions_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_report=true AND (e.recipient=$1 OR e.sender=$1) AND e.is_deleted=false) AS reports_total,
        COUNT(DISTINCT e.id) FILTER (WHERE e.is_report=true AND e.recipient=$1 AND e.is_deleted=false AND e.is_read=false) AS reports_unread,
        COUNT(DISTINCT e.id) FILTER (WHERE (e.recipient=$1 OR e.sender=$1) AND e.is_deleted=false AND (EXISTS (SELECT 1 FROM email_groups eg JOIN groups g ON eg.group_id = g.id WHERE eg.email_id = e.id AND g.user_id = $2) OR EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.email = e.sender AND g.user_id = $2))) AS groups_total,
        COUNT(DISTINCT e.id) FILTER (WHERE (e.recipient=$1 OR e.sender=$1) AND e.is_deleted=false AND e.is_read=false AND e.recipient=$1 AND (EXISTS (SELECT 1 FROM email_groups eg JOIN groups g ON eg.group_id = g.id WHERE eg.email_id = e.id AND g.user_id = $2) OR EXISTS (SELECT 1 FROM group_members gm JOIN groups g ON gm.group_id = g.id WHERE gm.email = e.sender AND g.user_id = $2))) AS groups_unread
       FROM emails e`,
      [email, userId]
    );
    const r = result.rows[0];
    const p = (v: string) => parseInt(v) || 0;
    res.json({
      inbox:         { total: p(r.inbox_total),         unread: p(r.inbox_unread) },
      sent:          { total: p(r.sent_total),           unread: 0 },
      starred:       { total: p(r.starred_total),        unread: p(r.starred_unread) },
      snoozed:       { total: p(r.snoozed_total),        unread: p(r.snoozed_unread) },
      drafts:        { total: p(r.drafts_total),         unread: 0 },
      archived:      { total: p(r.archived_total),       unread: p(r.archived_unread) },
      scheduled:     { total: p(r.scheduled_total),      unread: 0 },
      spam:          { total: p(r.spam_total),           unread: p(r.spam_unread) },
      delete:        { total: p(r.delete_total),         unread: p(r.delete_unread) },
      all:           { total: p(r.all_total),            unread: p(r.all_unread) },
      subscriptions: { total: p(r.subscriptions_total),  unread: p(r.subscriptions_unread) },
      reports:       { total: p(r.reports_total),        unread: p(r.reports_unread) },
      groups:        { total: p(r.groups_total),         unread: p(r.groups_unread) },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch counts', details: getErrorMessage(err) });
  }
});

// Client Error Logging Endpoint
app.post('/api/log-error', async (req: Request, res: Response) => {
  const { error, stack, userAgent, url, timestamp, screenshot } = req.body;

  const logEntry = `\n========== CLIENT ERROR REPORT ==========
Time: ${timestamp}
URL: ${url}
User Agent: ${userAgent}
Error: ${error}
Stack: \n${stack}
=========================================\n`;

  console.error(logEntry);

  // Append to daily rotating text log file
  try {
    const errorsDir = path.join(process.cwd(), 'logs', 'errors');
    if (!fs.existsSync(errorsDir)) fs.mkdirSync(errorsDir, { recursive: true });

    const dateStr = new Date().toISOString().slice(0, 10);
    const logFilePath = path.join(errorsDir, `crash-${dateStr}.log`);
    fs.appendFileSync(logFilePath, logEntry);
  } catch (err) {
    console.error('Failed to write to error log file:', err);
  }

  let screenshotPath: string | null = null;
  if (screenshot) {
    try {
      const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const logsDir = path.join(process.cwd(), 'logs', 'screenshots');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      const filename = `crash-${Date.now()}.png`;
      screenshotPath = path.join(logsDir, filename);
      fs.writeFileSync(screenshotPath, buffer);
      console.error(`Screenshot saved to: ${screenshotPath}`);
    } catch (err) {
      console.error('Failed to save error screenshot:', err);
    }
  }

  try {
    await pool.query(
      `INSERT INTO error_reports (error_message, stack_trace, user_agent, url, screenshot_path, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [error, stack, userAgent, url, screenshotPath, timestamp || new Date().toISOString()]
    );
  } catch (err) {
    console.error('Failed to store error in DB:', err);
  }

  res.status(200).json({ success: true, message: 'Error logged successfully' });
});

// Admin middleware — only the configured ADMIN_EMAIL can access these routes
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ypaself@gmail.com';
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.email !== ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// Submit user feedback (any authenticated user)
app.post('/api/feedback', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const { category, subject, message } = req.body;
  if (!message?.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO feedback (user_id, user_email, category, subject, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user!.id, req.user!.email, category || 'general', subject || '', message.trim()]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Admin: get all error reports
app.get('/api/admin/errors', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const where = status && status !== 'all' ? `WHERE status = $1` : '';
    const params = status && status !== 'all' ? [status] : [];
    const result = await pool.query(
      `SELECT id, error_message, stack_trace, user_agent, url, screenshot_path, status, notes, created_at
       FROM error_reports ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch error reports' });
  }
});

// Admin: update error report status/notes
app.patch('/api/admin/errors/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, notes } = req.body;
  try {
    await pool.query(
      `UPDATE error_reports SET status = COALESCE($1, status), notes = COALESCE($2, notes) WHERE id = $3`,
      [status, notes, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update error report' });
  }
});

// Admin: delete error report
app.delete('/api/admin/errors/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM error_reports WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete error report' });
  }
});

// Admin: get all feedback
app.get('/api/admin/feedback', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const where = status && status !== 'all' ? `WHERE status = $1` : '';
    const params = status && status !== 'all' ? [status] : [];
    const result = await pool.query(
      `SELECT id, user_email, category, subject, message, status, created_at
       FROM feedback ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Admin: update feedback status
app.patch('/api/admin/feedback/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query('UPDATE feedback SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// Admin: delete feedback
app.delete('/api/admin/feedback/:id', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM feedback WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Admin: serve screenshot image
app.get('/api/admin/screenshot', authenticateToken, requireAdmin, (req: Request, res: Response): void => {
  const filePath = req.query.path as string;
  if (!filePath || !filePath.startsWith(path.join(process.cwd(), 'logs', 'screenshots'))) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Screenshot not found' });
    return;
  }
  res.sendFile(filePath);
});

// Admin: overview stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [errStats, fbStats] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM error_reports GROUP BY status`),
      pool.query(`SELECT status, COUNT(*) as count FROM feedback GROUP BY status`)
    ]);
    const errMap: Record<string, number> = {};
    for (const r of errStats.rows) errMap[r.status] = parseInt(r.count);
    const fbMap: Record<string, number> = {};
    for (const r of fbStats.rows) fbMap[r.status] = parseInt(r.count);
    res.json({
      errors: {
        total: Object.values(errMap).reduce((a, b) => a + b, 0),
        new: errMap['new'] || 0,
        in_progress: errMap['in_progress'] || 0,
        solved: errMap['solved'] || 0
      },
      feedback: {
        total: Object.values(fbMap).reduce((a, b) => a + b, 0),
        new: fbMap['new'] || 0,
        in_progress: fbMap['in_progress'] || 0,
        resolved: fbMap['resolved'] || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/', (req: Request, res: Response): void => {
  res.send('Mail App Backend Running');
});

// Background job: process due scheduled emails every 30 seconds
const processScheduledEmails = async () => {
  try {
    const result = await pool.query(
      `UPDATE emails SET is_scheduled = false, sent_at = COALESCE(scheduled_for, NOW())
       WHERE is_scheduled = true AND scheduled_for <= NOW() AND is_deleted = false
       RETURNING id`
    );
    if (result.rows.length > 0) {
      console.log(`[Scheduler] Sent ${result.rows.length} scheduled email(s)`);
    }
  } catch (err) {
    console.error('[Scheduler] Error processing scheduled emails:', err);
  }
};
setInterval(processScheduledEmails, 30000);
processScheduledEmails();

// Background job: cleanup old screenshots and text logs (older than 30 days)
const cleanupOldScreenshots = () => {
  const dirsToClean = [
    path.join(process.cwd(), 'logs', 'screenshots'),
    path.join(process.cwd(), 'logs', 'errors')
  ];
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const dir of dirsToClean) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > THIRTY_DAYS_MS) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    } catch (err) {
      console.error(`[Cleanup] Error cleaning up ${dir}:`, err);
    }
  }
  
  if (deletedCount > 0) console.log(`[Cleanup] Deleted ${deletedCount} old error log/screenshot(s)`);
};
cleanupOldScreenshots();
setInterval(cleanupOldScreenshots, 24 * 60 * 60 * 1000);

// Start server
const PORT = process.env.PORT ?? 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
