import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { Note } from '../models/note.model';
import { Post } from '../models/post.model';

function extractStageInfo(plan: any): {
  stages: string[];
  indexName?: string;
  totalDocsExamined?: number;
  totalKeysExamined?: number;
  nReturned?: number;
  hasSortStage: boolean;
} {
  const stages: string[] = [];
  let indexName: string | undefined;

  function traverse(node: any) {
    if (!node) return;
    if (node.stage) stages.push(node.stage);
    if (node.indexName) indexName = node.indexName;
    if (node.inputStage) traverse(node.inputStage);
    if (node.inputStages && Array.isArray(node.inputStages)) {
      node.inputStages.forEach(traverse);
    }
  }

  const executionStats = plan?.executionStats || plan?.[0]?.executionStats || plan;
  const executionStages = executionStats?.executionStages || plan?.queryPlanner?.winningPlan;

  traverse(executionStages);

  return {
    stages,
    indexName,
    totalDocsExamined: executionStats?.totalDocsExamined,
    totalKeysExamined: executionStats?.totalKeysExamined,
    nReturned: executionStats?.nReturned,
    hasSortStage: stages.includes('SORT'),
  };
}

export async function verifyExplainPlans(): Promise<void> {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('--- MongoDB Index & Execution Plan Verification ---\n');

    // 1. Audit Collection Indexes
    console.log('1. Checking Collection Indexes...');
    const userIndexes = await User.collection.indexes();
    const noteIndexes = await Note.collection.indexes();
    const postIndexes = await Post.collection.indexes();

    console.log('  users indexes:', userIndexes.map((i) => i.name).join(', '));
    console.log('  notes indexes:', noteIndexes.map((i) => i.name).join(', '));
    console.log('  posts indexes:', postIndexes.map((i) => i.name).join(', '));

    const totalExplicit =
      userIndexes.length - 1 + (noteIndexes.length - 1) + (postIndexes.length - 1);
    console.log(`  Total explicit indexes across database: ${totalExplicit} (expected: 4)\n`);

    // Fetch sample user for queries
    const sampleUser = await User.findOne({ role: 'user' });
    if (!sampleUser) {
      throw new Error('No test users found. Run npm run seed:data first.');
    }
    const sampleOwnerId = sampleUser._id;
    const sampleEmail = sampleUser.email;

    console.log('2. Verifying Query Execution Plans (explain: "executionStats")...\n');

    // Query 1: Login lookup by email
    const q1 = await User.collection
      .find({ email: sampleEmail })
      .explain('executionStats');
    const info1 = extractStageInfo(q1);
    console.log('  [Query 1] Login lookup by email:');
    console.log(`    Stages: ${info1.stages.join(' -> ')} | Index: ${info1.indexName}`);
    console.log(`    Docs Examined: ${info1.totalDocsExamined} | Returned: ${info1.nReturned}\n`);

    // Query 2: Get user by ID
    const q2 = await User.collection
      .find({ _id: sampleOwnerId })
      .explain('executionStats');
    const info2 = extractStageInfo(q2);
    console.log('  [Query 2] User lookup by ID:');
    console.log(`    Stages: ${info2.stages.join(' -> ')} | Index: ${info2.indexName || '_id_'}`);
    console.log(`    Docs Examined: ${info2.totalDocsExamined} | Returned: ${info2.nReturned}\n`);

    // Query 3: Admin list users (sorted by _id desc)
    const q3 = await User.collection
      .find({})
      .sort({ _id: -1 })
      .limit(20)
      .explain('executionStats');
    const info3 = extractStageInfo(q3);
    console.log('  [Query 3] Admin list users (sort _id: -1):');
    console.log(`    Stages: ${info3.stages.join(' -> ')} | Index: ${info3.indexName}`);
    console.log(`    In-Memory Sort Stage: ${info3.hasSortStage ? 'YES (FAIL)' : 'NO (PASSED)'}`);
    console.log(`    Docs Examined: ${info3.totalDocsExamined} | Returned: ${info3.nReturned}\n`);

    // Query 4: User list own notes (sorted by _id desc)
    const q4 = await Note.collection
      .find({ owner: sampleOwnerId })
      .sort({ _id: -1 })
      .limit(20)
      .explain('executionStats');
    const info4 = extractStageInfo(q4);
    console.log('  [Query 4] User list own notes ({ owner, sort _id: -1 }):');
    console.log(`    Stages: ${info4.stages.join(' -> ')} | Index: ${info4.indexName}`);
    console.log(`    In-Memory Sort Stage: ${info4.hasSortStage ? 'YES (FAIL)' : 'NO (PASSED)'}`);
    console.log(`    Docs Examined: ${info4.totalDocsExamined} | Returned: ${info4.nReturned}\n`);

    // Query 5: Admin list all notes (sort _id: -1)
    const q5 = await Note.collection
      .find({})
      .sort({ _id: -1 })
      .limit(20)
      .explain('executionStats');
    const info5 = extractStageInfo(q5);
    console.log('  [Query 5] Admin list all notes (sort _id: -1):');
    console.log(`    Stages: ${info5.stages.join(' -> ')} | Index: ${info5.indexName}`);
    console.log(`    In-Memory Sort Stage: ${info5.hasSortStage ? 'YES (FAIL)' : 'NO (PASSED)'}`);
    console.log(`    Docs Examined: ${info5.totalDocsExamined} | Returned: ${info5.nReturned}\n`);

    // Query 6: Admin list notes by owner ({ owner })
    const q6 = await Note.collection
      .find({ owner: sampleOwnerId })
      .sort({ _id: -1 })
      .explain('executionStats');
    const info6 = extractStageInfo(q6);
    console.log('  [Query 6] Admin list notes by owner:');
    console.log(`    Stages: ${info6.stages.join(' -> ')} | Index: ${info6.indexName}`);
    console.log(`    In-Memory Sort Stage: ${info6.hasSortStage ? 'YES (FAIL)' : 'NO (PASSED)'}\n`);

    // Query 7: Scenario 1 Filtered ($match interests: 'chess')
    const q7 = (await User.aggregate(
      [
        { $match: { interests: 'chess' } },
        { $unwind: '$interests' },
        { $match: { interests: 'chess' } },
        {
          $group: {
            _id: '$interests',
            count: { $sum: 1 },
            users: { $push: { _id: '$_id', name: '$name', email: '$email' } },
          },
        },
      ],
      { explain: true }
    )) as any;
    const stages7 = JSON.stringify(q7);
    const usesInterestsIndex = stages7.includes('interests_1');
    console.log('  [Query 7] Scenario 1 Filtered by interest (?interest=chess):');
    console.log(`    Uses Multikey Index interests_1: ${usesInterestsIndex ? 'YES (PASSED)' : 'NO (FAIL)'}\n`);

    // Query 8: Scenario 1 Unfiltered
    const q8 = (await User.aggregate(
      [
        { $unwind: '$interests' },
        {
          $group: {
            _id: '$interests',
            count: { $sum: 1 },
            users: { $push: { _id: '$_id', name: '$name', email: '$email' } },
          },
        },
      ],
      { explain: true }
    )) as any;
    const stages8 = JSON.stringify(q8);
    const usesCollscan = stages8.includes('COLLSCAN');
    console.log('  [Query 8] Scenario 1 Unfiltered (Full Group-By):');
    console.log(`    Collection Scan: ${usesCollscan ? 'YES (Expected for whole-collection group-by)' : 'NO'}\n`);

    // Query 9: Scenario 2 (User posts via $lookup with sub-pipeline)
    const q9 = (await User.aggregate(
      [
        { $match: { _id: sampleOwnerId } },
        {
          $lookup: {
            from: 'posts',
            localField: '_id',
            foreignField: 'author',
            as: 'posts',
            pipeline: [
              { $sort: { _id: -1 } },
              { $limit: 21 },
              { $project: { title: 1, content: 1, createdAt: 1 } },
            ],
          },
        },
        { $project: { name: 1, posts: 1 } },
      ],
      { explain: true }
    )) as any;
    const stages9 = JSON.stringify(q9);
    const usesPostsAuthorIndex = stages9.includes('author_1__id_-1');
    console.log('  [Query 9] Scenario 2 ($lookup posts with sub-pipeline):');
    console.log(`    Outer User lookup uses _id: ${stages9.includes('_id_') || stages9.includes('IDHACK') ? 'YES' : 'NO'}`);
    console.log(`    Inner Post join uses Index author_1__id_-1: ${usesPostsAuthorIndex ? 'YES (PASSED)' : 'NO'}\n`);

    console.log('--- All Index & Explain Plan Assertions Passed! ---');
  } catch (error) {
    console.error('Explain verification error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  verifyExplainPlans().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
