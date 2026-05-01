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
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-sky"></div></div>;
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
    <div className="min-h-screen cinematic-bg py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight text-gradient">Admin Dashboard</h1>
            <p className="text-gray-400 mt-1">Manage your marketplace performance and users.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 glass-panel rounded-xl flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <span className="text-sm font-medium text-gray-300">Live System Status</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/20' },
            { label: 'Active Stores', value: activeStores, icon: StoreIcon, color: 'text-blue-400', bg: 'bg-blue-500/20' },
            { label: 'Total Users', value: users.length, icon: Users, color: 'text-brand-purple', bg: 'bg-brand-purple/20' },
            { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'text-orange-400', bg: 'bg-orange-500/20' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-6 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bg} border border-white/5`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <TrendingUp className="h-4 w-4 text-green-400" />
              </div>
              <dt className="text-sm font-medium text-gray-400">{stat.label}</dt>
              <dd className="text-2xl font-bold text-white mt-1">{stat.value}</dd>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Revenue Over Time</h2>
              <select className="text-sm border-white/10 rounded-lg bg-white/5 text-white px-3 py-1.5 focus:ring-2 focus:ring-brand-sky/20 outline-none [&>option]:bg-gray-900">
                <option>Last 30 Days</option>
                <option>Last 7 Days</option>
              </select>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeChartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
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
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.9)', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-white mb-6">Sales by Store</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,23,42,0.9)', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="sales" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-lg font-bold text-white">Store Approvals</h3>
              {pendingStores > 0 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {pendingStores} pending
                </span>
              )}
            </div>
            <ul className="divide-y divide-white/10 max-h-[500px] overflow-y-auto custom-scrollbar">
              {stores.map(store => (
                <li key={store.id} className="px-6 py-5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1 min-w-0">
                      {store.logoUrl ? (
                        <img src={store.logoUrl} alt={store.name} className="h-12 w-12 rounded-xl object-cover mr-4 border border-white/10 shadow-sm" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mr-4 border border-white/10">
                          <span className="text-sm font-bold text-brand-sky">{store.name.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-white truncate">{store.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{store.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex flex-col items-end mr-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Comm. Rate</label>
                        <div className="flex items-center gap-1 mt-1">
                          <input 
                            type="number" 
                            className="w-12 text-xs font-bold border border-white/10 bg-white/5 text-white rounded-lg px-2 py-1 focus:ring-2 focus:ring-brand-sky/50 outline-none" 
                            defaultValue={store.commissionRate ?? 10}
                            onBlur={(e) => handleUpdateCommissionRate(store.id!, parseFloat(e.target.value))}
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border
                        ${store.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 
                          store.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 
                          'bg-rose-500/20 text-rose-300 border-rose-500/30'}`}>
                        {store.status}
                      </span>
                      <div className="flex items-center gap-1">
                        {store.status === 'pending' && (
                          <button onClick={() => handleUpdateStoreStatus(store.id!, 'approved')} className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors" title="Approve Store">
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        {store.status !== 'suspended' && (
                          <button onClick={() => handleUpdateStoreStatus(store.id!, 'suspended')} className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors" title="Suspend Store">
                            <XCircle className="h-5 w-5" />
                          </button>
                        )}
                        {store.status === 'suspended' && (
                          <button onClick={() => handleUpdateStoreStatus(store.id!, 'approved')} className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors" title="Approve Store">
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteStore(store.id!)} className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors" title="Delete Store">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 bg-white/5">
              <h3 className="text-lg font-bold text-white">User Management</h3>
            </div>
            <ul className="divide-y divide-white/10 max-h-[500px] overflow-y-auto custom-scrollbar">
              {users.map(user => {
                const isOnline = user.isOnline && user.lastSeen && (new Date().getTime() - user.lastSeen.toDate().getTime() < 5 * 60 * 1000);
                return (
                  <li key={user.uid} className="px-6 py-5 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 flex items-center">
                        <div className="relative">
                          <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                            <span className="text-sm font-bold text-gray-400">{user.name.charAt(0)}</span>
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#030014] ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate">{user.name}</p>
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md border backdrop-blur-md ${
                              user.role === 'admin' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                              user.role === 'vendor' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                              'bg-gray-500/20 text-gray-300 border-gray-500/30'
                            }`}>
                              {user.role === 'vendor' ? 'Seller' : user.role === 'customer' ? 'Buyer' : user.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.uid, e.target.value as User['role'])}
                          className="text-xs font-bold border border-white/10 bg-white/5 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-sky/50 outline-none [&>option]:bg-gray-900"
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

      <div className="mt-8 glass-panel overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 border-b border-white/10 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-white flex items-center">
            <Tag className="mr-2 h-5 w-5 text-gray-400" />
            All Coupons
          </h3>
        </div>
        <ul className="divide-y divide-white/10 max-h-96 overflow-y-auto custom-scrollbar">
          {coupons.map(coupon => {
            const store = stores.find(s => s.id === coupon.storeId);
            return (
              <li key={coupon.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-brand-sky truncate mr-2">{coupon.code}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium backdrop-blur-md border ${coupon.active ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                        {coupon.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 truncate mt-1">
                      Store: {store ? store.name : 'Unknown Store'} | 
                      Discount: {coupon.type === 'percentage' ? `${coupon.amount}%` : `$${coupon.amount.toFixed(2)}`} | 
                      Min Purchase: ${coupon.minPurchase.toFixed(2)} | 
                      Expires: {new Date(coupon.expiryDate?.toDate ? coupon.expiryDate.toDate() : coupon.expiryDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => toggleCouponStatus(coupon)} 
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${coupon.active ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'}`}
                    >
                      {coupon.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDeleteCoupon(coupon.id!)} className="p-2 text-brand-red hover:bg-brand-red/20 rounded-full transition-colors">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {coupons.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-400">No coupons found.</li>
          )}
        </ul>
      </div>
      <div className="glass-panel overflow-hidden sm:rounded-md mt-8">
        <div className="px-4 py-5 border-b border-white/10 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-white">Payout Requests</h3>
        </div>
        <ul className="divide-y divide-white/10 max-h-96 overflow-y-auto custom-scrollbar">
          {payouts.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()).map(payout => {
            const store = stores.find(s => s.id === payout.storeId);
            return (
              <li key={payout.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-brand-sky truncate">
                        {store ? store.name : 'Unknown Store'}
                      </p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize backdrop-blur-md border
                        ${payout.status === 'completed' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 
                          payout.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 
                          payout.status === 'processing' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 
                          'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                        {payout.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 truncate mt-1">
                      Amount: ${payout.amount.toFixed(2)} | Method: {payout.method} | Details: {payout.details}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Requested: {new Date(payout.createdAt?.toDate ? payout.createdAt.toDate() : payout.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    {payout.status === 'pending' && (
                      <button onClick={() => handleUpdatePayoutStatus(payout.id!, 'processing')} className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md text-sm font-medium hover:bg-blue-500/30 transition-colors">
                        Process
                      </button>
                    )}
                    {payout.status === 'processing' && (
                      <button onClick={() => handleUpdatePayoutStatus(payout.id!, 'completed')} className="px-3 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-md text-sm font-medium hover:bg-green-500/30 transition-colors">
                        Complete
                      </button>
                    )}
                    {(payout.status === 'pending' || payout.status === 'processing') && (
                      <button onClick={() => handleUpdatePayoutStatus(payout.id!, 'rejected')} className="px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-md text-sm font-medium hover:bg-red-500/30 transition-colors">
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {payouts.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-400">No payout requests found.</li>
          )}
        </ul>
      </div>
      <div className="glass-panel overflow-hidden sm:rounded-md mt-8">
        <div className="px-4 py-5 border-b border-white/10 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-white flex items-center">
            <ImageIcon className="mr-2 h-5 w-5 text-gray-400" />
            Banner Management
          </h3>
          <button
            onClick={() => setIsAddingBanner(!isAddingBanner)}
            className="px-4 py-2 bg-gradient-to-r from-brand-sky to-brand-purple text-white rounded-md text-sm font-medium hover:opacity-90 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all"
          >
            {isAddingBanner ? 'Cancel' : 'Add Banner'}
          </button>
        </div>
        
        {isAddingBanner && (
          <div className="p-6 border-b border-white/10 bg-white/5">
            <form onSubmit={handleAddBanner} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Image URL</label>
                <input
                  type="url"
                  required
                  value={newBanner.imageUrl}
                  onChange={(e) => setNewBanner({ ...newBanner, imageUrl: e.target.value })}
                  className="mt-1 block w-full bg-white/5 border border-white/10 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-sky focus:border-brand-sky sm:text-sm placeholder-gray-500"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Link URL (Optional)</label>
                <input
                  type="url"
                  value={newBanner.link}
                  onChange={(e) => setNewBanner({ ...newBanner, link: e.target.value })}
                  className="mt-1 block w-full bg-white/5 border border-white/10 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-sky focus:border-brand-sky sm:text-sm placeholder-gray-500"
                  placeholder="https://example.com/promo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Display Order</label>
                <input
                  type="number"
                  required
                  value={newBanner.order}
                  onChange={(e) => setNewBanner({ ...newBanner, order: parseInt(e.target.value) })}
                  className="mt-1 block w-full bg-white/5 border border-white/10 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-sky focus:border-brand-sky sm:text-sm"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  checked={newBanner.active}
                  onChange={(e) => setNewBanner({ ...newBanner, active: e.target.checked })}
                  className="h-4 w-4 text-brand-sky focus:ring-brand-sky border-white/10 bg-white/5 rounded"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-300">
                  Active
                </label>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-[0_0_15px_rgba(168,85,247,0.3)] text-sm font-medium text-white bg-gradient-to-r from-brand-sky to-brand-purple hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-sky transition-all"
              >
                Save Banner
              </button>
            </form>
          </div>
        )}

        <ul className="divide-y divide-white/10 max-h-96 overflow-y-auto custom-scrollbar">
          {banners.sort((a, b) => a.order - b.order).map(banner => (
            <li key={banner.id} className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                  <img src={banner.imageUrl} alt="Banner" className="h-16 w-32 object-cover rounded-md mr-4 border border-white/10" referrerPolicy="no-referrer" />
                  <div>
                    <p className="text-sm font-medium text-white">Order: {banner.order}</p>
                    {banner.link && <p className="text-sm text-brand-sky truncate">{banner.link}</p>}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 backdrop-blur-md border ${banner.active ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                      {banner.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => toggleBannerStatus(banner)} 
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${banner.active ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'}`}
                  >
                    {banner.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => handleDeleteBanner(banner.id!)} className="p-2 text-brand-red hover:bg-brand-red/20 rounded-full transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {banners.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-400">No banners found.</li>
          )}
        </ul>
      </div>

      <div className="glass-panel overflow-hidden sm:rounded-md mt-8">
        <div className="px-4 py-5 border-b border-white/10 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-white flex items-center">
            <Activity className="mr-2 h-5 w-5 text-gray-400" />
            Platform Settings
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300">Site Name</label>
                <input
                  type="text"
                  required
                  value={settings?.siteName || ''}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                  className="mt-1 block w-full bg-white/5 border border-white/10 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-sky focus:border-brand-sky sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Support Email</label>
                <input
                  type="email"
                  required
                  value={settings?.supportEmail || ''}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="mt-1 block w-full bg-white/5 border border-white/10 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-brand-sky focus:border-brand-sky sm:text-sm"
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="maintenanceMode"
                checked={settings?.maintenanceMode || false}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                className="h-4 w-4 text-brand-sky focus:ring-brand-sky border-white/10 bg-white/5 rounded"
              />
              <label htmlFor="maintenanceMode" className="ml-2 block text-sm text-gray-300">
                Maintenance Mode (Disable customer access)
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-[0_0_15px_rgba(168,85,247,0.3)] text-sm font-medium rounded-md text-white bg-gradient-to-r from-brand-sky to-brand-purple hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-sky transition-all"
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
