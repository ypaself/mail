import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
});

const TEST_EMAIL = 'ypa727@outlook.com';
const TEST_PASSWORD = 'TestPassword123!';

interface EmailTemplate {
  subject: string;
  from: string;
  body: string;
}

const emailTemplates: Record<string, EmailTemplate> = {
  welcome: {
    subject: 'Welcome to Mail App!',
    from: 'noreply@mailapp.com',
    body: `Welcome to Mail App!

Thank you for creating an account with us. We're excited to have you on board.

Here's what you can do with Mail App:
- Send and receive emails seamlessly
- Organize your emails with folders and labels
- Use our Office Suite for notes, documents, spreadsheets, and PDFs
- Start video conferences with colleagues
- Connect with friends through chat

If you have any questions or need help getting started, please don't hesitate to reach out to our support team.

Best regards,
Mail App Team`,
  },
  notification: {
    subject: 'New Message Notification',
    from: 'notifications@mailapp.com',
    body: `You have a new message!

You received a new email from a colleague. Log in to your Mail App account to read the full message.

Message Preview: "Hi, I wanted to check in on the project status..."

Click here to view your inbox: https://mailapp.com/inbox

If you no longer want to receive notifications, you can disable them in your settings.

Best regards,
Mail App Notifications`,
  },
  confirmation: {
    subject: 'Email Confirmation Required',
    from: 'verify@mailapp.com',
    body: `Please Confirm Your Email Address

Thank you for signing up! To complete your registration, please confirm your email address by clicking the button below.

Confirmation Code: MAIL-2024-12345

This link will expire in 24 hours.

If you did not create this account, you can safely ignore this email.

Best regards,
Mail App Team`,
  },
  meeting: {
    subject: 'Team Meeting Scheduled',
    from: 'meetings@mailapp.com',
    body: `Team Meeting Scheduled

Dear Team,

I'm writing to confirm our meeting for tomorrow:

📅 Date: Tomorrow
⏰ Time: 2:00 PM - 3:00 PM
📍 Location: Conference Room / Video Call Link

Topics to Discuss:
- Project Update
- Q1 Planning
- Team Goals

Please come prepared with any updates or feedback you'd like to share.

Looking forward to seeing you all there!

Best regards,
Your Manager`,
  },
  promotion: {
    subject: 'Special Offer - 50% Off!',
    from: 'offers@mailapp.com',
    body: `🎉 Exclusive Offer Just For You!

Get 50% off your next purchase with Mail App Premium!

This offer is valid for:
✅ Mail App Pro - $4.99/month (was $9.99)
✅ Office Suite - $2.99/month (was $5.99)
✅ Conference Plus - $3.99/month (was $7.99)

Use code: SAVE50 at checkout

Limited time offer - Valid until end of month!

Don't miss out on this amazing deal. Upgrade now!

Best regards,
Mail App Team`,
  },
  report: {
    subject: 'Monthly Report - January 2024',
    from: 'reports@mailapp.com',
    body: `Monthly Report - January 2024

Dear User,

Please find below the summary of your Mail App activity for January 2024:

📊 Statistics:
- Total Emails Sent: 45
- Total Emails Received: 127
- Storage Used: 2.3 GB / 15 GB
- Active Conversations: 12
- Documents Created: 8

📈 Top Activities:
1. Email communication
2. Document creation
3. Conference calls
4. Note-taking

✨ Highlights:
- Used Office Suite features 42 times
- Attended 5 video conferences
- Created 3 collaborative documents

If you have any questions about this report, please contact us.

Best regards,
Mail App Analytics Team`,
  },
};

async function populateTestEmails() {
  try {
    console.log('🚀 Starting test email population...');
    console.log(`📧 Target account: ${TEST_EMAIL}`);

    // Check if user exists
    let userId: number;
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [TEST_EMAIL]);

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
      console.log(`✅ Test user found (ID: ${userId})`);
    } else {
      // Create test user if it doesn't exist
      console.log(`📝 Creating test user...`);
      const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
      const createUserResult = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [TEST_EMAIL, hashedPassword],
      );
      userId = createUserResult.rows[0].id;
      console.log(`✅ Test user created (ID: ${userId})`);
      console.log(`   Email: ${TEST_EMAIL}`);
      console.log(`   Password: ${TEST_PASSWORD}`);
    }

    // Insert received emails (inbox)
    console.log(`\n📬 Inserting ${Object.keys(emailTemplates).length} received emails (Inbox)...`);
    let inboxCount = 0;

    for (const [templateName, template] of Object.entries(emailTemplates)) {
      const now = new Date();
      // Stagger the dates so they appear in different times
      const sentDate = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, template.from, TEST_EMAIL, template.subject, template.body, sentDate],
      );
      console.log(`   ✓ ${templateName}: "${template.subject}"`);
      inboxCount++;
    }

    // Insert sent emails (sent folder)
    console.log(`\n📤 Inserting ${Object.keys(emailTemplates).length} sent emails (Sent)...`);
    let sentCount = 0;
    const recipients = ['client@example.com', 'colleague@example.com', 'manager@example.com', 'friend@example.com', 'support@example.com', 'team@example.com'];

    for (const [templateName, template] of Object.entries(emailTemplates)) {
      const now = new Date();
      // Stagger the dates so they appear in different times
      const sentDate = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const recipient = recipients[sentCount % recipients.length];

      await pool.query(
        'INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, TEST_EMAIL, recipient, `RE: ${template.subject}`, `Response to: ${template.body.substring(0, 50)}...`, sentDate],
      );
      console.log(`   ✓ ${templateName}: "RE: ${template.subject}" → ${recipient}`);
      sentCount++;
    }

    console.log(`\n✅ Successfully inserted ${inboxCount} inbox + ${sentCount} sent emails!`);
    console.log(`\n📱 You can now test the app with:`);
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Password: ${TEST_PASSWORD}`);
    console.log(`\n💡 These emails will appear in your inbox when you log in!`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error populating test emails:', error);
    await pool.end();
    process.exit(1);
  }
}

populateTestEmails();
