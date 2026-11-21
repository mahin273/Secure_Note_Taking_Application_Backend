import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { validateQuery } from '../middleware/validate';
import * as reportsService from '../services/reports.service';

const router = Router();

const interestsReportQuerySchema = z.object({
  interest: z.string().trim().toLowerCase().optional(),
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: 'page must be greater than or equal to 1',
    }),
  limit: z
    .string()
    .optional()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 100, {
      message: 'limit must be between 1 and 100',
    }),
});

// All report routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// GET /api/reports/users-by-interests?interest=&page=&limit=
router.get(
  '/users-by-interests',
  validateQuery(interestsReportQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { interest, page, limit } = req.query as unknown as {
        interest?: string;
        page: number;
        limit: number;
      };

      const result = await reportsService.getUsersByInterests(
        interest,
        page,
        limit
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
