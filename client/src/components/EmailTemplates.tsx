import React from 'react'

export const emailTemplates = {
  welcome: {
    subject: 'Welcome to Mail App!',
    from: 'noreply@mailapp.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
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
    template: 'welcome',
  },

  notification: {
    subject: 'New Message Notification',
    from: 'notifications@mailapp.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
    body: `You have a new message!

You received a new email from a colleague. Log in to your Mail App account to read the full message.

Message Preview: "Hi, I wanted to check in on the project status..."

Click here to view your inbox: https://mailapp.com/inbox

If you no longer want to receive notifications, you can disable them in your settings.

Best regards,
Mail App Notifications`,
    template: 'notification',
  },

  confirmation: {
    subject: 'Email Confirmation Required',
    from: 'verify@mailapp.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
    body: `Please Confirm Your Email Address

Thank you for signing up! To complete your registration, please confirm your email address by clicking the button below.

Confirmation Code: MAIL-2024-12345

This link will expire in 24 hours.

If you did not create this account, you can safely ignore this email.

Best regards,
Mail App Team`,
    template: 'confirmation',
  },

  meeting: {
    subject: 'Team Meeting Scheduled',
    from: 'meetings@mailapp.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
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
    template: 'meeting',
  },

  promotion: {
    subject: 'Special Offer - 50% Off!',
    from: 'offers@mailapp.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
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
    template: 'promotion',
  },

  report: {
    subject: 'Monthly Report - January 2024',
    from: 'reports@mailapp.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
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
    template: 'report',
  },

  collaboration: {
    subject: 'You have been invited to a project workspace',
    from: 'team@company.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
    body: `Hello,

You have been invited to join the "Q1 Product Launch" project workspace on Mail App!

Project Details:
📋 Project Name: Q1 Product Launch
👥 Team Lead: Sarah Johnson
🎯 Objective: Launch new features and improvements

What you can do:
- Collaborate with team members in real-time
- Share documents and files
- Schedule video conferences
- Track project milestones and deadlines

Click here to accept the invitation: https://mailapp.com/projects/q1-launch

This invitation expires in 7 days.

Best regards,
Mail App Team`,
    template: 'collaboration',
  },

  deadline: {
    subject: 'Reminder: Project Deadline - 2 Days Left',
    from: 'reminders@mailapp.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
    body: `Project Deadline Reminder

This is a friendly reminder that your project deadline is approaching!

⏰ Project: Website Redesign
📅 Deadline: March 6, 2024 at 5:00 PM
⏳ Time remaining: 2 days, 3 hours

Current Status:
✅ Design Phase: Complete
🔄 Development Phase: 75% Complete
⏳ Testing Phase: Not Started
⏳ Deployment: Not Started

Next Steps:
1. Complete development phase
2. Begin testing phase
3. Prepare deployment plan

If you need any assistance or have concerns about meeting the deadline, please reach out to your project manager immediately.

Best regards,
Mail App Project Manager`,
    template: 'deadline',
  },

  performance: {
    subject: 'Your Q4 Performance Review is Ready',
    from: 'hr@company.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
    body: `Q4 Performance Review - Action Required

Dear Employee,

Your Q4 2024 performance review has been completed and is ready for your review.

Review Details:
📊 Review Period: October - December 2024
⭐ Overall Rating: Excellent
💼 Reviewed By: Manager Name

Key Achievements:
✨ Exceeded quarterly targets by 15%
✨ Led successful implementation of new system
✨ Improved team efficiency by 20%
✨ Received positive feedback from clients

Areas for Development:
• Time management in complex projects
• Cross-team collaboration skills

Next Steps:
1. Review your performance summary
2. Schedule a meeting with your manager
3. Discuss goals for Q1 2025

Click here to view your full review: https://mailapp.com/hr/reviews/q4-2024

Please complete your review by March 10, 2024.

Best regards,
Human Resources Department`,
    template: 'performance',
  },

  newsletter: {
    subject: 'Weekly Newsletter - March 2024, Week 1',
    from: 'newsletter@mailapp.com',
    to: 'user@example.com',
    date: new Date().toISOString(),
    body: `📰 Weekly Newsletter - March 2024, Week 1

Hi there!

Here's what you need to know this week:

🔝 TOP STORIES

1. New Features Released
   - Improved email filtering
   - Enhanced search functionality
   - Dark mode now available

2. Security Updates
   - Two-factor authentication now mandatory
   - End-to-end encryption available

3. Team Achievements
   - 100,000+ users reached!
   - 99.9% uptime maintained

📚 FEATURED ARTICLES

• How to Maximize Your Productivity with Mail App
• Best Practices for Email Organization
• Video Conferencing Tips & Tricks

🎓 UPCOMING EVENTS

- Webinar: Advanced Email Management
  📅 Date: March 8, 2024 at 2:00 PM UTC

- Training Session: New Features Overview
  📅 Date: March 10, 2024 at 10:00 AM UTC

💡 TIP OF THE WEEK

Did you know? You can use keyboard shortcuts to navigate Mail App faster. Press '?' to view all available shortcuts!

Thanks for being part of our community!

Best regards,
Mail App Editorial Team`,
    template: 'newsletter',
  },
}

interface EmailTemplateProps {
  template: keyof typeof emailTemplates
}

export const EmailTemplate: React.FC<EmailTemplateProps> = ({ template }) => {
  const email = emailTemplates[template]

  return (
    <div className="email-template">
      <div className="email-template-header">
        <h2 className="template-subject">{email.subject}</h2>
        <div className="template-metadata">
          <div className="metadata-item">
            <span className="label">From:</span>
            <span className="value">{email.from}</span>
          </div>
          <div className="metadata-item">
            <span className="label">To:</span>
            <span className="value">{email.to}</span>
          </div>
          <div className="metadata-item">
            <span className="label">Date:</span>
            <span className="value">{new Date(email.date).toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="email-template-body">
        {email.body.split('\n').map((line, idx) => (
          <p key={idx}>{line || '\u00A0'}</p>
        ))}
      </div>
    </div>
  )
}

export default EmailTemplate
