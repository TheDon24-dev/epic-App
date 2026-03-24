import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot, deleteDoc, runTransaction, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Store, Product, Order, Coupon } from '../types';
import { Package, ShoppingBag, Plus, Edit, Trash2, Store as StoreIcon, Tag, Settings, Image as ImageIcon, DollarSign, Clock } from 'lucide-react';
import { compressImage } from '../utils/imageUpload';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const VendorDashboard = () => {
  const { userProfile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'coupons' | 'payouts' | 'settings'>('products');

  // Form states
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '', description: '', price: 0, category: '', inventory: 0, imageUrl: ''
  });
  
  const [storeForm, setStoreForm] = useState<Partial<Store>>({});
  const [isUpdatingStore, setIsUpdatingStore] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
    code: '', type: 'percentage', amount: 0, expiryDate: '', minPurchase: 0, active: true
  });
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ amount: 0, method: 'bank_transfer', details: '' });

  useEffect(() => {
    if (!userProfile) return;

    const fetchStoreData = async () => {
      try {
        const storeQuery = query(collection(db, 'stores'), where('vendorId', '==', userProfile.uid));
        const storeSnapshot = await getDocs(storeQuery);
        
        if (!storeSnapshot.empty) {
          const storeData = { id: storeSnapshot.docs[0].id, ...storeSnapshot.docs[0].data() } as Store;
          setStore(storeData);
          setStoreForm(storeData);

          // Listen to products
          const productsQuery = query(collection(db, 'products'), where('storeId', '==', storeData.id));
          onSnapshot(productsQuery, (snapshot) => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
          }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

          // Listen to orders
          const ordersQuery = query(collection(db, 'orders'), where('storeId', '==', storeData.id));
          onSnapshot(ordersQuery, (snapshot) => {
            setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
          }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

          // Listen to coupons
          const couponsQuery = query(collection(db, 'coupons'), where('storeId', '==', storeData.id));
          onSnapshot(couponsQuery, (snapshot) => {
            setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon)));
          }, (error) => handleFirestoreError(error, OperationType.LIST, 'coupons'));

          // Listen to payouts
          const payoutsQuery = query(collection(db, 'payouts'), where('vendorId', '==', userProfile.uid));
          onSnapshot(payoutsQuery, (snapshot) => {
            setPayouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }, (error) => handleFirestoreError(error, OperationType.LIST, 'payouts'));

          // Listen to transactions
          const transactionsQuery = query(collection(db, 'transactions'), where('vendorId', '==', userProfile.uid));
          onSnapshot(transactionsQuery, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'stores');
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [userProfile]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const newStore: Omit<Store, 'id'> = {
      vendorId: userProfile.uid,
      name: 'My New Store',
      description: 'A great new store',
      category: 'General',
      status: 'pending',
      createdAt: new Date()
    };

    try {
      const docRef = await addDoc(collection(db, 'stores'), newStore);
      const createdStore = { id: docRef.id, ...newStore };
      setStore(createdStore);
      setStoreForm(createdStore);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stores');
    }
  };

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !store.id) return;
    
    setIsUpdatingStore(true);
    try {
      const updateData: any = {
        name: storeForm.name,
        description: storeForm.description,
        category: storeForm.category,
      };
      
      if (storeForm.logoUrl) updateData.logoUrl = storeForm.logoUrl;
      if (storeForm.bannerUrl) updateData.bannerUrl = storeForm.bannerUrl;

      await updateDoc(doc(db, 'stores', store.id), updateData);
      setStore({ ...store, ...updateData });
      alert('Store updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${store.id}`);
    } finally {
      setIsUpdatingStore(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logoUrl' | 'bannerUrl' | 'productImageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Image = await compressImage(file, 800, 800, 0.7);
      if (field === 'productImageUrl') {
        setNewProduct({ ...newProduct, imageUrl: base64Image });
      } else {
        setStoreForm({ ...storeForm, [field]: base64Image });
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      alert('Failed to process image.');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;

    const productData: Omit<Product, 'id'> = {
      storeId: store.id!,
      name: newProduct.name || '',
      description: newProduct.description || '',
      price: Number(newProduct.price) || 0,
      category: newProduct.category || '',
      inventory: Number(newProduct.inventory) || 0,
      imageUrl: newProduct.imageUrl || '',
      createdAt: new Date()
    };

    try {
      const docRef = await addDoc(collection(db, 'products'), productData);
      setIsAddingProduct(false);
      setNewProduct({ name: '', description: '', price: 0, category: '', inventory: 0, imageUrl: '' });

      // Notify followers
      try {
        const followsQuery = query(collection(db, 'follows'), where('storeId', '==', store.id));
        const followsSnapshot = await getDocs(followsQuery);
        
        const notificationPromises = followsSnapshot.docs.map(doc => {
          const followData = doc.data();
          return addDoc(collection(db, 'notifications'), {
            customerId: followData.customerId,
            title: `New Product from ${store.name}`,
            message: `${store.name} just added a new product: ${productData.name}. Check it out!`,
            read: false,
            link: `/product/${docRef.id}`,
            createdAt: new Date()
          });
        });

        await Promise.all(notificationPromises);
      } catch (error) {
        console.error("Error sending notifications:", error);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', productId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
      }
    }
  };

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!store) return;

    if (newCoupon.type === 'percentage' && Number(newCoupon.amount) > 100) {
      setCouponError("Percentage discount cannot exceed 100%.");
      return;
    }

    const couponData: Omit<Coupon, 'id'> = {
      storeId: store.id!,
      code: newCoupon.code?.toUpperCase() || '',
      type: newCoupon.type as 'percentage' | 'fixed',
      amount: Number(newCoupon.amount) || 0,
      expiryDate: new Date(newCoupon.expiryDate as string),
      minPurchase: Number(newCoupon.minPurchase) || 0,
      active: true,
      createdAt: new Date()
    };

    try {
      await addDoc(collection(db, 'coupons'), couponData);
      setIsAddingCoupon(false);
      setNewCoupon({ code: '', type: 'percentage', amount: 0, expiryDate: '', minPurchase: 0, active: true });

      // Notify followers
      try {
        const followsQuery = query(collection(db, 'follows'), where('storeId', '==', store.id));
        const followsSnapshot = await getDocs(followsQuery);
        
        const discountText = couponData.type === 'percentage' ? `${couponData.amount}% off` : `$${couponData.amount} off`;
        
        const notificationPromises = followsSnapshot.docs.map(doc => {
          const followData = doc.data();
          return addDoc(collection(db, 'notifications'), {
            customerId: followData.customerId,
            title: `New Promotion from ${store.name}`,
            message: `${store.name} is offering ${discountText} with code ${couponData.code}!`,
            read: false,
            link: `/store/${store.id}`,
            createdAt: new Date()
          });
        });

        await Promise.all(notificationPromises);
      } catch (error) {
        console.error("Error sending notifications:", error);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'coupons');
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

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      if (status === 'delivered') {
        await runTransaction(db, async (transaction) => {
          const orderRef = doc(db, 'orders', orderId);
          const orderDoc = await transaction.get(orderRef);
          
          if (!orderDoc.exists()) {
            throw new Error("Order does not exist!");
          }
          
          const orderData = orderDoc.data() as Order;
          
          if (orderData.payoutStatus === 'credited') {
            // Already credited, just update status
            transaction.update(orderRef, { status });
            return;
          }

          const storeRef = doc(db, 'stores', store!.id!);
          const storeDoc = await transaction.get(storeRef);
          
          if (!storeDoc.exists()) {
            throw new Error("Store does not exist!");
          }
          
          const storeData = storeDoc.data() as Store;
          const commissionRate = storeData.commissionRate ?? 10; // Default 10%
          const commissionAmount = (orderData.total * commissionRate) / 100;
          const earnings = orderData.total - commissionAmount;

          const newBalance = (storeData.balance || 0) + earnings;
          const newTotalEarned = (storeData.totalEarned || 0) + earnings;

          // Update store balance
          transaction.update(storeRef, {
            balance: newBalance,
            totalEarned: newTotalEarned
          });

          // Update order status and payout status
          transaction.update(orderRef, {
            status,
            payoutStatus: 'credited'
          });

          // Create transaction record
          const transactionRef = doc(collection(db, 'transactions'));
          transaction.set(transactionRef, {
            storeId: store!.id!,
            vendorId: userProfile!.uid,
            orderId: orderId,
            type: 'earning',
            amount: earnings,
            commissionAmount,
            description: `Earnings from order ${orderId}`,
            createdAt: new Date()
          });
        });
      } else {
        await updateDoc(doc(db, 'orders', orderId), { status });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !userProfile) return;
    if (payoutForm.amount <= 0 || payoutForm.amount > (store.balance || 0)) {
      alert("Invalid payout amount.");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const storeRef = doc(db, 'stores', store.id!);
        const storeDoc = await transaction.get(storeRef);
        
        if (!storeDoc.exists()) {
          throw new Error("Store does not exist!");
        }
        
        const storeData = storeDoc.data() as Store;
        if (payoutForm.amount > (storeData.balance || 0)) {
          throw new Error("Insufficient balance.");
        }

        const newBalance = (storeData.balance || 0) - payoutForm.amount;

        // Update store balance
        transaction.update(storeRef, {
          balance: newBalance
        });

        // Create payout request
        const payoutRef = doc(collection(db, 'payouts'));
        transaction.set(payoutRef, {
          storeId: store.id,
          vendorId: userProfile.uid,
          amount: payoutForm.amount,
          status: 'pending',
          method: payoutForm.method,
          details: payoutForm.details,
          createdAt: new Date()
        });

        // Create transaction record
        const transactionRef = doc(collection(db, 'transactions'));
        transaction.set(transactionRef, {
          storeId: store.id,
          vendorId: userProfile.uid,
          payoutId: payoutRef.id,
          type: 'withdrawal',
          amount: payoutForm.amount,
          description: `Payout request via ${payoutForm.method}`,
          createdAt: new Date()
        });
      });

      setIsRequestingPayout(false);
      setPayoutForm({ amount: 0, method: 'bank_transfer', details: '' });
      alert("Payout requested successfully!");
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'payouts');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  if (!store) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <StoreIcon className="mx-auto h-24 w-24 text-gray-300 mb-6" />
        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">You don't have a store yet</h2>
        <p className="text-lg text-gray-500 mb-8">Create your store to start selling products on Online Mall.</p>
        <button
          onClick={handleCreateStore}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Create Store
        </button>
      </div>
    );
  }

  if (store.status === 'pending') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 inline-block text-left">
          <div className="flex">
            <div className="flex-shrink-0">
              <StoreIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Your store is currently pending approval from an administrator. You will be able to add products once approved.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0 flex items-center">
          {store.logoUrl ? (
            <img src={store.logoUrl} alt={store.name} className="h-12 w-12 rounded-full object-cover mr-4 border border-gray-200" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4 border border-gray-200">
              <StoreIcon className="h-6 w-6 text-indigo-600" />
            </div>
          )}
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            {store.name} Dashboard
          </h2>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('products')}
            className={`${activeTab === 'products' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Package className="mr-2 h-5 w-5" />
            Products
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`${activeTab === 'orders' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            Orders
          </button>
          <button
            onClick={() => setActiveTab('coupons')}
            className={`${activeTab === 'coupons' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Tag className="mr-2 h-5 w-5" />
            Coupons
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`${activeTab === 'payouts' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <DollarSign className="mr-2 h-5 w-5" />
            Payouts
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`${activeTab === 'settings' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Settings className="mr-2 h-5 w-5" />
            Store Settings
          </button>
        </nav>
      </div>

      {activeTab === 'products' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Your Products</h3>
            <button
              onClick={() => setIsAddingProduct(!isAddingProduct)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Product
            </button>
          </div>

          {isAddingProduct && (
            <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
              <h4 className="text-md font-medium mb-4">Add New Product</h4>
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <select required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                      <option value="">Select a category</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Clothing">Clothing</option>
                      <option value="Home & Garden">Home & Garden</option>
                      <option value="Sports">Sports</option>
                      <option value="Toys">Toys</option>
                      <option value="Beauty">Beauty</option>
                      <option value="Automotive">Automotive</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price ($)</label>
                    <input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: parseFloat(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Inventory</label>
                    <input type="number" required value={newProduct.inventory} onChange={e => setNewProduct({...newProduct, inventory: parseInt(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Image URL or Upload</label>
                    <div className="mt-1 flex items-center space-x-4">
                      <input type="text" value={newProduct.imageUrl} onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})} placeholder="https://..." className="flex-1 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      <span className="text-gray-500">or</span>
                      <button type="button" onClick={() => productInputRef.current?.click()} className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <ImageIcon className="h-4 w-4 mr-2" /> Upload
                      </button>
                      <input type="file" ref={productInputRef} onChange={(e) => handleImageUpload(e, 'productImageUrl')} accept="image/*" className="hidden" />
                    </div>
                    {newProduct.imageUrl && (
                      <div className="mt-2">
                        <img src={newProduct.imageUrl} alt="Preview" className="h-20 w-20 object-cover rounded-md" />
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <textarea rows={3} required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsAddingProduct(false)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Save Product</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {products.map(product => (
                <li key={product.id}>
                  <div className="px-4 py-4 flex items-center sm:px-6">
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                      <div className="flex items-center">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-md object-cover mr-4 border border-gray-200" />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center mr-4 border border-gray-200">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                        <div className="truncate">
                          <div className="flex text-sm">
                            <p className="font-medium text-indigo-600 truncate">{product.name}</p>
                            <p className="ml-1 flex-shrink-0 font-normal text-gray-500">in {product.category}</p>
                          </div>
                          <div className="mt-2 flex">
                            <div className="flex items-center text-sm text-gray-500">
                              <span className="mr-4">${product.price.toFixed(2)}</span>
                              <span>Stock: {product.inventory}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="ml-5 flex-shrink-0 flex space-x-2">
                      <button onClick={() => handleDeleteProduct(product.id!)} className="p-2 text-red-600 hover:bg-red-50 rounded-full">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {products.length === 0 && (
                <li className="px-4 py-8 text-center text-gray-500">No products found. Add some to start selling!</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Store Orders</h3>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {orders.map(order => (
                <li key={order.id} className="p-4 sm:px-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Order #{order.id?.slice(-6).toUpperCase()}</p>
                      <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id!, e.target.value as Order['status'])}
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-4">
                    <ul className="divide-y divide-gray-100">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="py-2 flex justify-between">
                          <span className="text-sm text-gray-600">{item.name} x{item.quantity}</span>
                          <span className="text-sm font-medium text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex justify-between font-bold text-gray-900">
                      <span>Total</span>
                      <span>${order.total.toFixed(2)}</span>
                    </div>
                  </div>
                </li>
              ))}
              {orders.length === 0 && (
                <li className="px-4 py-8 text-center text-gray-500">No orders yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'coupons' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Your Coupons</h3>
            <button
              onClick={() => setIsAddingCoupon(!isAddingCoupon)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Coupon
            </button>
          </div>

          {isAddingCoupon && (
            <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
              <h4 className="text-md font-medium mb-4">Create New Coupon</h4>
              {couponError && <p className="text-sm text-red-600 mb-4">{couponError}</p>}
              <form onSubmit={handleAddCoupon} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Code</label>
                    <input type="text" required value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm uppercase" placeholder="SUMMER20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select value={newCoupon.type} onChange={e => setNewCoupon({...newCoupon, type: e.target.value as 'percentage' | 'fixed'})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Discount Amount</label>
                    <input type="number" step="0.01" required value={newCoupon.amount} onChange={e => setNewCoupon({...newCoupon, amount: parseFloat(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Minimum Purchase ($)</label>
                    <input type="number" step="0.01" required value={newCoupon.minPurchase} onChange={e => setNewCoupon({...newCoupon, minPurchase: parseFloat(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
                    <input type="date" required value={newCoupon.expiryDate as string} onChange={e => setNewCoupon({...newCoupon, expiryDate: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsAddingCoupon(false)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Save Coupon</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {coupons.map(coupon => (
                <li key={coupon.id}>
                  <div className="px-4 py-4 flex items-center sm:px-6">
                    <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between">
                      <div className="truncate">
                        <div className="flex text-sm">
                          <p className="font-medium text-indigo-600 truncate text-lg">{coupon.code}</p>
                          <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${coupon.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {coupon.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-2 flex">
                          <div className="flex items-center text-sm text-gray-500">
                            <span className="mr-4">
                              Discount: {coupon.type === 'percentage' ? `${coupon.amount}%` : `$${coupon.amount.toFixed(2)}`}
                            </span>
                            <span className="mr-4">Min Purchase: ${coupon.minPurchase.toFixed(2)}</span>
                            <span>Expires: {new Date(coupon.expiryDate?.toDate ? coupon.expiryDate.toDate() : coupon.expiryDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="ml-5 flex-shrink-0 flex space-x-2">
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
              ))}
              {coupons.length === 0 && (
                <li className="px-4 py-8 text-center text-gray-500">No coupons found. Create one to offer discounts!</li>
              )}
            </ul>
          </div>
        </div>
      )}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          <div className="bg-white shadow sm:rounded-lg p-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Available Balance</h3>
              <p className="text-3xl font-bold text-indigo-600 mt-2">${(store.balance || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-500 mt-1">Lifetime Earnings: ${(store.totalEarned || 0).toFixed(2)}</p>
            </div>
            <button
              onClick={() => setIsRequestingPayout(true)}
              disabled={(store.balance || 0) <= 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
            >
              <DollarSign className="mr-2 h-5 w-5" />
              Request Payout
            </button>
          </div>

          {isRequestingPayout && (
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h4 className="text-md font-medium mb-4">Request Payout</h4>
              <form onSubmit={handleRequestPayout} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Amount ($)</label>
                    <input type="number" step="0.01" max={store.balance || 0} required value={payoutForm.amount} onChange={e => setPayoutForm({...payoutForm, amount: parseFloat(e.target.value)})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Method</label>
                    <select value={payoutForm.method} onChange={e => setPayoutForm({...payoutForm, method: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Details (Email/Account)</label>
                    <input type="text" required value={payoutForm.details} onChange={e => setPayoutForm({...payoutForm, details: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsRequestingPayout(false)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Submit Request</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Payout Requests</h3>
              </div>
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {payouts.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()).map(payout => (
                  <li key={payout.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">${payout.amount.toFixed(2)} via {payout.method}</p>
                        <p className="text-sm text-gray-500">{new Date(payout.createdAt?.toDate ? payout.createdAt.toDate() : payout.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${payout.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            payout.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                            payout.status === 'processing' ? 'bg-blue-100 text-blue-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {payout.status}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
                {payouts.length === 0 && (
                  <li className="px-4 py-8 text-center text-gray-500">No payout requests yet.</li>
                )}
              </ul>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Transaction History</h3>
              </div>
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {transactions.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()).map(transaction => (
                  <li key={transaction.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${transaction.type === 'earning' ? 'bg-green-100' : 'bg-red-100'}`}>
                          {transaction.type === 'earning' ? <Plus className="h-6 w-6 text-green-600" /> : <DollarSign className="h-6 w-6 text-red-600" />}
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                          <p className="text-sm text-gray-500">{new Date(transaction.createdAt?.toDate ? transaction.createdAt.toDate() : transaction.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${transaction.type === 'earning' ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.type === 'earning' ? '+' : '-'}${transaction.amount.toFixed(2)}
                        </p>
                        {transaction.commissionAmount && (
                          <p className="text-xs text-gray-500">Commission: ${transaction.commissionAmount.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
                {transactions.length === 0 && (
                  <li className="px-4 py-8 text-center text-gray-500">No transactions yet.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'settings' && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Store Settings</h3>
            <form onSubmit={handleUpdateStore} className="space-y-6">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Store Name</label>
                  <div className="mt-1">
                    <input type="text" name="name" id="name" required value={storeForm.name || ''} onChange={e => setStoreForm({...storeForm, name: e.target.value})} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
                  <div className="mt-1">
                    <input type="text" name="category" id="category" required value={storeForm.category || ''} onChange={e => setStoreForm({...storeForm, category: e.target.value})} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                  <div className="mt-1">
                    <textarea id="description" name="description" rows={3} required value={storeForm.description || ''} onChange={e => setStoreForm({...storeForm, description: e.target.value})} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md" />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-sm font-medium text-gray-700">Store Logo</label>
                  <div className="mt-1 flex items-center space-x-4">
                    {storeForm.logoUrl ? (
                      <img src={storeForm.logoUrl} alt="Store Logo" className="h-16 w-16 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                        <StoreIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <button type="button" onClick={() => logoInputRef.current?.click()} className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      <ImageIcon className="h-4 w-4 mr-2" /> Upload Logo
                    </button>
                    <input type="file" ref={logoInputRef} onChange={(e) => handleImageUpload(e, 'logoUrl')} accept="image/*" className="hidden" />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-sm font-medium text-gray-700">Store Banner</label>
                  <div className="mt-1 space-y-4">
                    {storeForm.bannerUrl ? (
                      <img src={storeForm.bannerUrl} alt="Store Banner" className="h-32 w-full object-cover rounded-md border border-gray-200" />
                    ) : (
                      <div className="h-32 w-full rounded-md bg-gray-100 flex items-center justify-center border border-gray-200">
                        <span className="text-gray-400">No banner uploaded</span>
                      </div>
                    )}
                    <button type="button" onClick={() => bannerInputRef.current?.click()} className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      <ImageIcon className="h-4 w-4 mr-2" /> Upload Banner
                    </button>
                    <input type="file" ref={bannerInputRef} onChange={(e) => handleImageUpload(e, 'bannerUrl')} accept="image/*" className="hidden" />
                  </div>
                </div>
              </div>
              
              <div className="pt-5">
                <div className="flex justify-end">
                  <button type="submit" disabled={isUpdatingStore} className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                    {isUpdatingStore ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
