
import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './components/dashboard/Dashboard';
import { useTheme } from './components/ThemeProvider';
import BacktestModal from './components/BacktestModal';

const App: React.FC = () => {
  const { theme } = useTheme();
  const [isBacktestModalOpen, setIsBacktestModalOpen] = useState(false);

  const handleToggleBacktestModal = () => {
    setIsBacktestModalOpen(prev => !prev);
  };

  return (
    <div 
        className="min-h-screen font-sans bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-300" 
        style={theme === 'dark' ? { backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)` , backgroundSize: '20px 20px' } : {}}
    >
      <Header onToggleBacktestModal={handleToggleBacktestModal} />
      <main className="p-4 sm:p-6 lg:p-8">
        <Dashboard />
      </main>
      <BacktestModal isOpen={isBacktestModalOpen} onClose={handleToggleBacktestModal} />
    </div>
  );
};

export default App;
