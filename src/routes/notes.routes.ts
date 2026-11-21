import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import {
  objectIdSchema,
  cursorPaginationQuerySchema,
} from '../utils/pagination';
import * as notesService from '../services/notes.service';

const router = Router();

const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  content: z.string().optional(),
});

const updateNoteSchema = z
  .object({
    title: z.string().min(1, 'Title cannot be empty').trim().optional(),
    content: z.string().optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'At least one field (title or content) must be provided',
  });

const noteIdParamSchema = z.object({
  id: objectIdSchema,
});

// All notes routes require authentication
router.use(authenticate);

// POST /api/notes (Create own note)
router.post(
  '/',
  validateBody(createNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await notesService.createNote(
        req.user!._id.toString(),
        req.body
      );
      res.status(201).json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/notes (List own notes, cursor paginated)
router.get(
  '/',
  validateQuery(cursorPaginationQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, after } = req.query as unknown as {
        limit: number;
        after?: string;
      };
      const result = await notesService.listUserNotes(
        req.user!._id.toString(),
        limit,
        after
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/notes/:id (Get one note: owner or admin)
router.get(
  '/:id',
  validateParams(noteIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await notesService.getNoteById(req.params.id, req.user!);
      res.status(200).json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/notes/:id (Update own note)
router.patch(
  '/:id',
  validateParams(noteIdParamSchema),
  validateBody(updateNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const note = await notesService.updateNote(
        req.params.id,
        req.user!._id.toString(),
        req.body
      );
      res.status(200).json({ data: note });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/notes/:id (Delete own note)
router.delete(
  '/:id',
  validateParams(noteIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await notesService.deleteNote(req.params.id, req.user!._id.toString());
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
