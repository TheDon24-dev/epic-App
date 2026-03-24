import React from 'react';
import { Hammer } from 'lucide-react';

export const Maintenance = ({ supportEmail }: { supportEmail: string }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-24 w-24 bg-indigo-100 rounded-full flex items-center justify-center mb-8">
          <Hammer className="h-12 w-12 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Under Maintenance</h1>
        <p className="text-lg text-gray-600 mb-8">
          We're currently performing some scheduled maintenance to improve your experience. 
          We'll be back online shortly!
        </p>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">
            If you have any urgent questions, please contact our support team at 
            <a href={`mailto:${supportEmail}`} className="text-indigo-600 font-medium ml-1">{supportEmail}</a>
          </p>
        </div>
      </div>
    </div>
  );
};
