import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUserDocument } from '../models/user.model';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

const BCRYPT_SALT_ROUNDS = 12;

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  interests?: string[];
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface SanitizedUser {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function sanitizeUser(user: IUserDocument): SanitizedUser {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    interests: user.interests,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function register(dto: RegisterDTO): Promise<SanitizedUser> {
  // Uses Index #1: { email: 1 }
  const existingUser = await User.findOne({ email: dto.email.toLowerCase().trim() });
  if (existingUser) {
    throw new AppError('CONFLICT', 'Email is already registered', 409);
  }

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

  // Hardcode role to 'user' — ignore any client-supplied role
  const newUser = await User.create({
    name: dto.name,
    email: dto.email,
    passwordHash,
    role: 'user',
    interests: dto.interests ?? [],
  });

  return sanitizeUser(newUser);
}

export async function login(
  dto: LoginDTO
): Promise<{ token: string; user: SanitizedUser }> {
  // Uses Index #1: { email: 1 } with explicit select('+passwordHash')
  const user = await User.findOne({ email: dto.email.toLowerCase().trim() }).select(
    '+passwordHash'
  );

  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password', 401);
  }

  const token = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  return {
    token,
    user: sanitizeUser(user),
  };
}
