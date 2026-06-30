# Mail App 

A modern web-based mail app inspired by Gmail. Built with React (frontend) and Node.js/Express (backend), supporting IMAP/SMTP integration.

## Features
- User authentication
- Inbox, Sent, Compose, and Email viewing
- Responsive, clean UI
- IMAP for reading emails
- SMTP for sending emails

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Setup

1. Install dependencies for both client and server:
   ```sh
   cd client && npm install
   cd ../server && npm install
   ```
2. Configure environment variables for IMAP/SMTP and authentication in `server/.env`.
3. Start the backend:
   ```sh
   cd server && npm run dev
   ```
4. Start the frontend:
   ```sh
   cd client && npm start
   ```

## Folder Structure
- `client/` – React frontend
- `server/` – Node.js/Express backend

---

Replace placeholder configs and secrets before deploying.
