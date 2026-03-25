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
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!currentUser) {
    return <div className="text-center mt-10">Please log in to view your wishlist.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
        <Heart className="mr-3 text-red-500" /> My Wishlist
      </h1>

      {products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
          <Heart className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Your wishlist is empty</h3>
          <p className="mt-2 text-gray-500">Start saving your favorite items!</p>
          <Link to="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
            Browse Products
          </Link>
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
                        to={`/chat/${product.storeId}`}
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
