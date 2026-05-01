import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Store, Follow } from '../types';
import { Link } from 'react-router-dom';
import { Store as StoreIcon, Users, MapPin } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export default function Following() {
  const { currentUser } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowing = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'follows'), where('customerId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const storePromises = snapshot.docs.map(async followDoc => {
            const followData = followDoc.data() as Follow;
            try {
              return await getDoc(doc(db, 'stores', followData.storeId));
            } catch (error) {
              // Store might be suspended or user lacks permission
              return null;
            }
          });
          
          const storeDocs = await Promise.all(storePromises);
          const storesData = storeDocs
            .filter(doc => doc !== null && doc.exists())
            .map(doc => ({ id: doc!.id, ...doc!.data() } as Store));
            
          setStores(storesData);
        } else {
          setStores([]);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'follows');
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [currentUser]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-sky"></div></div>;
  }

  if (!currentUser) {
    return <div className="text-center mt-10 text-gray-400">Please log in to view followed stores.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-8 flex items-center text-gradient">
        <Users className="mr-3 text-brand-sky" /> Following Stores
      </h1>

      {stores.length === 0 ? (
        <div className="text-center py-12 glass-panel rounded-lg">
          <StoreIcon className="mx-auto h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-white">You aren't following any stores yet</h3>
          <p className="mt-2 text-gray-400">Discover new stores and follow them to get updates!</p>
          <Link to="/" className="mt-4 inline-block text-brand-sky hover:text-brand-sky/80 transition-colors">
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <Link key={store.id} to={`/stores/${store.id}`} className="block">
              <div className="glass-card rounded-xl p-6 hover:shadow-[0_0_15px_rgba(14,165,233,0.2)] transition-all duration-300 flex items-center group">
                {store.logoUrl ? (
                  <img src={store.logoUrl} alt={store.name} className="h-16 w-16 rounded-full object-cover flex-shrink-0 border border-white/10 group-hover:border-brand-sky transition-colors" />
                ) : (
                  <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center flex-shrink-0 border border-white/10 group-hover:border-brand-sky transition-colors">
                    <StoreIcon className="h-8 w-8 text-brand-sky" />
                  </div>
                )}
                <div className="ml-4 flex-1 min-w-0">
                  <h3 className="text-xl font-semibold text-white truncate group-hover:text-brand-sky transition-colors">{store.name}</h3>
                  <p className="text-sm text-gray-400 truncate">{store.description}</p>
                  {store.location && (
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3 mr-1 flex-shrink-0 text-brand-purple" />
                      <span className="truncate">{store.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
