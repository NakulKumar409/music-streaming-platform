require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function seedAdmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const adminEmail = 'admin@test.com';
    const adminPassword = 'admin123';

    // Check if admin already exists
    const existingAdmin = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [adminEmail]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('Admin already exists:', existingAdmin.rows[0]);
      console.log('Skipping admin creation');
      await client.end();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Insert admin user
    const result = await client.query(
      `INSERT INTO users (email, password, role, name, is_verified, verified, status, artist_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, role`,
      [adminEmail, hashedPassword, 'ADMIN', 'Admin User', true, true, 'ACTIVE', 'APPROVED']
    );

    console.log('Admin created successfully:');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('User ID:', result.rows[0].id);
    console.log('Role:', result.rows[0].role);

  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

seedAdmin();
