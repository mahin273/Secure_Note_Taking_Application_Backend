import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { validateQuery } from '../middleware/validate';
import {
  objectIdSchema,
  cursorPaginationQuerySchema,
} from '../utils/pagination';
import * as notesService from '../services/notes.service';

const router = Router();

const adminNotesQuerySchema = cursorPaginationQuerySchema.extend({
  owner: objectIdSchema.optional(),
});

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// GET /api/admin/notes?owner=&limit=&after=
router.get(
  '/notes',
  validateQuery(adminNotesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { owner, limit, after } = req.query as unknown as {
        owner?: string;
        limit: number;
        after?: string;
      };

      const result = await notesService.listAllNotes(owner, limit, after);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
