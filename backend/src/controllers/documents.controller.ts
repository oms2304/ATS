import { Request, Response } from 'express';

export async function getDocuments(req: Request, res: Response) {
  return res.status(501).json({ success: false, error: 'Not implemented yet' });
}

export async function createDocument(req: Request, res: Response) {
  return res.status(501).json({ success: false, error: 'Not implemented yet' });
}

export async function getDocumentById(req: Request, res: Response) {
  return res.status(501).json({ success: false, error: 'Not implemented yet' });
}

export async function deleteDocument(req: Request, res: Response) {
  return res.status(501).json({ success: false, error: 'Not implemented yet' });
}
