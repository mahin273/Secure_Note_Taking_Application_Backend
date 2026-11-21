import { Schema, model, Document, Types } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document<Types.ObjectId> {}

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },
    interests: {
      type: [String],
      default: [],
      set: (interests: string[]) =>
        interests.map((interest) => interest.toLowerCase().trim()),
    },
  },
  {
    timestamps: true,
  }
);

// Index #1: Email lookup for login and uniqueness constraint
userSchema.index({ email: 1 }, { unique: true });

// Index #2: Multikey index for Scenario 1 filtered by one interest ($match before $unwind)
userSchema.index({ interests: 1 });

// Admin user list sorts by _id descending and uses the default _id index;
// no extra index is needed.

export const User = model<IUserDocument>('User', userSchema);
