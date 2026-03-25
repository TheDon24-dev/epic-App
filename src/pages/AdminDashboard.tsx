import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, updateDoc, doc, onSnapshot, deleteDoc, runTransaction, getDoc, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Store, User, Order, Coupon, Banner } from '../types';
import { Users, Store as StoreIcon, Activity, DollarSign, CheckCircle, XCircle, Tag, Trash2, Image as ImageIcon, TrendingUp, ShoppingBag, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { motion } from 'motion/react';

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

  const handleDeleteStore = async (storeId: string) => {
    if (window.confirm('Are you sure you want to delete this store? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'stores', storeId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `stores/${storeId}`);
      }
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

  // Prepare sales over time data
  const salesByDate = orders.reduce((acc, order) => {
    if (!order.createdAt) return acc;
    const date = order.createdAt.toDate().toLocaleDateString();
    if (!acc[date]) acc[date] = 0;
    acc[date] += order.total;
    return acc;
  }, {} as Record<string, number>);

  const timeChartData = Object.keys(salesByDate)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map(date => ({
      date,
      sales: salesByDate[date]
    }));

  return (
    <div className="min-h-screen bg-gray-50/50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage your marketplace performance and users.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-gray-600">Live System Status</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Active Stores', value: activeStores, icon: StoreIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Users', value: users.length, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <dt className="text-sm font-medium text-gray-500">{stat.label}</dt>
              <dd className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</dd>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Revenue Over Time</h2>
              <select className="text-sm border-gray-200 rounded-lg bg-gray-50 px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/20 outline-none">
                <option>Last 30 Days</option>
                <option>Last 7 Days</option>
              </select>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeChartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6">Sales by Store</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="sales" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">Store Approvals</h3>
              {pendingStores > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {pendingStores} pending
                </span>
              )}
            </div>
            <ul className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {stores.map(store => (
                <li key={store.id} className="px-6 py-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1 min-w-0">
                      {store.logoUrl ? (
                        <img src={store.logoUrl} alt={store.name} className="h-12 w-12 rounded-xl object-cover mr-4 border border-gray-100 shadow-sm" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center mr-4 border border-indigo-100">
                          <span className="text-sm font-bold text-indigo-600">{store.name.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-gray-900 truncate">{store.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{store.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex flex-col items-end mr-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comm. Rate</label>
                        <div className="flex items-center gap-1 mt-1">
                          <input 
                            type="number" 
                            className="w-12 text-xs font-bold border-none bg-gray-100 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500/20 outline-none" 
                            defaultValue={store.commissionRate ?? 10}
                            onBlur={(e) => handleUpdateCommissionRate(store.id!, parseFloat(e.target.value))}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider
                        ${store.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                          store.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                          'bg-rose-100 text-rose-700'}`}>
                        {store.status}
                      </span>
                      <div className="flex items-center gap-1">
                        {store.status === 'pending' && (
                          <button onClick={() => handleUpdateStoreStatus(store.id!, 'approved')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve Store">
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        {store.status !== 'suspended' && (
                          <button onClick={() => handleUpdateStoreStatus(store.id!, 'suspended')} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Suspend Store">
                            <XCircle className="h-5 w-5" />
                          </button>
                        )}
                        {store.status === 'suspended' && (
                          <button onClick={() => handleUpdateStoreStatus(store.id!, 'approved')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve Store">
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteStore(store.id!)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Store">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">User Management</h3>
            </div>
            <ul className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {users.map(user => {
                const isOnline = user.isOnline && user.lastSeen && (new Date().getTime() - user.lastSeen.toDate().getTime() < 5 * 60 * 1000);
                return (
                  <li key={user.uid} className="px-6 py-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 flex items-center">
                        <div className="relative">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                            <span className="text-sm font-bold text-gray-500">{user.name.charAt(0)}</span>
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                              user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              user.role === 'vendor' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {user.role === 'vendor' ? 'Seller' : user.role === 'customer' ? 'Buyer' : user.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.uid, e.target.value as User['role'])}
                          className="text-xs font-bold border-none bg-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none"
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
