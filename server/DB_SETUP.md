# How to create tables in PostgreSQL for Mail App

1. Open your terminal and connect to PostgreSQL:
   psql -U your_username -d maildb

2. Run the following command to execute the schema.sql file:
   \i /Users/ypa/Desktop/Main\ Projects/Mail/server/schema.sql

3. Verify the tables:
   \dt

You should see 'users' and 'emails' tables listed.

If you have any issues, make sure your .env file in server/ has the correct database credentials.
