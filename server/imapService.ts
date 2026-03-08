// @ts-ignore
import { simpleParser } from 'mailparser';
import Imap from 'imap';
import { Pool } from 'pg';

interface FetchedEmail {
  id: number;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string | null;
  date: Date;
}

class IMAPService {
  private imap: Imap | null = null;
  private pool: Pool;
  private userId: number;

  constructor(pool: Pool, userId: number) {
    this.pool = pool;
    this.userId = userId;
    this.initializeIMAP();
  }

  private initializeIMAP(): void {
    const imapHost = process.env.IMAP_HOST;
    const imapPort = parseInt(process.env.IMAP_PORT || '993', 10);
    const imapTls = process.env.IMAP_TLS === 'true';
    const imapUser = process.env.IMAP_USER;
    const imapPass = process.env.IMAP_PASS;

    if (!imapHost || !imapUser || !imapPass) {
      console.warn(
        'IMAP configuration incomplete. Email fetching will not work. Please set IMAP_HOST, IMAP_USER, and IMAP_PASS in .env'
      );
      return;
    }

    try {
      this.imap = new Imap({
        user: imapUser,
        password: imapPass,
        host: imapHost,
        port: imapPort,
        tls: imapTls,
      });
    } catch (err) {
      console.error('Failed to initialize IMAP connection:', err);
    }
  }

  async openBox(boxName: string = 'INBOX'): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.imap) {
        resolve(false);
        return;
      }

      this.imap.openBox(boxName, false, (err: any) => {
        if (err) {
          console.error(`Failed to open mailbox ${boxName}:`, err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async fetchEmails(limit: number = 10): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not initialized'));
        return;
      }

      this.imap.search(['ALL'], (err: any, results: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (results.length === 0) {
          resolve();
          return;
        }

        // Get the last 'limit' emails
        const uids = results.slice(-limit);
        const f = this.imap!.fetch(uids, { bodies: '' });

        f.on('message', (msg: any) => {
          msg.on('body', (stream: any) => {
            simpleParser(stream, async (err: any, parsed: any) => {
              if (err) {
                console.error('Error parsing email:', err);
                return;
              }

              try {
                const from = parsed.from?.text || 'Unknown';
                const to = parsed.to?.text || '';
                const subject = parsed.subject || '(No Subject)';
                const date = parsed.date || new Date();

                const text = parsed.text || '';

                // Store email in database
                await this.pool.query(
                  `INSERT INTO emails (user_id, sender, recipient, subject, body, sent_at, is_read)
                   VALUES ($1, $2, $3, $4, $5, $6, false)
                   ON CONFLICT DO NOTHING`,
                  [this.userId, from, to, subject, text, date]
                );

                console.log(`Stored email: ${subject} from ${from}`);
              } catch (storeErr) {
                console.error('Error storing email:', storeErr);
              }
            });
          });
        });

        f.on('error', reject);
        f.on('end', resolve);
      });
    });
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.imap) {
        console.error('IMAP not initialized');
        resolve(false);
        return;
      }

      this.imap.openBox('INBOX', false, (err: any) => {
        if (err) {
          console.error('Failed to connect to IMAP:', err);
          resolve(false);
          return;
        }

        console.log('Connected to IMAP server');
        resolve(true);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.imap) {
      this.imap.end();
    }
  }
}

export default IMAPService;
