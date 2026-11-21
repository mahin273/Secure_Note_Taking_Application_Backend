import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/user.model';
import { AppError } from './errorHandler';

interface JwtPayload {
  sub: string;
  role: 'user' | 'admin';
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 'Authentication token missing or invalid', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired authentication token', 401);
    }

    // Default _id index lookup to ensure deleted users or demoted roles take effect immediately
    const user = await User.findById(decoded.sub);
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'User account no longer exists', 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
