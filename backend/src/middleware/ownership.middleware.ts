import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

type PrismaModel = 'job' | 'document' | 'profile';

export function checkOwnership(model: PrismaModel, paramName: string = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const recordId = req.params[paramName] as string;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'No token provided' });
      }

      const record = await (prisma[model] as any).findUnique({
        where: { id: recordId },
      });

      if (!record) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }

      if (record.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      next();
    } catch (error) {
      console.error('ownership check error:', error);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  };
}
