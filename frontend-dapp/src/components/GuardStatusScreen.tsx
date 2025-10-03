'use client';
import React from 'react';


const ICONS = {
  loading: <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>,
  error: (
    <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center">
      <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
    </div>
  ),
  denied: (
    <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center">
      <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </div>
  ),
};


interface GuardStatusScreenProps {
  iconType: keyof typeof ICONS;
  title: string;
  message: React.ReactNode;
  actions?: React.ReactNode;
}

export const GuardStatusScreen: React.FC<GuardStatusScreenProps> = ({ iconType, title, message, actions }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {ICONS[iconType]}
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">{title}</h2>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
        </div>
        {actions && <div className="mt-8 space-y-4">{actions}</div>}
      </div>
    </div>
  );
};