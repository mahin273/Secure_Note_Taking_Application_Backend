import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import { cursorPaginationQuerySchema } from '../utils/pagination';
import * as postsService from '../services/posts.service';

const router = Router();

const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  content: z.string().optional(),
});

// GET /api/posts (Public: cursor-paginated)
router.get(
  '/',
  validateQuery(cursorPaginationQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, after } = req.query as unknown as {
        limit: number;
        after?: string;
      };
      const result = await postsService.getAllPosts(limit, after);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/posts (Authenticated)
router.post(
  '/',
  authenticate,
  validateBody(createPostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const post = await postsService.createPost(
        req.user!._id.toString(),
        req.body
      );
      res.status(201).json({ data: post });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
