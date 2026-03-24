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
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">My Orders</h1>
      
      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">You haven't placed any orders yet.</p>
          <Link to="/" className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order.id} className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center bg-gray-50 border-b border-gray-200">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Order #{order.id?.slice(-6).toUpperCase()}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Placed on {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize
                    ${order.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                      order.status === 'shipped' ? 'bg-blue-100 text-blue-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center mb-4">
                  {stores[order.storeId]?.logoUrl ? (
                    <img src={stores[order.storeId].logoUrl} alt={stores[order.storeId].name} className="h-8 w-8 rounded-full object-cover mr-3 border border-gray-200" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 border border-gray-200">
                      <StoreIcon className="h-4 w-4 text-indigo-600" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-900">Store: {stores[order.storeId]?.name || 'Unknown Store'}</p>
                </div>
                <ul className="divide-y divide-gray-200">
                  {order.items.map((item, idx) => (
                    <li key={idx} className="py-4 flex justify-between">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        <span className="ml-2 text-sm text-gray-500">x{item.quantity}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 border-t border-gray-200 pt-4 flex justify-between">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-base font-bold text-gray-900">${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
