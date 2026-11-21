import bcrypt from 'bcrypt';
import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { User, IUser } from '../models/user.model';
import { Note, INote } from '../models/note.model';
import { Post, IPost } from '../models/post.model';

const INTERESTS_POOL = [
  'chess',
  'reading',
  'music',
  'gaming',
  'coding',
  'photography',
  'travel',
  'cooking',
  'art',
  'hiking',
];

export async function seedLargeDataset(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB for large dataset generation.');

    // Remove existing seeded test data (retaining admin)
    await User.deleteMany({ email: { $ne: env.ADMIN_EMAIL.toLowerCase().trim() } });
    await Note.deleteMany({});
    await Post.deleteMany({});

    console.log('Pre-computing bcrypt hash for test users...');
    const sharedPasswordHash = await bcrypt.hash('TestPassword123!', 10);

    const userCount = 3000;
    const noteCount = 4000;
    const postCount = 3000;

    console.log(`Generating ${userCount} users...`);
    const usersData: Partial<IUser>[] = [];
    const userIds: Types.ObjectId[] = [];

    for (let i = 1; i <= userCount; i++) {
      const _id = new Types.ObjectId();
      userIds.push(_id);

      // Random 2-4 interests
      const interestCount = 2 + (i % 3);
      const userInterests: string[] = [];
      for (let j = 0; j < interestCount; j++) {
        const interest = INTERESTS_POOL[(i + j) % INTERESTS_POOL.length];
        if (!userInterests.includes(interest)) {
          userInterests.push(interest);
        }
      }

      usersData.push({
        _id,
        name: `User ${i}`,
        email: `user${i}_${Date.now()}@example.com`,
        passwordHash: sharedPasswordHash,
        role: 'user',
        interests: userInterests,
      } as any);
    }

    // Insert users in batches of 1000
    for (let i = 0; i < usersData.length; i += 1000) {
      await User.insertMany(usersData.slice(i, i + 1000), { ordered: false });
    }
    console.log(`Successfully inserted ${userCount} users.`);

    console.log(`Generating ${noteCount} notes...`);
    const notesData: Partial<INote>[] = [];
    for (let i = 1; i <= noteCount; i++) {
      const owner = userIds[i % userIds.length];
      notesData.push({
        owner,
        title: `Note Title ${i}`,
        content: `Note content number ${i} for testing cursor pagination and index efficiency.`,
      });
    }

    // Insert notes in batches of 1000
    for (let i = 0; i < notesData.length; i += 1000) {
      await Note.insertMany(notesData.slice(i, i + 1000), { ordered: false });
    }
    console.log(`Successfully inserted ${noteCount} notes.`);

    console.log(`Generating ${postCount} posts...`);
    const postsData: Partial<IPost>[] = [];
    for (let i = 1; i <= postCount; i++) {
      const author = userIds[i % userIds.length];
      postsData.push({
        author,
        title: `Post Title ${i}`,
        content: `Public post content ${i} for testing Scenario 2 lookup aggregation.`,
      });
    }

    // Insert posts in batches of 1000
    for (let i = 0; i < postsData.length; i += 1000) {
      await Post.insertMany(postsData.slice(i, i + 1000), { ordered: false });
    }
    console.log(`Successfully inserted ${postCount} posts.`);

    console.log('Large dataset population complete! (~10,000 documents ready)');
  } catch (error) {
    console.error('Failed to seed large dataset:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedLargeDataset().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
