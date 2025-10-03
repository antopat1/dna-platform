// frontend-dapp/src/app/admin/templates/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { SaleOption } from '@/models/NftTemplateDefinition'; 

interface NftTemplate {
  _id: string;
  name: string;
  description: string;
  metadataSchema: any;
  royaltyPercentage: number;
  saleOptions: SaleOption; 
  maxCopies: number; 
}

export default function NftTemplatesPage() {
  const [templates, setTemplates] = useState<NftTemplate[]>([]);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    metadataSchema: '{}',
    royaltyPercentage: 0,
    saleOptions: 'fixed_price' as SaleOption, 
    maxCopies: 1, 
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      } else {
        setError(data.message || 'Failed to fetch templates.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const parsedMetadataSchema = JSON.parse(newTemplate.metadataSchema);
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newTemplate, metadataSchema: parsedMetadataSchema }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Template created successfully!');
        setNewTemplate({
          name: '',
          description: '',
          metadataSchema: '{}',
          royaltyPercentage: 0,
          saleOptions: 'fixed_price', 
          maxCopies: 1, 
        });
        fetchTemplates(); 
      } else {
        setError(data.message || 'Failed to create template.');
      }
    } catch (err: any) {
      setError(err.message || 'Error parsing JSON or network error.');
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-800">NFT Templates Management</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="bg-white p-6 rounded shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4  text-gray-500">Create New Template</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              id="name"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              className="mt-1 block w-full border text-gray-700 border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="description"
              value={newTemplate.description}
              onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
              rows={3}
              className="mt-1 block w-full border text-gray-700 border-gray-300 rounded-md shadow-sm p-2"
              required
            ></textarea>
          </div>
          <div>
            <label htmlFor="metadataSchema" className="block text-sm font-medium text-gray-700">Metadata Schema (JSON)</label>
            <textarea
              id="metadataSchema"
              value={newTemplate.metadataSchema}
              onChange={(e) => setNewTemplate({ ...newTemplate, metadataSchema: e.target.value })}
              rows={5}
              className="mt-1 block w-full border text-gray-700 border-gray-300 rounded-md shadow-sm p-2 font-mono"
              placeholder='E.g., {"type": "object", "properties": {"subject": {"type": "string"}, "year": {"type": "number"}}}'
              required
            ></textarea>
            <p className="mt-1 text-sm text-gray-500">
              Define the JSON schema for NFT metadata. This guides authors on what data to provide.
            </p>
          </div>
          <div>
            <label htmlFor="royaltyPercentage" className="block text-sm font-medium text-gray-700">Royalty Percentage (0-100)</label>
            <input
              type="number"
              id="royaltyPercentage"
              value={newTemplate.royaltyPercentage}
              onChange={(e) => setNewTemplate({ ...newTemplate, royaltyPercentage: parseFloat(e.target.value) })}
              min="0"
              max="100"
              className="mt-1 block w-full border border-gray-300 text-gray-700 rounded-md shadow-sm p-2"
              required
            />
          </div>
          
          <div>
            <label htmlFor="saleOptions" className="block text-sm font-medium text-gray-700">Sale Options</label>
            <select
              id="saleOptions"
              value={newTemplate.saleOptions}
              onChange={(e) => setNewTemplate({ ...newTemplate, saleOptions: e.target.value as SaleOption })}
              className="mt-1 block w-full border border-gray-300 text-gray-700 rounded-md shadow-sm p-2"
              required
            >
              <option value="fixed_price">Fixed Price</option>
              <option value="auction">Auction</option>
              <option value="both">Both (Fixed Price & Auction)</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="maxCopies" className="block text-sm font-medium text-gray-700">Max Copies</label>
            <input
              type="number"
              id="maxCopies"
              value={newTemplate.maxCopies}
              onChange={(e) => setNewTemplate({ ...newTemplate, maxCopies: parseInt(e.target.value, 10) })}
              min="1"
              className="mt-1 block w-full border border-gray-300 text-gray-700 rounded-md shadow-sm p-2"
              required
            />
          </div>

          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create Template
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-500">Existing NFT Templates</h2>
        {loading ? (
          <p>Loading templates...</p>
        ) : templates.length === 0 ? (
          <p>No templates created yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {templates.map((template) => (
              <li key={template._id} className="py-4">
                <p className="text-lg font-medium text-gray-900">{template.name}</p>
                <p className="text-gray-600">{template.description}</p>
                <p className="text-sm text-gray-500">Royalty: {template.royaltyPercentage}% | Sale Option: {template.saleOptions.replace('_', ' ')} | Max Copies: {template.maxCopies}</p>
                <pre className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(template.metadataSchema, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}