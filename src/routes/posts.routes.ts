import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import * as postsService from '../services/posts.service';

const router = Router();

const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  content: z.string().optional(),
});

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
