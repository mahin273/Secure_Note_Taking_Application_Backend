import { Types } from 'mongoose';
import { Note, INoteDocument } from '../models/note.model';
import { AppError } from '../middleware/errorHandler';
import { paginateCursorResults } from '../utils/pagination';

export interface CreateNoteDTO {
  title: string;
  content?: string;
}

export interface UpdateNoteDTO {
  title?: string;
  content?: string;
}

export async function createNote(
  userId: string,
  dto: CreateNoteDTO
): Promise<INoteDocument> {
  const note = await Note.create({
    owner: new Types.ObjectId(userId),
    title: dto.title,
    content: dto.content ?? '',
  });

  return note;
}

export async function listUserNotes(
  userId: string,
  limit: number,
  after?: string
): Promise<{ data: any[]; nextCursor: string | null }> {
  const query: Record<string, any> = {
    owner: new Types.ObjectId(userId),
  };

  if (after) {
    query._id = { $lt: new Types.ObjectId(after) };
  }

  // Uses Index #3: { owner: 1, _id: -1 }
  const notes = await Note.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  return paginateCursorResults(notes, limit);
}

export async function getNoteById(
  noteId: string,
  user: { _id: Types.ObjectId; role: string }
): Promise<any> {
  const note = await Note.findById(noteId).lean();

  if (!note) {
    throw new AppError('NOT_FOUND', 'Note not found', 404);
  }

  // Accessible by the note owner or any admin
  if (note.owner.toString() !== user._id.toString() && user.role !== 'admin') {
    // Return 404 rather than 403 to prevent ID enumeration
    throw new AppError('NOT_FOUND', 'Note not found', 404);
  }

  return note;
}

export async function updateNote(
  noteId: string,
  userId: string,
  dto: UpdateNoteDTO
): Promise<any> {
  // Only the owner can update their own note
  const note = await Note.findOneAndUpdate(
    {
      _id: new Types.ObjectId(noteId),
      owner: new Types.ObjectId(userId),
    },
    { $set: dto },
    { new: true, runValidators: true }
  ).lean();

  if (!note) {
    throw new AppError('NOT_FOUND', 'Note not found', 404);
  }

  return note;
}

export async function deleteNote(noteId: string, userId: string): Promise<void> {
  // Only the owner can delete their own note
  const result = await Note.findOneAndDelete({
    _id: new Types.ObjectId(noteId),
    owner: new Types.ObjectId(userId),
  });

  if (!result) {
    throw new AppError('NOT_FOUND', 'Note not found', 404);
  }
}
