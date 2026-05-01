import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Store, ShoppingBag } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const RoleSelection = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSelectRole = async (role: 'customer' | 'vendor') => {
    if (!userProfile) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), { role });
      // AuthContext uses onSnapshot, so userProfile will update automatically
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#030014]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel rounded-2xl max-w-2xl w-full p-8 text-center border border-white/10 shadow-[0_0_50px_rgba(14,165,233,0.15)]">
        <h2 className="text-3xl font-extrabold text-white mb-4 text-gradient">Welcome to Online Mall!</h2>
        <p className="text-lg text-gray-400 mb-8">How would you like to use our platform?</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => handleSelectRole('customer')}
            disabled={loading}
            className="flex flex-col items-center justify-center p-8 border border-white/10 rounded-xl hover:border-brand-sky bg-white/5 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all duration-300 group"
          >
            <div className="h-20 w-20 bg-brand-sky/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-sky/30 transition-colors shadow-[0_0_15px_rgba(14,165,233,0.4)]">
              <ShoppingBag className="h-10 w-10 text-brand-sky" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-sky transition-colors">I want to Buy</h3>
            <p className="text-sm text-gray-400">Discover products, follow stores, and shop from various categories.</p>
          </button>
          
          <button
            onClick={() => handleSelectRole('vendor')}
            disabled={loading}
            className="flex flex-col items-center justify-center p-8 border border-white/10 rounded-xl hover:border-brand-purple bg-white/5 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-300 group"
          >
            <div className="h-20 w-20 bg-brand-purple/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-purple/30 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              <Store className="h-10 w-10 text-brand-purple" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-purple transition-colors">I want to Sell</h3>
            <p className="text-sm text-gray-400">Create a store, upload products, set prices, and reach buyers.</p>
          </button>
        </div>
        
        {loading && <p className="mt-6 text-brand-sky font-medium animate-pulse">Setting up your account...</p>}
      </div>
    </div>
  );
};
