import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, Store, Review, Wishlist } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Star, MessageCircle, Heart, MapPin, ShoppingCart } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { userProfile, currentUser, loginWithGoogle } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!id) return;
      
      try {
        const productDoc = await getDoc(doc(db, 'products', id));
        if (productDoc.exists()) {
          const productData = { id: productDoc.id, ...productDoc.data() } as Product;
          setProduct(productData);

          try {
            const storeDoc = await getDoc(doc(db, 'stores', productData.storeId));
            if (storeDoc.exists()) {
              setStore({ id: storeDoc.id, ...storeDoc.data() } as Store);
            }
          } catch (e) {
            // Store might be suspended
          }

          const reviewsQuery = query(collection(db, 'reviews'), where('productId', '==', id));
          const reviewsSnapshot = await getDocs(reviewsQuery);
          const fetchedReviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
          setReviews(fetchedReviews);

          if (currentUser) {
            const hasUserReviewed = fetchedReviews.some(r => r.customerId === currentUser.uid);
            setHasReviewed(hasUserReviewed);

            const ordersQuery = query(collection(db, 'orders'), where('customerId', '==', currentUser.uid));
            const ordersSnapshot = await getDocs(ordersQuery);
            const userPurchased = ordersSnapshot.docs.some(doc => {
              const orderData = doc.data();
              return orderData.items && orderData.items.some((item: any) => item.productId === id);
            });
            setHasPurchased(userPurchased);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `products/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id, currentUser]);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!currentUser) return;
      try {
        const q = query(collection(db, 'wishlists'), where('customerId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setWishlist({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Wishlist);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'wishlists');
      }
    };
    fetchWishlist();
  }, [currentUser]);

  const toggleWishlist = async () => {
    if (!currentUser || !id) return;
    
    try {
      if (wishlist) {
        const isSaved = wishlist.productIds.includes(id);
        const wishlistRef = doc(db, 'wishlists', wishlist.id!);
        if (isSaved) {
          await updateDoc(wishlistRef, {
            productIds: arrayRemove(id)
          });
          setWishlist({ ...wishlist, productIds: wishlist.productIds.filter(pid => pid !== id) });
        } else {
          await updateDoc(wishlistRef, {
            productIds: arrayUnion(id)
          });
          setWishlist({ ...wishlist, productIds: [...wishlist.productIds, id] });
        }
      } else {
        const newWishlist = {
          customerId: currentUser.uid,
          productIds: [id]
        };
        const docRef = await addDoc(collection(db, 'wishlists'), newWishlist);
        setWishlist({ id: docRef.id, ...newWishlist });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'wishlists');
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !product || !store) return;
    
    setIsSubmittingReview(true);
    try {
      const reviewData = {
        productId: product.id!,
        storeId: store.id!,
        customerId: currentUser.uid,
        rating: newReview.rating,
        comment: newReview.comment,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'reviews'), reviewData);
      setReviews([{ id: docRef.id, ...reviewData, createdAt: new Date().toISOString() }, ...reviews]);
      setHasReviewed(true);
      setNewReview({ rating: 5, comment: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div></div>;
  }

  if (!product) {
    return <div className="text-center py-12 text-gray-400">Product not found.</div>;
  }

  const isSaved = wishlist?.productIds.includes(product.id!) || false;
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="md:flex">
          <div className="md:flex-shrink-0 md:w-1/2">
            {product.imageUrl ? (
              <img className="h-96 w-full object-cover md:h-full" src={product.imageUrl} alt={product.name} referrerPolicy="no-referrer" />
            ) : (
              <div className="h-96 w-full bg-slate-800/50 flex items-center justify-center text-gray-500">No Image Available</div>
            )}
          </div>
          <div className="p-8 md:w-1/2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-100">{product.name}</h1>
                <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-purple-400">${product.price.toFixed(2)}</span>
              </div>
              
              {averageRating && (
                <div className="mt-2 flex items-center">
                  <Star className="h-5 w-5 text-yellow-400 fill-current drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                  <span className="ml-1 text-sm font-medium text-gray-300">{averageRating}</span>
                  <span className="ml-1 text-sm text-gray-500">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
                </div>
              )}

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {store?.logoUrl ? (
                    <img src={store.logoUrl} alt={store.name} className="w-6 h-6 rounded-full object-cover border border-white/20" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                      <span className="text-xs text-sky-400 font-bold">{store?.name?.charAt(0) || '?'}</span>
                    </div>
                  )}
                  <Link to={`/stores/${store?.id}`} className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors">
                    {store?.name || 'Unknown Store'}
                  </Link>
                  {store?.location && (
                    <>
                      <span className="text-gray-600">&bull;</span>
                      <div className="flex items-center text-sm text-gray-400">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0 text-purple-400" />
                        {store.location}
                      </div>
                    </>
                  )}
                  <span className="text-gray-600">&bull;</span>
                  <span className="text-sm text-gray-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{product.category}</span>
                </div>
                {currentUser && (
                  <button 
                    onClick={toggleWishlist}
                    className={`p-2 rounded-full flex items-center transition-colors ${isSaved ? 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20' : 'text-gray-400 hover:text-rose-400 hover:bg-white/5 border border-transparent'}`}
                    title={isSaved ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    <Heart className="h-6 w-6" fill={isSaved ? "currentColor" : "none"} />
                  </button>
                )}
              </div>

              <p className="mt-6 text-gray-300 leading-relaxed">{product.description}</p>
              
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Inventory</h3>
                <p className="mt-1 text-sm font-medium text-gray-200">{product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'}</p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center border border-white/20 rounded-lg bg-slate-900/50">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-l-lg transition-colors"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 text-gray-100 font-medium min-w-[3rem] text-center">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(Math.min(product.inventory, quantity + 1))}
                    className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-r-lg transition-colors"
                  >
                    +
                  </button>
                </div>
                
                <button
                  onClick={() => addToCart(product, quantity)}
                  disabled={product.inventory === 0}
                  className={`flex-1 flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white transition-all ${
                    product.inventory > 0 ? 'bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-slate-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add to Cart
                </button>
              </div>

              {store && currentUser && currentUser.uid !== store.vendorId ? (
                <Link
                  to={`/chat/${store.id}`}
                  className="w-full flex justify-center items-center px-6 py-3 border border-white/20 shadow-sm text-base font-medium rounded-lg text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <MessageCircle className="h-5 w-5 mr-2 text-sky-400" />
                  Message Store
                </Link>
              ) : !currentUser ? (
                <button
                  onClick={loginWithGoogle}
                  className="w-full flex justify-center items-center px-6 py-3 border border-white/10 shadow-sm text-base font-medium rounded-lg text-gray-400 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Sign in to Message Store
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-100 mb-6">Customer Reviews</h2>
        
        {hasPurchased && !hasReviewed && (
          <div className="glass-panel p-6 rounded-2xl mb-8">
            <h3 className="text-lg font-medium text-gray-100 mb-4">Leave a Review</h3>
            <form onSubmit={submitReview}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">Rating</label>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReview({ ...newReview, rating: star })}
                      className="focus:outline-none transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= newReview.rating ? 'text-yellow-400 fill-current drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="comment" className="block text-sm font-medium text-gray-400 mb-2">
                  Comment
                </label>
                <textarea
                  id="comment"
                  rows={3}
                  required
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  className="block w-full sm:text-sm border-white/20 rounded-lg p-3 bg-slate-900/50 text-gray-200 placeholder-gray-500 focus:ring-sky-500 focus:border-sky-500 backdrop-blur-md"
                  placeholder="What did you think about this product?"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmittingReview}
                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg shadow-[0_0_15px_rgba(168,85,247,0.3)] text-white bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-all"
              >
                {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="text-gray-500 italic">No reviews yet. Be the first to review this product!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="glass-card p-6 rounded-xl">
                <div className="flex items-center mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`h-5 w-5 ${i < review.rating ? 'text-yellow-400 fill-current drop-shadow-[0_0_5px_rgba(250,204,21,0.4)]' : 'text-gray-600'}`} />
                  ))}
                </div>
                <p className="text-gray-300 leading-relaxed">{review.comment}</p>
                <p className="text-sm text-gray-500 mt-3 font-medium">
                  {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : new Date(review.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
