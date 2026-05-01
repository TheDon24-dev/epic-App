import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { Order, Coupon } from '../types';
import { Tag, X } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const Checkout = () => {
  const { cart, total, clearCart } = useCart();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupons, setAppliedCoupons] = useState<Record<string, Coupon>>({});
  const [couponError, setCouponError] = useState('');

  // Group items by storeId
  const itemsByStore = cart.reduce<Record<string, typeof cart>>((acc, item) => {
    if (!acc[item.storeId]) acc[item.storeId] = [];
    acc[item.storeId].push(item);
    return acc;
  }, {});

  const getStoreTotal = (storeId: string) => {
    return itemsByStore[storeId]?.reduce((sum, item) => sum + item.price * item.cartQuantity, 0) || 0;
  };

  const getDiscountForStore = (storeId: string) => {
    const coupon = appliedCoupons[storeId];
    if (!coupon) return 0;
    
    const storeTotal = getStoreTotal(storeId);
    if (storeTotal < coupon.minPurchase) return 0;

    if (coupon.type === 'percentage') {
      return storeTotal * (coupon.amount / 100);
    } else {
      return Math.min(storeTotal, coupon.amount);
    }
  };

  const finalTotal = Object.keys(itemsByStore).reduce((sum, storeId) => {
    return sum + getStoreTotal(storeId) - getDiscountForStore(storeId);
  }, 0);

  const handleApplyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim()) return;

    try {
      const q = query(collection(db, 'coupons'), where('code', '==', couponCode.toUpperCase()), where('active', '==', true));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setCouponError('Invalid or inactive coupon code.');
        return;
      }

      const coupon = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Coupon;
      
      // Check expiry
      const expiry = coupon.expiryDate?.toDate ? coupon.expiryDate.toDate() : new Date(coupon.expiryDate);
      if (expiry < new Date()) {
        setCouponError('This coupon has expired.');
        return;
      }

      // Check if store is in cart
      if (!itemsByStore[coupon.storeId]) {
        setCouponError('This coupon is not valid for any items in your cart.');
        return;
      }

      // Check min purchase
      const storeTotal = getStoreTotal(coupon.storeId);
      if (storeTotal < coupon.minPurchase) {
        setCouponError(`Minimum purchase of $${coupon.minPurchase.toFixed(2)} required for this store.`);
        return;
      }

      setAppliedCoupons(prev => ({ ...prev, [coupon.storeId]: coupon }));
      setCouponCode('');
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'coupons');
      setCouponError('Failed to apply coupon.');
    }
  };

  const removeCoupon = (storeId: string) => {
    setAppliedCoupons(prev => {
      const newCoupons = { ...prev };
      delete newCoupons[storeId];
      return newCoupons;
    });
  };

  const handleCheckout = async () => {
    if (!userProfile) return;
    setLoading(true);

    try {
      // Create an order for each store
      for (const [storeId, items] of Object.entries(itemsByStore)) {
        const storeItems = items as typeof cart;
        const storeTotal = getStoreTotal(storeId);
        const discount = getDiscountForStore(storeId);
        const finalStoreTotal = storeTotal - discount;
        
        const orderData: Omit<Order, 'id'> = {
          customerId: userProfile.uid,
          storeId,
          items: storeItems.map(item => ({
            productId: item.id!,
            name: item.name,
            price: item.price,
            quantity: item.cartQuantity
          })),
          total: finalStoreTotal,
          status: 'pending',
          payoutStatus: 'pending',
          createdAt: serverTimestamp()
        };

        // If you want to store the applied coupon in the order, you can add it to the Order type
        // orderData.couponCode = appliedCoupons[storeId]?.code;
        // orderData.discountAmount = discount;

        await addDoc(collection(db, 'orders'), orderData);
      }

      clearCart();
      navigate('/orders', { state: { success: true } });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-extrabold text-gradient tracking-tight mb-8 text-center">Checkout</h1>
      
      <div className="glass-panel shadow overflow-hidden sm:rounded-2xl mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-100">Order Summary</h3>
        </div>
        <div className="border-t border-white/10 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-white/10">
            {cart.map((item) => (
              <div key={item.id} className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-400">{item.name} (x{item.cartQuantity})</dt>
                <dd className="mt-1 text-sm text-gray-200 sm:mt-0 sm:col-span-2 text-right">${(item.price * item.cartQuantity).toFixed(2)}</dd>
              </div>
            ))}
            
            {Object.values(appliedCoupons).map((coupon: Coupon) => (
              <div key={coupon.id} className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-emerald-900/20">
                <dt className="text-sm font-medium text-emerald-400 flex items-center">
                  <Tag className="h-4 w-4 mr-2" />
                  Discount ({coupon.code})
                  <button onClick={() => removeCoupon(coupon.storeId)} className="ml-2 text-rose-400 hover:text-rose-300 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </dt>
                <dd className="mt-1 text-sm font-medium text-emerald-400 sm:mt-0 sm:col-span-2 text-right">
                  -${getDiscountForStore(coupon.storeId).toFixed(2)}
                </dd>
              </div>
            ))}

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-slate-900/50">
              <dt className="text-sm font-bold text-gray-100">Total</dt>
              <dd className="mt-1 text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-purple-400 sm:mt-0 sm:col-span-2 text-right">${finalTotal.toFixed(2)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="glass-panel shadow sm:rounded-2xl mb-8 p-6">
        <h3 className="text-lg font-medium text-gray-100 mb-4">Have a coupon?</h3>
        <div className="flex space-x-4">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Enter code"
            className="flex-1 block w-full border border-white/20 rounded-lg shadow-sm py-2 px-3 bg-slate-900/50 text-gray-200 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 sm:text-sm uppercase backdrop-blur-md"
          />
          <button
            onClick={handleApplyCoupon}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.3)] text-white bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-500 hover:to-rose-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-purple-500 transition-all"
          >
            Apply
          </button>
        </div>
        {couponError && <p className="mt-2 text-sm text-rose-400">{couponError}</p>}
      </div>

      <div className="flex justify-end mt-8">
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full max-w-md inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.3)] text-white bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-purple-500 disabled:opacity-50 transition-all"
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </div>
    </div>
  );
};
