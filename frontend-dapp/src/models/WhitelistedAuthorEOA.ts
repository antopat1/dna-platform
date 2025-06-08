// frontend-dapp/src/models/WhitelistedAuthorEOA.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IWhitelistedAuthorEOA extends Document {
  address: string; // Indirizzo EOA dell'autore
  name: string;
  email?: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WhitelistedAuthorEOASchema: Schema = new Schema({
  address: { type: String, required: true, unique: true, lowercase: true }, // Assicuriamo che sia unico e minuscolo
  name: { type: String, required: true },
  email: { type: String, required: false },
  isApproved: { type: Boolean, default: true }, // Predefinito a true, l'admin può disattivare
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

WhitelistedAuthorEOASchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const WhitelistedAuthorEOA = mongoose.models.WhitelistedAuthorEOA || mongoose.model<IWhitelistedAuthorEOA>('WhitelistedAuthorEOA', WhitelistedAuthorEOASchema);

export default WhitelistedAuthorEOA;