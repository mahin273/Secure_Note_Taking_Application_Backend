import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../middleware/validate';
import {
  objectIdSchema,
  cursorPaginationQuerySchema,
} from '../utils/pagination';
import { sanitizeUser } from '../services/auth.service';
import * as usersService from '../services/users.service';

const router = Router();

const adminCreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.enum(['user', 'admin']).optional(),
  interests: z.array(z.string().trim()).optional(),
});

const adminUpdateUserSchema = z
  .object({
    name: z.string().min(1, 'Name cannot be empty').trim().optional(),
    email: z.string().email('Invalid email address').trim().toLowerCase().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters long').optional(),
    role: z.enum(['user', 'admin']).optional(),
    interests: z.array(z.string().trim()).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.password !== undefined ||
      data.role !== undefined ||
      data.interests !== undefined,
    {
      message: 'At least one field must be provided for update',
    }
  );

const userIdParamSchema = z.object({
  id: objectIdSchema,
});

// All users routes require authentication
router.use(authenticate);

// GET /api/users/me (Own profile)
router.get(
  '/me',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next();
      }
      res.status(200).json({ data: sanitizeUser(req.user) });
    } catch (error) {
      next(error);
    }
  }
);

// All subsequent routes in this file require admin role
router.use(requireRole('admin'));

// GET /api/users (List all users, cursor paginated)
router.get(
  '/',
  validateQuery(cursorPaginationQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, after } = req.query as unknown as {
        limit: number;
        after?: string;
      };
      const result = await usersService.listUsers(limit, after);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/users (Admin create user with role)
router.post(
  '/',
  validateBody(adminCreateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.createUser(req.body);
      res.status(201).json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/users/:id (Admin get user by ID)
router.get(
  '/:id',
  validateParams(userIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.getUserById(req.params.id);
      res.status(200).json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/users/:id (Admin update user)
router.patch(
  '/:id',
  validateParams(userIdParamSchema),
  validateBody(adminUpdateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.updateUser(req.params.id, req.body);
      res.status(200).json({ data: user });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/users/:id (Admin cascade delete user)
router.delete(
  '/:id',
  validateParams(userIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await usersService.deleteUserCascade(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
