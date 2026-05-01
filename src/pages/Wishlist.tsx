import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Product, Wishlist as WishlistType } from '../types';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export default function Wishlist() {
  const { currentUser, loginWithGoogle } = useAuth();
  const { addToCart } = useCart();
  const [wishlist, setWishlist] = useState<WishlistType | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'wishlists'), where('customerId', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const wishlistData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as WishlistType;
        setWishlist(wishlistData);
        
        if (wishlistData.productIds.length > 0) {
          const productPromises = wishlistData.productIds.map(id => getDoc(doc(db, 'products', id)));
          const productDocs = await Promise.all(productPromises);
          const productsData = productDocs
            .filter(doc => doc.exists())
            .map(doc => ({ id: doc.id, ...doc.data() } as Product));
          setProducts(productsData);
        } else {
          setProducts([]);
        }
      } else {
        setWishlist(null);
        setProducts([]);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wishlists');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-sky"></div></div>;
  }

  if (!currentUser) {
    return <div className="text-center mt-10 text-gray-400">Please log in to view your wishlist.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-8 flex items-center text-gradient">
        <Heart className="mr-3 text-brand-red" /> My Wishlist
      </h1>

      {products.length === 0 ? (
        <div className="text-center py-12 glass-panel rounded-lg">
          <Heart className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white">Your wishlist is empty</h3>
          <p className="mt-2 text-gray-400">Start saving your favorite items!</p>
          <Link to="/" className="mt-4 inline-block text-brand-sky hover:text-brand-sky/80 transition-colors">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="glass-card rounded-xl overflow-hidden group">
              <Link to={`/products/${product.id}`}>
                <div className="h-48 w-full overflow-hidden bg-white/5 relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030014] to-transparent opacity-50 z-10" />
                  <img
                    src={product.imageUrl || 'https://picsum.photos/seed/product/400/300'}
                    alt={product.name}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
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
                        to={`/chat/${product.storeId}`}
                        className="p-2 border border-white/10 text-gray-400 rounded-full hover:bg-white/10 hover:text-brand-sky transition-colors"
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
                      className="bg-gradient-to-r from-brand-sky to-brand-purple text-white p-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_10px_rgba(168,85,247,0.3)]"
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
