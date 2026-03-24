import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, updateDoc, doc, onSnapshot, deleteDoc, runTransaction, getDoc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Store, User, Order, Coupon, Banner } from '../types';
import { Users, Store as StoreIcon, Activity, DollarSign, CheckCircle, XCircle, Tag, Trash2, Image as ImageIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const AdminDashboard = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [newBanner, setNewBanner] = useState({ imageUrl: '', link: '', order: 0, active: true });
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.role !== 'admin') return;

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubscribeStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'stores'));

    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    const unsubscribeCoupons = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'coupons'));

    const unsubscribePayouts = onSnapshot(collection(db, 'payouts'), (snapshot) => {
      setPayouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'payouts'));

    const unsubscribeBanners = onSnapshot(collection(db, 'banners'), (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'banners'));

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings({ id: snapshot.id, ...snapshot.data() });
      } else {
        // Initialize settings if they don't exist
        setSettings({ siteName: 'Multi-Vendor Marketplace', supportEmail: 'support@example.com', maintenanceMode: false });
      }
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/global'));

    return () => {
      unsubscribeUsers();
      unsubscribeStores();
      unsubscribeOrders();
      unsubscribeCoupons();
      unsubscribePayouts();
      unsubscribeBanners();
      unsubscribeSettings();
    };
  }, [userProfile]);

  const handleUpdateStoreStatus = async (storeId: string, status: Store['status']) => {
    try {
      await updateDoc(doc(db, 'stores', storeId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${storeId}`);
    }
  };

  const handleUpdateCommissionRate = async (storeId: string, rate: number) => {
    try {
      await updateDoc(doc(db, 'stores', storeId), { commissionRate: rate });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${storeId}`);
    }
  };

  const handleUpdatePayoutStatus = async (payoutId: string, status: string) => {
    try {
      let payoutVendorId = '';
      if (status === 'rejected') {
        await runTransaction(db, async (transaction) => {
          const payoutRef = doc(db, 'payouts', payoutId);
          const payoutDoc = await transaction.get(payoutRef);
          
          if (!payoutDoc.exists()) throw new Error("Payout does not exist!");
          
          const payoutData = payoutDoc.data();
          if (payoutData.status === 'rejected') return; // Already rejected
          payoutVendorId = payoutData.vendorId;

          const storeRef = doc(db, 'stores', payoutData.storeId);
          const storeDoc = await transaction.get(storeRef);
          
          if (!storeDoc.exists()) throw new Error("Store does not exist!");
          
          const storeData = storeDoc.data() as Store;
          const newBalance = (storeData.balance || 0) + payoutData.amount;

          transaction.update(storeRef, { balance: newBalance });
          transaction.update(payoutRef, { status, processedAt: new Date() });

          // Create transaction record for refund
          const transactionRef = doc(collection(db, 'transactions'));
          transaction.set(transactionRef, {
            storeId: storeData.id || payoutData.storeId,
            vendorId: payoutData.vendorId,
            payoutId: payoutId,
            type: 'earning', // Refund is an earning
            amount: payoutData.amount,
            description: `Refund for rejected payout request`,
            createdAt: new Date()
          });
        });
      } else {
        const payoutDoc = await getDoc(doc(db, 'payouts', payoutId));
        if (payoutDoc.exists()) {
          payoutVendorId = payoutDoc.data().vendorId;
        }
        await updateDoc(doc(db, 'payouts', payoutId), { 
          status, 
          processedAt: status === 'completed' ? new Date() : null 
        });
      }

      if (payoutVendorId) {
        await addDoc(collection(db, 'notifications'), {
          customerId: payoutVendorId,
          title: 'Payout Status Updated',
          message: `Your payout request status has been updated to ${status}.`,
          read: false,
          link: '/vendor',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payouts/${payoutId}`);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: User['role']) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      try {
        await deleteDoc(doc(db, 'coupons', couponId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `coupons/${couponId}`);
      }
    }
  };

  const toggleCouponStatus = async (coupon: Coupon) => {
    try {
      await updateDoc(doc(db, 'coupons', coupon.id!), { active: !coupon.active });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `coupons/${coupon.id}`);
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'banners'), {
        ...newBanner,
        createdAt: serverTimestamp()
      });
      setNewBanner({ imageUrl: '', link: '', order: 0, active: true });
      setIsAddingBanner(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'banners');
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (window.confirm('Are you sure you want to delete this banner?')) {
      try {
        await deleteDoc(doc(db, 'banners', bannerId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `banners/${bannerId}`);
      }
    }
  };

  const toggleBannerStatus = async (banner: Banner) => {
    try {
      await updateDoc(doc(db, 'banners', banner.id!), { active: !banner.active });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `banners/${banner.id}`);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const settingsRef = doc(db, 'settings', 'global');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        await updateDoc(settingsRef, {
          ...settings,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(settingsRef, {
          ...settings,
          updatedAt: serverTimestamp()
        });
      }
      alert('Settings updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  if (userProfile?.role !== 'admin') {
    return <div className="text-center py-12 text-red-600">Access Denied. Admin privileges required.</div>;
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const activeStores = stores.filter(s => s.status === 'approved').length;
  const pendingStores = stores.filter(s => s.status === 'pending').length;

  // Prepare chart data (sales by store)
  const salesByStore = orders.reduce((acc, order) => {
    const store = stores.find(s => s.id === order.storeId);
    const storeName = store ? store.name : 'Unknown';
    if (!acc[storeName]) acc[storeName] = 0;
    acc[storeName] += order.total;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.keys(salesByStore).map(name => ({
    name,
    sales: salesByStore[name]
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900">${totalRevenue.toFixed(2)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <StoreIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Stores</dt>
                  <dd className="text-lg font-medium text-gray-900">{activeStores}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                  <dd className="text-lg font-medium text-gray-900">{users.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Orders</dt>
                  <dd className="text-lg font-medium text-gray-900">{orders.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Sales by Store</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sales" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Store Approvals</h3>
            {pendingStores > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {pendingStores} pending
              </span>
            )}
          </div>
          <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {stores.map(store => (
              <li key={store.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    {store.logoUrl ? (
                      <img src={store.logoUrl} alt={store.name} className="h-10 w-10 rounded-full object-cover mr-4 border border-gray-200" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4 border border-gray-200">
                        <span className="text-sm font-medium text-indigo-600">{store.name.charAt(0)}</span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-indigo-600 truncate">{store.name}</p>
                      <p className="text-sm text-gray-500 truncate">{store.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <label className="text-xs text-gray-500 mr-2">Comm. Rate (%)</label>
                      <input 
                        type="number" 
                        className="w-16 text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                        defaultValue={store.commissionRate ?? 10}
                        onBlur={(e) => handleUpdateCommissionRate(store.id!, parseFloat(e.target.value))}
                      />
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${store.status === 'approved' ? 'bg-green-100 text-green-800' : 
                        store.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'}`}>
                      {store.status}
                    </span>
                    {store.status === 'pending' && (
                      <button onClick={() => handleUpdateStoreStatus(store.id!, 'approved')} className="text-green-600 hover:text-green-900">
                        <CheckCircle className="h-5 w-5" />
                      </button>
                    )}
                    {store.status !== 'suspended' && (
                      <button onClick={() => handleUpdateStoreStatus(store.id!, 'suspended')} className="text-red-600 hover:text-red-900">
                        <XCircle className="h-5 w-5" />
                      </button>
                    )}
                    {store.status === 'suspended' && (
                      <button onClick={() => handleUpdateStoreStatus(store.id!, 'approved')} className="text-green-600 hover:text-green-900">
                        <CheckCircle className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">User Management</h3>
          </div>
          <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {users.map(user => {
              const isOnline = user.isOnline && user.lastSeen && (new Date().getTime() - user.lastSeen.toDate().getTime() < 5 * 60 * 1000);
              return (
                <li key={user.uid} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 flex items-center">
                      <div className={`h-3 w-3 rounded-full mr-3 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} title={isOnline ? 'Online' : 'Offline'} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate flex items-center">
                          {user.name}
                          <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            {user.role === 'vendor' ? 'Seller' : user.role === 'customer' ? 'Buyer' : user.role}
                          </span>
                        </p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateUserRole(user.uid, e.target.value as User['role'])}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      >
                        <option value="customer">Customer</option>
                        <option value="vendor">Vendor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
            <Tag className="mr-2 h-5 w-5 text-gray-400" />
            All Coupons
          </h3>
        </div>
        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {coupons.map(coupon => {
            const store = stores.find(s => s.id === coupon.storeId);
            return (
              <li key={coupon.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-indigo-600 truncate mr-2">{coupon.code}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${coupon.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {coupon.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      Store: {store ? store.name : 'Unknown Store'} | 
                      Discount: {coupon.type === 'percentage' ? `${coupon.amount}%` : `$${coupon.amount.toFixed(2)}`} | 
                      Min Purchase: ${coupon.minPurchase.toFixed(2)} | 
                      Expires: {new Date(coupon.expiryDate?.toDate ? coupon.expiryDate.toDate() : coupon.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => toggleCouponStatus(coupon)} 
                      className={`px-3 py-1 rounded-md text-sm font-medium ${coupon.active ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                    >
                      {coupon.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDeleteCoupon(coupon.id!)} className="p-2 text-red-600 hover:bg-red-50 rounded-full">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {coupons.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">No coupons found.</li>
          )}
        </ul>
      </div>
      <div className="bg-white shadow overflow-hidden sm:rounded-md mt-8">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Payout Requests</h3>
        </div>
        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {payouts.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()).map(payout => {
            const store = stores.find(s => s.id === payout.storeId);
            return (
              <li key={payout.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-indigo-600 truncate">
                        {store ? store.name : 'Unknown Store'}
                      </p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${payout.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          payout.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          payout.status === 'processing' ? 'bg-blue-100 text-blue-800' : 
                          'bg-red-100 text-red-800'}`}>
                        {payout.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      Amount: ${payout.amount.toFixed(2)} | Method: {payout.method} | Details: {payout.details}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Requested: {new Date(payout.createdAt?.toDate ? payout.createdAt.toDate() : payout.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    {payout.status === 'pending' && (
                      <button onClick={() => handleUpdatePayoutStatus(payout.id!, 'processing')} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200">
                        Process
                      </button>
                    )}
                    {payout.status === 'processing' && (
                      <button onClick={() => handleUpdatePayoutStatus(payout.id!, 'completed')} className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm font-medium hover:bg-green-200">
                        Complete
                      </button>
                    )}
                    {(payout.status === 'pending' || payout.status === 'processing') && (
                      <button onClick={() => handleUpdatePayoutStatus(payout.id!, 'rejected')} className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200">
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {payouts.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">No payout requests found.</li>
          )}
        </ul>
      </div>
      <div className="bg-white shadow overflow-hidden sm:rounded-md mt-8">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
            <ImageIcon className="mr-2 h-5 w-5 text-gray-400" />
            Banner Management
          </h3>
          <button
            onClick={() => setIsAddingBanner(!isAddingBanner)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
          >
            {isAddingBanner ? 'Cancel' : 'Add Banner'}
          </button>
        </div>
        
        {isAddingBanner && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <form onSubmit={handleAddBanner} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Image URL</label>
                <input
                  type="url"
                  required
                  value={newBanner.imageUrl}
                  onChange={(e) => setNewBanner({ ...newBanner, imageUrl: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Link URL (Optional)</label>
                <input
                  type="url"
                  value={newBanner.link}
                  onChange={(e) => setNewBanner({ ...newBanner, link: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://example.com/promo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Display Order</label>
                <input
                  type="number"
                  required
                  value={newBanner.order}
                  onChange={(e) => setNewBanner({ ...newBanner, order: parseInt(e.target.value) })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={newBanner.active}
                  onChange={(e) => setNewBanner({ ...newBanner, active: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Save Banner
              </button>
            </form>
          </div>
        )}

        <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {banners.sort((a, b) => a.order - b.order).map(banner => (
            <li key={banner.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  <img src={banner.imageUrl} alt="Banner" className="h-16 w-32 object-cover rounded-md mr-4 border border-gray-200" referrerPolicy="no-referrer" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Order: {banner.order}</p>
                    {banner.link && <p className="text-sm text-indigo-600 truncate">{banner.link}</p>}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${banner.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {banner.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => toggleBannerStatus(banner)} 
                    className={`px-3 py-1 rounded-md text-sm font-medium ${banner.active ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                  >
                    {banner.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleDeleteBanner(banner.id!)} className="p-2 text-red-600 hover:bg-red-50 rounded-full">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {banners.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">No banners found.</li>
          )}
        </ul>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md mt-8">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
            <Activity className="mr-2 h-5 w-5 text-gray-400" />
            Platform Settings
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Site Name</label>
                <input
                  type="text"
                  required
                  value={settings?.siteName || ''}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Support Email</label>
                <input
                  type="email"
                  required
                  value={settings?.supportEmail || ''}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="maintenanceMode"
                checked={settings?.maintenanceMode || false}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="maintenanceMode" className="ml-2 block text-sm text-gray-900">
                Maintenance Mode (Disable customer access)
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
};
