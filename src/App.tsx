import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { ProductDetails } from './pages/ProductDetails';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Orders } from './pages/Orders';
import { VendorDashboard } from './pages/VendorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { Chat } from './pages/Chat';
import { Messages } from './pages/Messages';
import Wishlist from './pages/Wishlist';
import Following from './pages/Following';
import StorePage from './pages/StorePage';
import { Notifications } from './pages/Notifications';
import { RoleSelection } from './components/RoleSelection';
import { Profile } from './pages/Profile';
import { Maintenance } from './pages/Maintenance';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const AppContent = () => {
  const { userProfile, currentUser, loading: authLoading } = useAuth();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [supportEmail, setSupportEmail] = useState('support@example.com');
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMaintenanceMode(data.maintenanceMode);
        setSupportEmail(data.supportEmail || 'support@example.com');
      }
      setSettingsLoading(false);
    }, (error) => {
      console.error("Error fetching settings:", error);
      setSettingsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen cinematic-bg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mb-4"></div>
          <p className="text-sky-200 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Redirect to maintenance page if enabled and user is not an admin
  if (maintenanceMode && userProfile?.role !== 'admin') {
    return <Maintenance supportEmail={supportEmail} />;
  }

  console.log("AppContent render:", { authLoading, settingsLoading, currentUser: currentUser?.email, role: userProfile?.role });

  return (
    <Router>
      <div className="min-h-screen cinematic-bg flex flex-col">
        {userProfile?.role === 'pending' && <RoleSelection />}
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products/:id" element={<ProductDetails />} />
            <Route path="/stores/:id" element={<StorePage />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/vendor" element={<VendorDashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/chat/:storeId" element={<Chat />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/following" element={<Following />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
