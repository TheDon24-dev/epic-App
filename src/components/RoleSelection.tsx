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
      // The AuthContext will automatically update the userProfile state
      // since it's listening to auth state, but we might need to refresh the page
      // or rely on the onAuthStateChanged if we had a snapshot listener.
      // Wait, AuthContext only fetches the user profile once on login.
      // We should probably reload the window to fetch the updated profile,
      // or update the context state directly.
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Welcome to Online Mall!</h2>
        <p className="text-lg text-gray-500 mb-8">How would you like to use our platform?</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => handleSelectRole('customer')}
            disabled={loading}
            className="flex flex-col items-center justify-center p-8 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
          >
            <div className="h-20 w-20 bg-indigo-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-200 transition-colors">
              <ShoppingBag className="h-10 w-10 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">I want to Buy</h3>
            <p className="text-sm text-gray-500">Discover products, follow stores, and shop from various categories.</p>
          </button>
          
          <button
            onClick={() => handleSelectRole('vendor')}
            disabled={loading}
            className="flex flex-col items-center justify-center p-8 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
              <Store className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">I want to Sell</h3>
            <p className="text-sm text-gray-500">Create a store, upload products, set prices, and reach buyers.</p>
          </button>
        </div>
        
        {loading && <p className="mt-6 text-indigo-600 font-medium animate-pulse">Setting up your account...</p>}
      </div>
    </div>
  );
};
