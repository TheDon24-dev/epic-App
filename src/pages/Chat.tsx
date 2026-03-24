import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Chat as ChatType } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const Chat = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userProfile || !storeId) return;

    const initializeChat = async () => {
      try {
        if (userProfile.role === 'customer') {
          let storeVendorId = '';
          try {
            const storeDoc = await getDoc(doc(db, 'stores', storeId));
            storeVendorId = storeDoc.data()?.vendorId;
          } catch (e) {
            // Store might be suspended or not found
          }
          
          const chatsQuery = query(
            collection(db, 'chats'),
            where('storeId', '==', storeId),
            where('customerId', '==', userProfile.uid)
          );
          
          const chatSnapshot = await getDocs(chatsQuery);
          
          if (chatSnapshot.empty) {
            const newChat: Omit<ChatType, 'id'> = {
              customerId: userProfile.uid,
              vendorId: storeVendorId,
              storeId,
              lastMessage: '',
              updatedAt: serverTimestamp(),
              unreadCount: {}
            };
            await addDoc(collection(db, 'chats'), newChat);
          }
          
          navigate('/messages', { replace: true });
        } else {
          navigate('/messages', { replace: true });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `chats`);
      }
    };

    initializeChat();
  }, [userProfile, storeId, navigate]);

  return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );
};
