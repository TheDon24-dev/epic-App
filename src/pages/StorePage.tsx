import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Store, Product, Follow } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Store as StoreIcon, ShoppingCart, Users, MessageCircle, MapPin, Share2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export default function StorePage() {
  const { id } = useParams<{ id: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followDocId, setFollowDocId] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const { currentUser, loginWithGoogle } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchStoreData = async () => {
      if (!id) return;
      try {
        const storeDoc = await getDoc(doc(db, 'stores', id));
        if (storeDoc.exists()) {
          setStore({ id: storeDoc.id, ...storeDoc.data() } as Store);
          
          const productsQuery = query(collection(db, 'products'), where('storeId', '==', id));
          const productsSnapshot = await getDocs(productsQuery);
          setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

          const followsQuery = query(collection(db, 'follows'), where('storeId', '==', id));
          const followsSnapshot = await getDocs(followsQuery);
          setFollowerCount(followsSnapshot.size);

          if (currentUser) {
            const userFollowQuery = query(collection(db, 'follows'), where('storeId', '==', id), where('customerId', '==', currentUser.uid));
            const userFollowSnapshot = await getDocs(userFollowQuery);
            if (!userFollowSnapshot.empty) {
              setIsFollowing(true);
              setFollowDocId(userFollowSnapshot.docs[0].id);
            }
          }
        }
      } catch (error) {
        // Store might be suspended or user lacks permission
        setStore(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStoreData();
  }, [id, currentUser]);

  const toggleFollow = async () => {
    if (!currentUser || !id) return;
    
    try {
      if (isFollowing && followDocId) {
        await deleteDoc(doc(db, 'follows', followDocId));
        setIsFollowing(false);
        setFollowDocId(null);
        setFollowerCount(prev => prev - 1);
      } else {
        const newFollow = {
          customerId: currentUser.uid,
          storeId: id,
          createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'follows'), newFollow);
        setIsFollowing(true);
        setFollowDocId(docRef.id);
        setFollowerCount(prev => prev + 1);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'follows');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-sky"></div></div>;
  }

  if (!store) {
    return <div className="text-center py-12 text-gray-400">Store not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="glass-panel rounded-xl overflow-hidden mb-8">
        {store.bannerUrl && (
          <div className="h-48 w-full relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#030014]/80 z-10"></div>
            <img src={store.bannerUrl} alt={`${store.name} banner`} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-8 sm:flex sm:items-center sm:justify-between relative z-20">
          <div className="sm:flex sm:items-center">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={`${store.name} logo`} className="h-24 w-24 rounded-full object-cover border-4 border-[#030014] shadow-[0_0_15px_rgba(14,165,233,0.3)] -mt-16 sm:mt-0" />
            ) : (
              <div className="h-24 w-24 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 -mt-16 sm:mt-0 border-4 border-[#030014] shadow-[0_0_15px_rgba(14,165,233,0.3)]">
                <StoreIcon className="h-12 w-12 text-brand-sky" />
              </div>
            )}
            <div className="mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left">
              <h1 className="text-3xl font-bold text-white text-gradient">{store.name}</h1>
              <p className="text-sm font-medium text-gray-400 mt-1">{store.description}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start text-sm text-gray-400 gap-4">
                <span className="flex items-center">
                  <Users className="h-4 w-4 mr-1 text-brand-sky" />
                  {followerCount} {followerCount === 1 ? 'Follower' : 'Followers'}
                </span>
                {store.location && (
                  <span className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1 text-brand-purple" />
                    {store.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 sm:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url);
                alert('Store link copied to clipboard!');
              }}
              className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-md hover:bg-white/10 font-medium flex items-center justify-center transition-colors"
            >
              <Share2 className="h-4 w-4 mr-2 text-brand-sky" /> Share
            </button>
            {currentUser && currentUser.uid !== store.vendorId && (
              <>
                <button
                  onClick={toggleFollow}
                  className={`px-6 py-2 rounded-md font-medium transition-all shadow-[0_0_10px_rgba(168,85,247,0.3)] ${
                    isFollowing 
                      ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20' 
                      : 'bg-gradient-to-r from-brand-sky to-brand-purple text-white hover:opacity-90'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow Store'}
                </button>
                <Link
                  to={`/chat/${store.id}`}
                  className="px-6 py-2 bg-white/5 border border-white/10 text-white rounded-md hover:bg-white/10 font-medium flex items-center justify-center transition-colors"
                >
                  <MessageCircle className="h-4 w-4 mr-2 text-brand-purple" /> Message
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-6 text-gradient">Products</h2>
      {products.length === 0 ? (
        <div className="text-center py-12 glass-panel rounded-lg">
          <p className="text-gray-400">This store has no products yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="glass-card rounded-xl overflow-hidden hover:shadow-[0_0_15px_rgba(14,165,233,0.2)] transition-all duration-300 group">
              <Link to={`/products/${product.id}`}>
                <div className="h-48 w-full overflow-hidden bg-[#030014] relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030014] to-transparent opacity-50 z-10"></div>
                  <img
                    src={product.imageUrl || 'https://picsum.photos/seed/product/400/300'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </Link>
              <div className="p-4 relative z-20">
                <Link to={`/products/${product.id}`}>
                  <h3 className="text-lg font-semibold text-white truncate group-hover:text-brand-sky transition-colors">{product.name}</h3>
                </Link>
                <p className="text-gray-400 text-sm mt-1 truncate">{product.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-sky to-brand-purple">${product.price.toFixed(2)}</span>
                  <div className="flex items-center space-x-2">
                    {currentUser ? (
                      <Link
                        to={`/chat/${store.id}`}
                        className="p-2 border border-white/10 text-gray-300 rounded-full hover:bg-white/10 hover:text-brand-sky transition-colors"
                        title="Message Store"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </Link>
                    ) : (
                      <button
                        onClick={loginWithGoogle}
                        className="p-2 border border-white/10 text-gray-500 rounded-full hover:bg-white/5 transition-colors"
                        title="Sign in to message"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.inventory === 0}
                      className="bg-gradient-to-r from-brand-sky to-brand-purple text-white p-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_10px_rgba(14,165,233,0.3)]"
                      title="Add to Cart"
                    >
                      <ShoppingCart className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
