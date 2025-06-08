// frontend-dapp/src/models/NftTemplateDefinition.ts
import mongoose, { Schema, Document } from 'mongoose';

// Definisci i tipi per le opzioni di vendita
export type SaleOption = 'fixed_price' | 'auction' | 'both';

export interface INftTemplateDefinition extends Document {
  name: string;
  description: string;
  metadataSchema: any; // JSON Schema per i metadati dell'NFT (oggetto arbitrario)
  royaltyPercentage: number;
  saleOptions: SaleOption; // Opzioni di vendita: prezzo fisso, asta o entrambi
  maxCopies: number; // Numero massimo di copie mintabili per un'opera/articolo
  createdAt: Date;
  updatedAt: Date;
}

const NftTemplateDefinitionSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  metadataSchema: { type: Object, required: true }, // Conserva come oggetto generico
  royaltyPercentage: { type: Number, required: true, min: 0, max: 100 },
  saleOptions: { type: String, required: true, enum: ['fixed_price', 'auction', 'both'], default: 'fixed_price' }, // Predefinito 'fixed_price'
  maxCopies: { type: Number, required: true, min: 1 }, // Minimo 1 copia
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Aggiorna 'updatedAt' su ogni salvataggio
NftTemplateDefinitionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const NftTemplateDefinition = mongoose.models.NftTemplateDefinition || mongoose.model<INftTemplateDefinition>('NftTemplateDefinition', NftTemplateDefinitionSchema);

export default NftTemplateDefinition;