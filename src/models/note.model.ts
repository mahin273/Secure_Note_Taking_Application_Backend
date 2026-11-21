import { Schema, model, Document, Types } from 'mongoose';

export interface INote {
  owner: Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface INoteDocument extends INote, Document<Types.ObjectId> {}

const noteSchema = new Schema<INoteDocument>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index #3: User's note list (newest first via cursor), admin list filtered by owner, and cascade delete
noteSchema.index({ owner: 1, _id: -1 });

export const Note = model<INoteDocument>('Note', noteSchema);
