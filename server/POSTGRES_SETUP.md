# PostgreSQL setup for Mail App

1. Make sure PostgreSQL is installed and running on your system.
2. Create a database named `maildb`:
   
   psql -U postgres -c "CREATE DATABASE maildb;"

3. Update the `.env` file in the server directory with your PostgreSQL username and password:
   
   DATABASE_URL=postgresql://your_username:your_password@localhost:5432/maildb

4. Start the backend server:
   
   cd server
   node index.js

You should see "Connected to PostgreSQL" if the connection is successful.
