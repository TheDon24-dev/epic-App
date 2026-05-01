import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Order, Store } from '../types';
import { Link } from 'react-router-dom';
import { Store as StoreIcon } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const Orders = () => {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Record<string, Store>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) return;

    const fetchStores = async () => {
      try {
        const storesQuery = query(collection(db, 'stores'), where('status', '==', 'approved'));
        const storesSnapshot = await getDocs(storesQuery);
        const storesData: Record<string, Store> = {};
        storesSnapshot.docs.forEach(doc => {
          storesData[doc.id] = { id: doc.id, ...doc.data() } as Store;
        });
        setStores(storesData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'stores');
      }
    };

    fetchStores();

    const ordersQuery = query(collection(db, 'orders'), where('customerId', '==', userProfile.uid));
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      // Sort by date descending
      ordersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return unsubscribe;
  }, [userProfile]);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-extrabold text-gradient tracking-tight mb-8">My Orders</h1>
      
      {orders.length === 0 ? (
        <div className="text-center py-12 glass-panel rounded-2xl">
          <p className="text-gray-400 text-lg">You haven't placed any orders yet.</p>
          <Link to="/" className="mt-4 inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.3)] text-white bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 transition-all">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order.id} className="glass-card overflow-hidden sm:rounded-2xl">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-slate-900/50 border-b border-white/10">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-100">
                    Order #{order.id?.slice(-6).toUpperCase()}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-400">
                    Placed on {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize backdrop-blur-md border
                    ${order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 
                      order.status === 'cancelled' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 
                      order.status === 'shipped' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 
                      'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center mb-4">
                  {stores[order.storeId]?.logoUrl ? (
                    <img src={stores[order.storeId].logoUrl} alt={stores[order.storeId].name} className="h-8 w-8 rounded-full object-cover mr-3 border border-white/10" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-800/50 flex items-center justify-center mr-3 border border-white/10">
                      <StoreIcon className="h-4 w-4 text-sky-400" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-200">Store: <span className="text-sky-400">{stores[order.storeId]?.name || 'Unknown Store'}</span></p>
                </div>
                <ul className="divide-y divide-white/10">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="py-4 flex justify-between">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-200">{item.name}</span>
                        <span className="ml-2 text-sm text-gray-500">x{item.quantity}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-200">${(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-t border-white/10 pt-4 flex justify-between">
                  <span className="text-base font-bold text-gray-100">Total</span>
                  <span className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-purple-400">${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
