import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Store, Follow } from '../types';
import { Link } from 'react-router-dom';
import { Store as StoreIcon, Users } from 'lucide-react';
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
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!currentUser) {
    return <div className="text-center mt-10">Please log in to view followed stores.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center">
        <Users className="mr-3 text-indigo-600" /> Following Stores
      </h1>

      {stores.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
          <StoreIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">You aren't following any stores yet</h3>
          <p className="mt-2 text-gray-500">Discover new stores and follow them to get updates!</p>
          <Link to="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <Link key={store.id} to={`/stores/${store.id}`} className="block">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 flex items-center">
                {store.logoUrl ? (
                  <img src={store.logoUrl} alt={store.name} className="h-16 w-16 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                ) : (
                  <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <StoreIcon className="h-8 w-8 text-indigo-600" />
                  </div>
                )}
                <div className="ml-4">
                  <h3 className="text-xl font-semibold text-gray-900">{store.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{store.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
