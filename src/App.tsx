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

const AppContent = () => {
  const { userProfile } = useAuth();
  
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
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
