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
  private isConnected: boolean = false;

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
        tlsOptions: {
          rejectUnauthorized: false, // Required for Gmail IMAP TLS
        },
      });

      // Add error listener
      this.imap.on('error', (err: any) => {
        console.error('IMAP error event:', {
          message: err.message,
          code: err.code,
          errno: err.errno,
          full: err.toString()
        });
      });

      // Add close listener
      this.imap.on('close', () => {
        console.log('IMAP connection closed');
        this.isConnected = false;
      });

      // Add ready listener
      this.imap.on('ready', () => {
        console.log('IMAP connection ready');
        this.isConnected = true;
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
          console.log(`Mailbox ${boxName} opened successfully`);
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

      console.log('Starting email fetch...');

      this.imap.search(['ALL'], (err: any, results: any) => {
        if (err) {
          console.error('Search error:', err.message);
          reject(err);
          return;
        }

        if (results.length === 0) {
          console.log('No emails found in INBOX');
          resolve();
          return;
        }

        console.log(`Found ${results.length} emails, fetching last ${limit}`);

        // Get the last 'limit' emails
        const uids = results.slice(-limit);
        const f = this.imap!.fetch(uids, { bodies: '' });

        let emailCount = 0;

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

                emailCount++;
                console.log(`[${emailCount}/${limit}] Stored email: "${subject}" from ${from}`);
              } catch (storeErr) {
                console.error('Error storing email:', storeErr);
              }
            });
          });
        });

        f.on('error', (err: any) => {
          console.error('Fetch error:', err.message);
          reject(err);
        });

        f.on('end', () => {
          console.log(`Email fetch complete. Processed ${emailCount} emails.`);
          resolve();
        });
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

      // If already connected, return immediately
      if (this.isConnected) {
        console.log('Already connected to IMAP');
        resolve(true);
        return;
      }

      let resolved = false;

      // Set a timeout for connection
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error('IMAP connection timeout');
          resolve(false);
        }
      }, 10000); // 10 second timeout

      // Wait for ready event, then open mailbox
      const readyListener = () => {
        if (!resolved) {
          this.imap!.removeListener('error', errorListener);
          console.log('IMAP connection ready, opening INBOX...');

          // Open INBOX after connection is ready
          this.imap!.openBox('INBOX', false, (err: any) => {
            if (err) {
              resolved = true;
              clearTimeout(timeout);
              console.error('Failed to open INBOX:', err.message);
              resolve(false);
            } else {
              resolved = true;
              clearTimeout(timeout);
              console.log('Successfully connected and opened INBOX');
              resolve(true);
            }
          });
        }
      };

      const errorListener = (err: any) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.imap!.removeListener('ready', readyListener);
          console.error('Failed to connect to IMAP - Error:', err.message || err);
          resolve(false);
        }
      };

      this.imap.on('ready', readyListener);
      this.imap.on('error', errorListener);

      // Trigger connection
      console.log('Attempting to connect to IMAP server at', process.env.IMAP_HOST);
      try {
        this.imap.connect();
      } catch (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          console.error('IMAP connect() threw error:', err);
          resolve(false);
        }
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.imap) {
      this.imap.end();
    }
  }
}

export default IMAPService;
