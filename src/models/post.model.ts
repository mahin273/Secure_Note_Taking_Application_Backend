import { Schema, model, Document, Types } from 'mongoose';

export interface IPost {
  author: Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPostDocument extends IPost, Document<Types.ObjectId> {}

const postSchema = new Schema<IPostDocument>(
  {
    author: {
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

// Index #4: Scenario 2 $lookup join + sort, and cascade delete of a user's posts
postSchema.index({ author: 1, _id: -1 });

export const Post = model<IPostDocument>('Post', postSchema);
