import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    thinking?: string[];
  }>;
  createdAt: Date;
}

const ChatSchema = new Schema<IChat>({
  sessionId: { type: String, required: true, unique: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    thinking: [String]
  }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Chat || mongoose.model<IChat>('Chat', ChatSchema);