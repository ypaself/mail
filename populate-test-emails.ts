import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mail_app',
});

async function populateTestEmails() {
  try {
    // First, find or create a test user
    const userEmail = 'test@example.com';
    const userPassword = 'TestPassword123!';

    let userId: number;

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      // Create user (for demo purposes, using a hash)
      const hashPassword = require('bcrypt').hashSync(userPassword, 10);
      const createUserResult = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [userEmail, hashPassword]
      );
      userId = createUserResult.rows[0].id;
      console.log(`Created test user: ${userEmail}`);
    } else {
      userId = userResult.rows[0].id;
      console.log(`Found existing test user: ${userEmail}`);
    }

    // Sample emails to insert
    const emails = [
      {
        sender: 'john@example.com',
        recipient: userEmail,
        subject: 'Project Update - Q1 2026',
        body: 'Hi, here\'s the update on the Q1 2026 project. We\'ve made good progress on the frontend components...',
      },
      {
        sender: 'sarah@example.com',
        recipient: userEmail,
        subject: 'Meeting Tomorrow at 10 AM',
        body: 'Don\'t forget we have a team meeting tomorrow at 10 AM. Please prepare your progress report.',
      },
      {
        sender: 'info@newsletter.com',
        recipient: userEmail,
        subject: 'Weekly Tech Newsletter #47',
        body: 'This week\'s top stories:\n1. New React 19 Features\n2. TypeScript 5.4 Released\n3. Next.js Performance Tips',
      },
      {
        sender: userEmail,
        recipient: 'client@company.com',
        subject: 'Proposal - Website Redesign',
        body: 'Hi, I\'ve attached the proposal for your website redesign project. Please review and let me know your thoughts.',
      },
      {
        sender: 'admin@company.com',
        recipient: userEmail,
        subject: 'System Maintenance Scheduled',
        body: 'Our servers will undergo maintenance on Saturday from 2 AM to 6 AM. Please plan accordingly.',
      },
      {
        sender: 'support@service.com',
        recipient: userEmail,
        subject: 'Your Support Ticket #12345 - Resolved',
        body: 'Your support ticket has been resolved. If you have any further questions, feel free to contact us.',
      },
      {
        sender: 'jane@example.com',
        recipient: userEmail,
        subject: 'Coffee this week?',
        body: 'Hey! Long time no talk. Are you free for coffee this week? Let me know your availability.',
      },
      {
        sender: 'notifications@app.com',
        recipient: userEmail,
        subject: 'New Comment on Your Post',
        body: 'Someone commented on your post: "Great insights! Really helpful perspective on this topic."',
      },
    ];

    // Insert emails
    for (const email of emails) {
      await pool.query(
        `INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, email.sender, email.recipient, email.subject, email.body]
      );
    }

    console.log(`✓ Added ${emails.length} test emails`);
    console.log('\nTest account:');
    console.log(`Email: ${userEmail}`);
    console.log(`Password: ${userPassword}`);

  } catch (err) {
    console.error('Error populating test emails:', err);
  } finally {
    await pool.end();
  }
}

populateTestEmails();
