import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, onSnapshot, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Store, Banner } from '../types';
import { Link } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, MapPin, MessageCircle, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const Home = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Record<string, Store>>({});
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { currentUser, loginWithGoogle } = useAuth();

  useEffect(() => {
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

    const bannersQuery = query(collection(db, 'banners'), where('active', '==', true));
    const unsubscribeBanners = onSnapshot(bannersQuery, (snapshot) => {
      const bannersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      bannersData.sort((a, b) => a.order - b.order);
      setBanners(bannersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'banners'));

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    return () => {
      unsubscribeBanners();
      unsubscribeProducts();
    };
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Auto-scroll every 5 seconds

    return () => clearInterval(interval);
  }, [banners.length]);

  const nextBanner = () => {
    setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
  };

  const prevBanner = () => {
    setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
    const store = stores[product.storeId];
    const isStoreApproved = store?.status === 'approved';
    return matchesSearch && matchesCategory && isStoreApproved;
  });

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {banners.length > 0 && (
        <div className="relative w-full h-64 md:h-96 mb-12 rounded-2xl overflow-hidden shadow-xl group">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentBannerIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              {banner.link ? (
                <a href={banner.link} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                  <img
                    src={banner.imageUrl}
                    alt={`Banner ${index + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </a>
              ) : (
                <img
                  src={banner.imageUrl}
                  alt={`Banner ${index + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          ))}
          
          {banners.length > 1 && (
            <>
              <button
                onClick={prevBanner}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Previous banner"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextBanner}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Next banner"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex space-x-2">
                {banners.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentBannerIndex(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      index === currentBannerIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/75'
                    }`}
                    aria-label={`Go to banner ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-extrabold text-gray-900">Discover Products</h1>
        
        <div className="flex w-full md:w-auto gap-4">
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <select
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col">
              <Link to={`/products/${product.id}`} className="block relative h-48 bg-gray-200">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                )}
              </Link>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
                  <span className="text-lg font-bold text-indigo-600">${product.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center mt-2 space-x-2">
                  {stores[product.storeId]?.logoUrl ? (
                    <img src={stores[product.storeId].logoUrl} alt={stores[product.storeId].name} className="w-6 h-6 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center border border-gray-200">
                      <span className="text-xs text-indigo-600 font-bold">{stores[product.storeId]?.name?.charAt(0) || '?'}</span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <p className="text-sm text-gray-500 line-clamp-1">{stores[product.storeId]?.name || 'Unknown Store'}</p>
                    {stores[product.storeId]?.location && (
                      <div className="flex items-center text-xs text-gray-400 mt-0.5">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="line-clamp-1">{stores[product.storeId].location}</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2 flex-1">{product.description}</p>
                
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {product.category}
                  </span>
                  <div className="flex items-center space-x-2">
                    {currentUser ? (
                      <Link
                        to={`/chat/${product.storeId}`}
                        className="p-1.5 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                        title="Message Store"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Link>
                    ) : (
                      <button
                        onClick={loginWithGoogle}
                        className="p-1.5 border border-gray-300 text-gray-400 rounded-md hover:bg-gray-50 transition-colors"
                        title="Sign in to message"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => addToCart(product)}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Add
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
};
