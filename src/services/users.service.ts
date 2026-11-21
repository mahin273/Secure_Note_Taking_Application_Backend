import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { User, IUserDocument, UserRole } from '../models/user.model';
import { Note } from '../models/note.model';
import { Post } from '../models/post.model';
import { AppError } from '../middleware/errorHandler';
import { paginateCursorResults } from '../utils/pagination';
import { SanitizedUser, sanitizeUser } from './auth.service';

const BCRYPT_SALT_ROUNDS = 12;

export interface AdminCreateUserDTO {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  interests?: string[];
}

export interface AdminUpdateUserDTO {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  interests?: string[];
}

export async function listUsers(
  limit: number,
  after?: string
): Promise<{ data: SanitizedUser[]; nextCursor: string | null }> {
  const query: Record<string, any> = {};

  if (after) {
    query._id = { $lt: new Types.ObjectId(after) };
  }

  // Uses default _id index
  const users = await User.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const { data, nextCursor } = paginateCursorResults(users, limit);
  return {
    data: data.map((u) => sanitizeUser(u as unknown as IUserDocument)),
    nextCursor,
  };
}

export async function createUser(dto: AdminCreateUserDTO): Promise<SanitizedUser> {
  const normalizedEmail = dto.email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new AppError('CONFLICT', 'Email is already registered', 409);
  }

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

  const newUser = await User.create({
    name: dto.name,
    email: normalizedEmail,
    passwordHash,
    role: dto.role ?? 'user',
    interests: dto.interests ?? [],
  });

  return sanitizeUser(newUser);
}

export async function getUserById(userId: string): Promise<SanitizedUser> {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  return sanitizeUser(user as unknown as IUserDocument);
}

export async function updateUser(
  userId: string,
  dto: AdminUpdateUserDTO
): Promise<SanitizedUser> {
  const updateData: Record<string, any> = {};

  if (dto.name !== undefined) updateData.name = dto.name;
  if (dto.role !== undefined) updateData.role = dto.role;
  if (dto.interests !== undefined) updateData.interests = dto.interests;

  if (dto.email !== undefined) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: new Types.ObjectId(userId) },
    });
    if (existing) {
      throw new AppError('CONFLICT', 'Email is already registered', 409);
    }
    updateData.email = normalizedEmail;
  }

  if (dto.password !== undefined) {
    updateData.passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).lean();

  if (!updatedUser) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  return sanitizeUser(updatedUser as unknown as IUserDocument);
}

export async function deleteUserCascade(userId: string): Promise<void> {
  const userObjectId = new Types.ObjectId(userId);
  const user = await User.findById(userObjectId);

  if (!user) {
    throw new AppError('NOT_FOUND', 'User not found', 404);
  }

  // Idempotent multi-collection deletion sequence: notes -> posts -> user
  await Note.deleteMany({ owner: userObjectId });
  await Post.deleteMany({ author: userObjectId });
  await User.findByIdAndDelete(userObjectId);
}
