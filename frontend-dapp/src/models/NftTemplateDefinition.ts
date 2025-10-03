// frontend-dapp/src/models/NftTemplateDefinition.ts
import mongoose, { Schema, Document } from 'mongoose';


export type SaleOption = 'fixed_price' | 'auction' | 'both';

export interface INftTemplateDefinition extends Document {
  name: string;
  description: string;
  metadataSchema: any; 
  royaltyPercentage: number;
  saleOptions: SaleOption; 
  maxCopies: number; 
  createdAt: Date;
  updatedAt: Date;
}

const NftTemplateDefinitionSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  metadataSchema: { type: Object, required: true }, 
  royaltyPercentage: { type: Number, required: true, min: 0, max: 100 },
  saleOptions: { type: String, required: true, enum: ['fixed_price', 'auction', 'both'], default: 'fixed_price' }, // Predefinito 'fixed_price'
  maxCopies: { type: Number, required: true, min: 1 }, 
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


NftTemplateDefinitionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const NftTemplateDefinition = mongoose.models.NftTemplateDefinition || mongoose.model<INftTemplateDefinition>('NftTemplateDefinition', NftTemplateDefinitionSchema);

export default NftTemplateDefinition;