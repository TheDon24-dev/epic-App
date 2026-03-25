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
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  if (!store) {
    return <div className="text-center py-12 text-gray-500">Store not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        {store.bannerUrl && (
          <div className="h-48 w-full">
            <img src={store.bannerUrl} alt={`${store.name} banner`} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-8 sm:flex sm:items-center sm:justify-between">
          <div className="sm:flex sm:items-center">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={`${store.name} logo`} className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-sm -mt-16 sm:mt-0" />
            ) : (
              <div className="h-24 w-24 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 -mt-16 sm:mt-0 border-4 border-white shadow-sm">
                <StoreIcon className="h-12 w-12 text-indigo-600" />
              </div>
            )}
            <div className="mt-4 sm:mt-0 sm:ml-6 text-center sm:text-left">
              <h1 className="text-3xl font-bold text-gray-900">{store.name}</h1>
              <p className="text-sm font-medium text-gray-500 mt-1">{store.description}</p>
              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start text-sm text-gray-500 gap-4">
                <span className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {followerCount} {followerCount === 1 ? 'Follower' : 'Followers'}
                </span>
                {store.location && (
                  <span className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
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
              className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium flex items-center justify-center"
            >
              <Share2 className="h-4 w-4 mr-2" /> Share
            </button>
            {currentUser && currentUser.uid !== store.vendorId && (
              <>
                <button
                  onClick={toggleFollow}
                  className={`px-6 py-2 rounded-md font-medium transition-colors ${
                    isFollowing 
                      ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow Store'}
                </button>
                <Link
                  to={`/chat/${store.id}`}
                  className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium flex items-center justify-center"
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Message
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Products</h2>
      {products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
          <p className="text-gray-500">This store has no products yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow duration-200">
              <Link to={`/products/${product.id}`}>
                <div className="h-48 w-full overflow-hidden bg-gray-200">
                  <img
                    src={product.imageUrl || 'https://picsum.photos/seed/product/400/300'}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </Link>
              <div className="p-4">
                <Link to={`/products/${product.id}`}>
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{product.name}</h3>
                </Link>
                <p className="text-gray-500 text-sm mt-1 truncate">{product.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
                  <div className="flex items-center space-x-2">
                    {currentUser ? (
                      <Link
                        to={`/chat/${store.id}`}
                        className="p-2 border border-gray-300 text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
                        title="Message Store"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </Link>
                    ) : (
                      <button
                        onClick={loginWithGoogle}
                        className="p-2 border border-gray-300 text-gray-400 rounded-full hover:bg-gray-50 transition-colors"
                        title="Sign in to message"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.inventory === 0}
                      className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
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
