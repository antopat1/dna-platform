// frontend-dapp/src/app/admin/authors/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { isAddress } from 'viem';

interface WhitelistedAuthor {
  _id: string;
  address: string;
  name: string;
  email?: string;
  isApproved: boolean;
}

export default function WhitelistedAuthorsPage() {
  const [authors, setAuthors] = useState<WhitelistedAuthor[]>([]);
  const [newAuthor, setNewAuthor] = useState({ address: '', name: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAuthors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/authors');
      const data = await res.json();
      if (data.success) {
        setAuthors(data.data);
      } else {
        setError(data.message || 'Failed to fetch authors.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isAddress(newAuthor.address)) {
      setError('Invalid Ethereum address.');
      return;
    }

    try {
      const res = await fetch('/api/admin/authors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAuthor),
      });
      const data = await res.json();
      if (data.success) {
        alert('Author added successfully!');
        setNewAuthor({ address: '', name: '', email: '' });
        fetchAuthors(); // Refresh the list
      } else {
        setError(data.message || 'Failed to add author.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Whitelisted Authors Management</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="bg-white p-6 rounded shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4">Add New Whitelisted Author</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Ethereum Address</label>
            <input
              type="text"
              id="address"
              value={newAuthor.address}
              onChange={(e) => setNewAuthor({ ...newAuthor, address: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="0x..."
              required
            />
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Author Name</label>
            <input
              type="text"
              id="name"
              value={newAuthor.name}
              onChange={(e) => setNewAuthor({ ...newAuthor, name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email (Optional)</label>
            <input
              type="email"
              id="email"
              value={newAuthor.email}
              onChange={(e) => setNewAuthor({ ...newAuthor, email: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add Author
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded shadow-md">
        <h2 className="text-2xl font-semibold mb-4">Whitelisted Authors</h2>
        {loading ? (
          <p>Loading authors...</p>
        ) : authors.length === 0 ? (
          <p>No whitelisted authors yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {authors.map((author) => (
              <li key={author._id} className="py-4">
                <p className="text-lg font-medium text-gray-900">{author.name} <span className="text-sm text-gray-500 text-gray-500">{author.isApproved ? '(Approved)' : '(Not Approved)'}</span></p>
                <p className="text-gray-600">{author.address}</p>
                {author.email && <p className="text-gray-600">{author.email}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}