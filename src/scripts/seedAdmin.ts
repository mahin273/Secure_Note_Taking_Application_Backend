import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/user.model';

const BCRYPT_SALT_ROUNDS = 12;

export async function seedAdmin(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB for admin seeding.');

    const adminEmail = env.ADMIN_EMAIL.toLowerCase().trim();
    // Uses Index #1: { email: 1 }
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`Admin user with email ${adminEmail} already exists. Skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);

    await User.create({
      name: 'System Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      interests: ['system', 'administration'],
    });

    console.log(`Admin user (${adminEmail}) created successfully.`);
  } catch (error) {
    console.error('Failed to seed admin user:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

if (require.main === module) {
  seedAdmin().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
