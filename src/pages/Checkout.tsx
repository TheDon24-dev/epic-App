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
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8 text-center">Checkout</h1>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Order Summary</h3>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            {cart.map((item) => (
              <div key={item.id} className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">{item.name} (x{item.cartQuantity})</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 text-right">${(item.price * item.cartQuantity).toFixed(2)}</dd>
              </div>
            ))}
            
            {Object.values(appliedCoupons).map((coupon: Coupon) => (
              <div key={coupon.id} className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-green-50">
                <dt className="text-sm font-medium text-green-800 flex items-center">
                  <Tag className="h-4 w-4 mr-2" />
                  Discount ({coupon.code})
                  <button onClick={() => removeCoupon(coupon.storeId)} className="ml-2 text-red-500 hover:text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                </dt>
                <dd className="mt-1 text-sm font-medium text-green-800 sm:mt-0 sm:col-span-2 text-right">
                  -${getDiscountForStore(coupon.storeId).toFixed(2)}
                </dd>
              </div>
            ))}

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50">
              <dt className="text-sm font-bold text-gray-900">Total</dt>
              <dd className="mt-1 text-sm font-bold text-gray-900 sm:mt-0 sm:col-span-2 text-right">${finalTotal.toFixed(2)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg mb-8 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Have a coupon?</h3>
        <div className="flex space-x-4">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Enter code"
            className="flex-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm uppercase"
          />
          <button
            onClick={handleApplyCoupon}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
          >
            Apply
          </button>
        </div>
        {couponError && <p className="mt-2 text-sm text-red-600">{couponError}</p>}
      </div>

      <div className="flex justify-end mt-8">
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full max-w-md inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </div>
    </div>
  );
};
