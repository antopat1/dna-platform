'use client';

import Link from 'next/link';
import { Code, Zap } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-500 text-white mt-auto border-t border-gray-400">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Platform Info */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-purple-400">DnA Platform</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              A cutting-edge scientific content NFT platform enabling researchers 
              to tokenize, share, and monetize their intellectual contributions.
            </p>
            <div className="flex items-center space-x-2 text-purple-300">
              <Zap className="w-4 h-4" />
              <span className="text-sm">Powered by Blockchain Technology</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-200">Quick Links</h4>
            <nav className="flex flex-col space-y-2">
              <Link 
                href="/registered-content" 
                className="text-gray-300 hover:text-purple-300 transition-colors text-sm"
              >
                Browse Content
              </Link>
              <Link 
                href="/admin/templates" 
                className="text-gray-300 hover:text-purple-300 transition-colors text-sm"
              >
                Admin Panel
              </Link>
              <Link 
                href="/docs" 
                className="text-gray-300 hover:text-purple-300 transition-colors text-sm"
              >
                Documentation
              </Link>
              <Link 
                href="/support" 
                className="text-gray-300 hover:text-purple-300 transition-colors text-sm"
              >
                Support
              </Link>
            </nav>
          </div>

          {/* Technology Stack */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-200">Built With</h4>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>Next.js 14</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                <span>Tailwind CSS</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>Web3 Integration</span>
              </span>
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>TypeScript</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-400 bg-gray-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
            
            {/* Copyright */}
            <div className="text-sm text-gray-400">
              © {currentYear} DnA Platform. All rights reserved.
            </div>

            {/* Designer Credit */}
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span>System designed and developed by</span>
              <div className="flex items-center space-x-1">
                <Code className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 font-medium">Antonino Paternò</span>
              </div>
              <div className="flex items-center space-x-1">
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}