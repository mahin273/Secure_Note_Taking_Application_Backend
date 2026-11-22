import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { Note } from '../models/note.model';
import { Post } from '../models/post.model';

const BCRYPT_SALT_ROUNDS = 10;

export async function seedDemoUsers(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB for demo user seeding.');

    // 1. Ensure Admin exists
    const adminEmail = env.ADMIN_EMAIL.toLowerCase().trim();
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const adminHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
      admin = await User.create({
        name: 'System Admin',
        email: adminEmail,
        passwordHash: adminHash,
        role: 'admin',
        interests: ['system', 'administration', 'security'],
      });
      console.log(`Created admin: ${adminEmail}`);
    } else {
      console.log(`Admin ${adminEmail} already exists.`);
    }

    const defaultPasswordHash = await bcrypt.hash('UserPassword123!', BCRYPT_SALT_ROUNDS);

    // 2. Ensure User 1 (Alice) exists
    let user1 = await User.findOne({ email: 'user1@example.com' });
    if (!user1) {
      user1 = await User.create({
        name: 'Alice (User 1)',
        email: 'user1@example.com',
        passwordHash: defaultPasswordHash,
        role: 'user',
        interests: ['coding', 'chess', 'reading'],
      });
      console.log('Created user1@example.com');

      // Seed notes for User 1
      await Note.create([
        {
          owner: user1._id,
          title: "Alice's Project Roadmap",
          content: 'Working on secure note-taking architecture and index optimization.',
        },
        {
          owner: user1._id,
          title: 'Personal Bookmarks',
          content: 'MongoDB aggregation documentation and React hooks guide.',
        },
      ]);

      // Seed posts for User 1
      await Post.create([
        {
          author: user1._id,
          title: 'Hello Secure Notes Community!',
          content: 'Excited to test out this secure note taking application with full RBAC.',
        },
        {
          author: user1._id,
          title: 'MongoDB Aggregations in Practice',
          content: 'Scenario 1 $facet and Scenario 2 $lookup are performing with index coverage.',
        },
      ]);
      console.log('Seeded sample notes and posts for user1');
    } else {
      console.log('user1@example.com already exists.');
    }

    // 3. Ensure User 2 (Bob) exists
    let user2 = await User.findOne({ email: 'user2@example.com' });
    if (!user2) {
      user2 = await User.create({
        name: 'Bob (User 2)',
        email: 'user2@example.com',
        passwordHash: defaultPasswordHash,
        role: 'user',
        interests: ['gaming', 'music', 'coding'],
      });
      console.log('Created user2@example.com');

      // Seed notes for User 2
      await Note.create([
        {
          owner: user2._id,
          title: "Bob's Workout Routine",
          content: 'Monday: Upper body, Wednesday: Lower body, Friday: 5km run.',
        },
        {
          owner: user2._id,
          title: 'Private Grocery List',
          content: 'Almond milk, rolled oats, espresso beans, fresh berries.',
        },
      ]);

      // Seed posts for User 2
      await Post.create([
        {
          author: user2._id,
          title: 'Clean Architecture with Express and React',
          content: 'Keeping business logic separated from controllers makes systems maintainable.',
        },
        {
          author: user2._id,
          title: 'Anyone up for a chess match?',
          content: 'Saw chess is the top interest in the aggregation report!',
        },
      ]);
      console.log('Seeded sample notes and posts for user2');
    } else {
      console.log('user2@example.com already exists.');
    }

    console.log('Demo user seeding complete.');
  } catch (error) {
    console.error('Failed to seed demo users:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

if (require.main === module) {
  seedDemoUsers().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
