import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { sanitizeUser } from '../services/auth.service';

const router = Router();

// GET /api/users/me (Own profile)
router.get(
  '/me',
  authenticate,
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

export default router;
