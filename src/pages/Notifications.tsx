import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Notification } from '../types';
import { Bell, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const Notifications = () => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'notifications'),
      where('customerId', '==', userProfile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const promises = unreadNotifications.map(n => 
        updateDoc(doc(db, 'notifications', n.id!), { read: true })
      );
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
          <Bell className="mr-3 h-8 w-8 text-indigo-600" />
          Notifications
        </h1>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center"
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {notifications.map(notification => (
            <li key={notification.id} className={`p-4 sm:px-6 ${!notification.read ? 'bg-indigo-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!notification.read ? 'text-indigo-900' : 'text-gray-900'} truncate`}>
                    {notification.title}
                  </p>
                  <p className={`text-sm ${!notification.read ? 'text-indigo-700' : 'text-gray-500'} mt-1`}>
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notification.createdAt?.toDate ? notification.createdAt.toDate() : notification.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0 flex flex-col items-end space-y-2">
                  {!notification.read && (
                    <button 
                      onClick={() => markAsRead(notification.id!)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Mark as read
                    </button>
                  )}
                  {notification.link && (
                    <Link 
                      to={notification.link}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
          {notifications.length === 0 && (
            <li className="px-4 py-12 text-center text-gray-500">
              <Bell className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>You have no notifications.</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};
