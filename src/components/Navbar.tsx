import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Store, User, LogOut, Menu, Heart, Users, Bell, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { collection, query, where, onSnapshot, or } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

export const Navbar = () => {
  const { userProfile, loginError, loginWithGoogle, logout, switchRole, clearError } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const cartItemsCount = cart.reduce((sum, item) => sum + item.cartQuantity, 0);

  useEffect(() => {
    if (!userProfile) {
      setUnreadCount(0);
      setUnreadMessageCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('customerId', '==', userProfile.uid),
      where('read', '==', false)
    );

    const unsubscribeNotifications = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    let chatsQuery;
    if (userProfile.role === 'customer') {
      chatsQuery = query(collection(db, 'chats'), where('customerId', '==', userProfile.uid));
    } else if (userProfile.role === 'vendor') {
      chatsQuery = query(collection(db, 'chats'), or(where('vendorId', '==', userProfile.uid), where('customerId', '==', userProfile.uid)));
    } else if (userProfile.role === 'admin') {
      chatsQuery = query(collection(db, 'chats'), where('type', '==', 'support'));
    }

    let unsubscribeChats = () => {};
    if (chatsQuery) {
      unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
        let totalUnread = 0;
        snapshot.docs.forEach(doc => {
          const chat = doc.data();
          const count = chat.unreadCount?.[userProfile.role === 'admin' ? 'admin' : userProfile.uid] || 0;
          totalUnread += count;
        });
        
        setUnreadMessageCount(prev => {
          if (totalUnread > prev) {
            playNotificationSound();
          }
          return totalUnread;
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      });
    }

    return () => {
      unsubscribeNotifications();
      unsubscribeChats();
    };
  }, [userProfile]);

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      {loginError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <p className="text-sm text-red-600 font-medium">{loginError}</p>
            <button onClick={clearError} className="text-red-400 hover:text-red-500">
              <span className="sr-only">Dismiss</span>
              <Menu className="h-4 w-4 rotate-45" />
            </button>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <Store className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Online Mall</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {userProfile && (
              <>
                <Link to="/wishlist" className="p-2 text-gray-600 hover:text-red-500 transition-colors" title="Wishlist">
                  <Heart className="h-6 w-6" />
                </Link>
                <Link to="/following" className="p-2 text-gray-600 hover:text-indigo-600 transition-colors" title="Following">
                  <Users className="h-6 w-6" />
                </Link>
                <Link to="/messages" className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors" title="Messages">
                  <MessageSquare className="h-6 w-6" />
                  {unreadMessageCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                      {unreadMessageCount}
                    </span>
                  )}
                </Link>
                <Link to="/notifications" className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors" title="Notifications">
                  <Bell className="h-6 w-6" />
                  {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </>
            )}

            <Link to="/cart" className="relative p-2 text-gray-600 hover:text-indigo-600 transition-colors" title="Cart">
              <ShoppingCart className="h-6 w-6" />
              {cartItemsCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                  {cartItemsCount}
                </span>
              )}
            </Link>

            {userProfile ? (
              <div className="flex items-center space-x-4">
                {userProfile.role === 'admin' && (
                  <Link to="/admin" className="text-sm font-medium text-gray-700 hover:text-indigo-600">Admin</Link>
                )}
                {userProfile.role === 'vendor' && (
                  <Link to="/vendor" className="text-sm font-medium text-gray-700 hover:text-indigo-600">My Store</Link>
                )}
                {userProfile.role !== 'admin' && (
                  <button
                    onClick={() => switchRole(userProfile.role === 'vendor' ? 'customer' : 'vendor')}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Switch to {userProfile.role === 'vendor' ? 'Buyer' : 'Seller'}
                  </button>
                )}
                <Link to="/profile" className="flex items-center text-sm font-medium text-gray-700 hover:text-indigo-600">
                  <User className="h-5 w-5 mr-1" />
                  {userProfile.name}
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-red-600"
                >
                  <LogOut className="h-5 w-5 mr-1" />
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
