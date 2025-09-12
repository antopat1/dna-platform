// frontend-dapp/src/models/AuditAuthor.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditAuthor extends Document {
  _id: Types.ObjectId;
  walletAddress: string;
  name: string;
  email: string;
  institution?: string;
  researchArea?: string;
  biography: string;
  publicationsLink?: string;
  linkedinProfile?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVIEW_REQUIRED' | 'ERROR';
  llmScore?: number;
  llmComment?: string;
  llmApproved?: boolean; // Aggiunto per coerenza con il codice API
  transactionHash?: string; // Aggiunto per il whitelisting
  createdAt: Date;
  updatedAt: Date;
}

const AuditAuthorSchema = new Schema<IAuditAuthor>({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  institution: {
    type: String,
    trim: true,
    maxlength: 200
  },
  researchArea: {
    type: String,
    trim: true,
    maxlength: 100
  },
  biography: {
    type: String,
    required: true,
    minlength: 200,
    maxlength: 2000
  },
  publicationsLink: {
    type: String,
    trim: true,
    match: /^https?:\/\/.+/
  },
  linkedinProfile: {
    type: String,
    trim: true,
    match: /^https?:\/\/.+/
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVIEW_REQUIRED', 'ERROR'],
    default: 'PENDING'
  },
  llmScore: {
    type: Number,
    min: 0,
    max: 100
  },
  llmComment: {
    type: String,
    maxlength: 1000
  },
  llmApproved: { // Campo aggiunto
    type: Boolean
  },
  transactionHash: { // Campo aggiunto
    type: String,
    trim: true,
  }
}, {
  timestamps: true
});

// Indici per ottimizzare le query
AuditAuthorSchema.index({ walletAddress: 1 });
AuditAuthorSchema.index({ status: 1 });
AuditAuthorSchema.index({ createdAt: -1 });

export default mongoose.models.AuditAuthor || mongoose.model<IAuditAuthor>('AuditAuthor', AuditAuthorSchema);

