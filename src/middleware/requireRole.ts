import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/user.model';
import { AppError } from './errorHandler';

export function requireRole(requiredRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    }

    if (req.user.role !== requiredRole) {
      return next(
        new AppError('FORBIDDEN', 'Forbidden: insufficient permissions', 403)
      );
    }

    next();
  };
}
