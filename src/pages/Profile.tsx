import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Heart, Users, Package, Store } from 'lucide-react';

export const Profile = () => {
  const { userProfile, logout, switchRole } = useAuth();

  if (!userProfile) {
    return <div className="text-center py-12">Please log in to view your profile.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-2xl font-bold">
                {userProfile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{userProfile.name}</h1>
                <p className="text-gray-500">{userProfile.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                    {userProfile.role}
                  </span>
                  {userProfile.role !== 'admin' && (
                    <button
                      onClick={() => switchRole(userProfile.role === 'vendor' ? 'customer' : 'vendor')}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500 underline"
                    >
                      Switch to {userProfile.role === 'vendor' ? 'Buyer' : 'Seller'}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Your Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/orders" className="flex items-center p-6 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors group">
              <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:text-indigo-600">
                <Package className="h-6 w-6 text-gray-400 group-hover:text-indigo-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Your Orders</h3>
                <p className="text-sm text-gray-500">Track, return, or buy things again</p>
              </div>
            </Link>

            <Link to="/wishlist" className="flex items-center p-6 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors group">
              <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:text-indigo-600">
                <Heart className="h-6 w-6 text-gray-400 group-hover:text-indigo-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Wishlist</h3>
                <p className="text-sm text-gray-500">Products you've saved for later</p>
              </div>
            </Link>

            <Link to="/following" className="flex items-center p-6 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors group">
              <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:text-indigo-600">
                <Users className="h-6 w-6 text-gray-400 group-hover:text-indigo-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Following</h3>
                <p className="text-sm text-gray-500">Stores you are following</p>
              </div>
            </Link>

            {userProfile.role === 'vendor' && (
              <Link to="/vendor" className="flex items-center p-6 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors group">
                <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:text-indigo-600">
                  <Store className="h-6 w-6 text-gray-400 group-hover:text-indigo-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Vendor Dashboard</h3>
                  <p className="text-sm text-gray-500">Manage your store and products</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
