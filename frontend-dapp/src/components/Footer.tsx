// frontend-dapp/src/components/Footer.tsx
'use client';

import Link from 'next/link';
import { Code, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '@/context/ThemeContext';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [isHovered, setIsHovered] = useState(false);
  const { isDarkMode } = useTheme();


  useEffect(() => {
    if (isHovered) {
      const timer = setTimeout(() => {
        const maxScroll = Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
        window.scrollTo({
          top: maxScroll,
          behavior: 'smooth'
        });
        setTimeout(() => {
          const footer = document.querySelector('footer');
          if (footer) {
            footer.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'end',
              inline: 'nearest'
            });
          }
        }, 100);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isHovered]);

  return (
    <footer 
      className="w-full transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >

      <div 
        className={`bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-white border-t border-gray-300 dark:border-slate-500 overflow-hidden transition-all duration-300 ${
          isHovered ? 'max-h-[1000px] opacity-100 py-8' : 'max-h-0 opacity-0 py-0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            

            <div className="space-y-4">
              <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400">DnA Platform</h3>
              <p className="text-gray-600 dark:text-slate-300 text-sm leading-relaxed">
                Una piattaforma NFT di contenuti scientifici all'avanguardia che consente ai ricercatori di tokenizzare, condividere e monetizzare i propri contributi intellettuali.
              </p>
              <div className="flex items-center space-x-2 text-purple-500 dark:text-purple-300">
                <Zap className="w-4 h-4" />
                <span className="text-sm">Powered by Blockchain Technology</span>
              </div>
            </div>


            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-700 dark:text-slate-200">Quick Links</h4>
              <nav className="flex flex-col space-y-2">
                <Link 
                  href="/registered-content" 
                  className="text-gray-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 transition-colors text-sm"
                >
                  Browse Content
                </Link>
                <Link 
                  href="/admin/templates" 
                  className="text-gray-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 transition-colors text-sm"
                >
                  Admin Panel
                </Link>
                <a 
                  href="mailto:antopat1@gmail.com"
                  className="text-gray-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 transition-colors text-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Support
                </a>
              </nav>
            </div>


            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-700 dark:text-slate-200">Built With</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-slate-300">
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
      </div>


      <div className="bg-gray-300 dark:bg-slate-700 border-t border-gray-400 dark:border-slate-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
     
            <div className="text-sm text-gray-500 dark:text-slate-400 order-1 sm:order-1">
              © {currentYear} DnA Platform. All rights reserved.
            </div>

       
            <div className="order-3 sm:order-2 flex items-center space-x-2">
              <span className={`text-sm font-medium transition-colors duration-200 ${isDarkMode ? 'text-gray-500 dark:text-slate-400' : 'text-gray-700 dark:text-white'}`}>Light</span>
              <ThemeToggle />
              <span className={`text-sm font-medium transition-colors duration-200 ${isDarkMode ? 'text-gray-700 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>Dark</span>
            </div>


            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-slate-400 order-2 sm:order-3">
              <span>System designed and developed by</span>
              <div className="flex items-center space-x-1">
                <Code className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <Link href="/founder" className="text-purple-700 dark:text-purple-300 font-medium hover:underline">
                  Antonino Paternò
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}


