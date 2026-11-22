import { Types } from 'mongoose';
import { Post, IPostDocument } from '../models/post.model';
import { User } from '../models/user.model';
import { AppError } from '../middleware/errorHandler';

export interface CreatePostDTO {
  title: string;
  content?: string;
}

export interface UserPostsResponse {
  data: {
    _id: string;
    name: string;
    posts: any[];
  };
  nextCursor: string | null;
}

export async function createPost(
  authorId: string,
  dto: CreatePostDTO
): Promise<IPostDocument> {
  const post = await Post.create({
    author: new Types.ObjectId(authorId),
    title: dto.title,
    content: dto.content ?? '',
  });

  return post;
}

// Scenario 2: Single aggregation pipeline with $lookup to retrieve a user's posts
export async function getUserPosts(
  userId: string,
  limit: number = 20,
  after?: string
): Promise<UserPostsResponse> {
  const subPipeline: any[] = [];

  if (after) {
    subPipeline.push({
      $match: {
        _id: { $lt: new Types.ObjectId(after) },
      },
    });
  }

  subPipeline.push(
    { $sort: { _id: -1 } },
    { $limit: limit + 1 },
    { $project: { title: 1, content: 1, createdAt: 1 } }
  );

  const [result] = await User.aggregate([
    // Outer match uses default _id index
    { $match: { _id: new Types.ObjectId(userId) } },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        as: 'posts',
        pipeline: subPipeline,
      },
    },
    {
      $project: {
        name: 1,
        posts: 1,
      },
    },
  ]);

  if (!result) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  const posts = result.posts || [];
  const hasMore = posts.length > limit;
  const returnedPosts = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore
    ? returnedPosts[returnedPosts.length - 1]._id.toString()
    : null;

  return {
    data: {
      _id: result._id.toString(),
      name: result.name,
      posts: returnedPosts,
    },
    nextCursor,
  };
}

export interface PostsListResponse {
  posts: any[];
  nextCursor: string | null;
}

export async function getAllPosts(
  limit: number = 10,
  after?: string
): Promise<PostsListResponse> {
  const query: any = {};
  if (after) {
    query._id = { $lt: new Types.ObjectId(after) };
  }

  const posts = await Post.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('author', 'name email')
    .lean();

  const hasMore = posts.length > limit;
  const returnedPosts = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore
    ? returnedPosts[returnedPosts.length - 1]._id.toString()
    : null;

  return {
    posts: returnedPosts,
    nextCursor,
  };
}
