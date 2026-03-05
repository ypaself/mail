-- This SQL script populates test emails for ypa727@outlook.com
-- Run this after you've created an account with that email or run the migration

-- First, create the test user if it doesn't exist
-- Note: You'll need to create the account through the app first, or modify the password hash below

-- Get the user ID for ypa727@outlook.com
-- UPDATE users SET password_hash = '$2b$10$...' WHERE email = 'ypa727@outlook.com';

-- Insert Welcome Email
INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at)
SELECT id, 'noreply@mailapp.com', 'ypa727@outlook.com',
'Welcome to Mail App!',
'Welcome to Mail App!

Thank you for creating an account with us. We''re excited to have you on board.

Here''s what you can do with Mail App:
- Send and receive emails seamlessly
- Organize your emails with folders and labels
- Use our Office Suite for notes, documents, spreadsheets, and PDFs
- Start video conferences with colleagues
- Connect with friends through chat

If you have any questions or need help getting started, please don''t hesitate to reach out to our support team.

Best regards,
Mail App Team',
NOW() - INTERVAL '6 days'
FROM users WHERE email = 'ypa727@outlook.com';

-- Insert Notification Email
INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at)
SELECT id, 'notifications@mailapp.com', 'ypa727@outlook.com',
'New Message Notification',
'You have a new message!

You received a new email from a colleague. Log in to your Mail App account to read the full message.

Message Preview: "Hi, I wanted to check in on the project status..."

Click here to view your inbox: https://mailapp.com/inbox

If you no longer want to receive notifications, you can disable them in your settings.

Best regards,
Mail App Notifications',
NOW() - INTERVAL '5 days'
FROM users WHERE email = 'ypa727@outlook.com';

-- Insert Confirmation Email
INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at)
SELECT id, 'verify@mailapp.com', 'ypa727@outlook.com',
'Email Confirmation Required',
'Please Confirm Your Email Address

Thank you for signing up! To complete your registration, please confirm your email address by clicking the button below.

Confirmation Code: MAIL-2024-12345

This link will expire in 24 hours.

If you did not create this account, you can safely ignore this email.

Best regards,
Mail App Team',
NOW() - INTERVAL '4 days'
FROM users WHERE email = 'ypa727@outlook.com';

-- Insert Meeting Email
INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at)
SELECT id, 'meetings@mailapp.com', 'ypa727@outlook.com',
'Team Meeting Scheduled',
'Team Meeting Scheduled

Dear Team,

I''m writing to confirm our meeting for tomorrow:

📅 Date: Tomorrow
⏰ Time: 2:00 PM - 3:00 PM
📍 Location: Conference Room / Video Call Link

Topics to Discuss:
- Project Update
- Q1 Planning
- Team Goals

Please come prepared with any updates or feedback you''d like to share.

Looking forward to seeing you all there!

Best regards,
Your Manager',
NOW() - INTERVAL '3 days'
FROM users WHERE email = 'ypa727@outlook.com';

-- Insert Promotion Email
INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at)
SELECT id, 'offers@mailapp.com', 'ypa727@outlook.com',
'Special Offer - 50% Off!',
'🎉 Exclusive Offer Just For You!

Get 50% off your next purchase with Mail App Premium!

This offer is valid for:
✅ Mail App Pro - $4.99/month (was $9.99)
✅ Office Suite - $2.99/month (was $5.99)
✅ Conference Plus - $3.99/month (was $7.99)

Use code: SAVE50 at checkout

Limited time offer - Valid until end of month!

Don''t miss out on this amazing deal. Upgrade now!

Best regards,
Mail App Team',
NOW() - INTERVAL '2 days'
FROM users WHERE email = 'ypa727@outlook.com';

-- Insert Report Email
INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at)
SELECT id, 'reports@mailapp.com', 'ypa727@outlook.com',
'Monthly Report - January 2024',
'Monthly Report - January 2024

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
Mail App Analytics Team',
NOW() - INTERVAL '1 day'
FROM users WHERE email = 'ypa727@outlook.com';

-- Verify insertion
SELECT COUNT(*) as total_emails, COUNT(DISTINCT sender) as from_different_senders
FROM emails WHERE recipient = 'ypa727@outlook.com';
