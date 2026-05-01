import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Heart, Users, Package, Store } from 'lucide-react';

export const Profile = () => {
  const { userProfile, logout, switchRole } = useAuth();

  if (!userProfile) {
    return <div className="text-center py-12 text-gray-400">Please log in to view your profile.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-8 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 bg-gradient-to-br from-brand-sky to-brand-purple rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                {userProfile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white text-gradient">{userProfile.name}</h1>
                <p className="text-gray-400">{userProfile.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-sky/20 text-brand-sky border border-brand-sky/30 capitalize">
                    {userProfile.role}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 border border-white/10 rounded-md text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-lg font-medium text-white mb-6 text-gradient">Your Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/orders" className="flex items-center p-6 glass-card rounded-xl hover:shadow-[0_0_15px_rgba(14,165,233,0.2)] transition-all duration-300 group">
              <div className="h-12 w-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-brand-sky transition-colors">
                <Package className="h-6 w-6 text-gray-400 group-hover:text-brand-sky transition-colors" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-white group-hover:text-brand-sky transition-colors">Your Orders</h3>
                <p className="text-sm text-gray-400">Track, return, or buy things again</p>
              </div>
            </Link>

            <Link to="/wishlist" className="flex items-center p-6 glass-card rounded-xl hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all duration-300 group">
              <div className="h-12 w-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-brand-red transition-colors">
                <Heart className="h-6 w-6 text-gray-400 group-hover:text-brand-red transition-colors" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-white group-hover:text-brand-red transition-colors">Wishlist</h3>
                <p className="text-sm text-gray-400">Products you've saved for later</p>
              </div>
            </Link>

            <Link to="/following" className="flex items-center p-6 glass-card rounded-xl hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all duration-300 group">
              <div className="h-12 w-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-brand-purple transition-colors">
                <Users className="h-6 w-6 text-gray-400 group-hover:text-brand-purple transition-colors" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-white group-hover:text-brand-purple transition-colors">Following</h3>
                <p className="text-sm text-gray-400">Stores you are following</p>
              </div>
            </Link>

            {userProfile.role === 'vendor' && (
              <Link to="/vendor" className="flex items-center p-6 glass-card rounded-xl hover:shadow-[0_0_15px_rgba(14,165,233,0.2)] transition-all duration-300 group">
                <div className="h-12 w-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 group-hover:border-brand-sky transition-colors">
                  <Store className="h-6 w-6 text-gray-400 group-hover:text-brand-sky transition-colors" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-white group-hover:text-brand-sky transition-colors">Vendor Dashboard</h3>
                  <p className="text-sm text-gray-400">Manage your store and products</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
