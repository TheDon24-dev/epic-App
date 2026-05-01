import React from 'react';
import { Hammer } from 'lucide-react';

export const Maintenance = ({ supportEmail }: { supportEmail: string }) => {
  return (
    <div className="min-h-screen cinematic-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-24 w-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
          <Hammer className="h-12 w-12 text-brand-sky" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-4 text-gradient">Under Maintenance</h1>
        <p className="text-lg text-gray-400 mb-8">
          We're currently performing some scheduled maintenance to improve your experience. 
          We'll be back online shortly!
        </p>
        <div className="glass-panel p-6 rounded-xl">
          <p className="text-sm text-gray-400">
            If you have any urgent questions, please contact our support team at 
            <a href={`mailto:${supportEmail}`} className="text-brand-sky font-medium ml-1 hover:text-brand-sky/80 transition-colors">{supportEmail}</a>
          </p>
        </div>
      </div>
    </div>
  );
};
