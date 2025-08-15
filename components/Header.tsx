
import React from 'react';
import { useTheme } from './ThemeProvider';

const ChipIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-500 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M12 6V3m0 18v-3M5.636 5.636l1.414 1.414m10.05 10.05l1.414 1.414M18.364 5.636l-1.414 1.414m-10.05 10.05l-1.414 1.414M12 12a3 3 0 100-6 3 3 0 000 6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a6 6 0 01-6 6H3.5a1 1 0 01-1-1V9.5a1 1 0 011-1H6a6 6 0 016 6zM12 12a6 6 0 006-6h2.5a1 1 0 011 1v5.5a1 1 0 01-1 1H18a6 6 0 00-6 6z" />
    </svg>
);

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    const SunIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 12a5 5 0 100-10 5 5 0 000 10z" />
        </svg>
    );

    const MoonIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
    );

    return (
        <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
        >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
    );
};


const Header: React.FC = () => {
  return (
    <header className="bg-white/70 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700/50 sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <div className="flex items-center space-x-3">
          <ChipIcon />
          <div>
             <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">AI 글로벌 주식 자동매매</h1>
             <p className="text-xs text-gray-500 dark:text-gray-400">Fundamental &amp; Sentiment Analysis Engine</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;
