
import React from 'react';
import Header from './components/Header';
import Dashboard from './components/dashboard/Dashboard';
import { useTheme } from './components/ThemeProvider';

const App: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div 
        className="min-h-screen font-sans bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-300" 
        style={theme === 'dark' ? { backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)` , backgroundSize: '20px 20px' } : {}}
    >
      <Header />
      <main className="p-4 sm:p-6 lg:p-8">
        <Dashboard />
      </main>
    </div>
  );
};

export default App;