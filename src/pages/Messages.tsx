import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, onSnapshot, orderBy, doc, getDoc, updateDoc, serverTimestamp, or } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Chat as ChatType, Message, Store, User } from '../types';
import { Send, User as UserIcon, Store as StoreIcon, Shield } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const Messages = () => {
  const { userProfile } = useAuth();
  const [chats, setChats] = useState<(ChatType & { otherName?: string, otherRole?: string })[]>([]);
  const [activeChat, setActiveChat] = useState<ChatType | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userProfile) return;

    let chatsQuery;
    if (userProfile.role === 'customer') {
      chatsQuery = query(collection(db, 'chats'), where('customerId', '==', userProfile.uid));
    } else if (userProfile.role === 'vendor') {
      chatsQuery = query(collection(db, 'chats'), or(where('vendorId', '==', userProfile.uid), where('customerId', '==', userProfile.uid)));
    } else if (userProfile.role === 'admin') {
      chatsQuery = query(collection(db, 'chats'), where('type', '==', 'support'));
    }

    if (!chatsQuery) return;

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const fetchedChats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatType));
      
      // Enrich chats with names
      const enrichedChats = await Promise.all(fetchedChats.map(async (chat) => {
        let otherName = 'Unknown';
        let otherRole = '';
        
        if (chat.type === 'support') {
          if (userProfile.role === 'admin') {
            try {
              const userDoc = await getDoc(doc(db, 'users', chat.customerId));
              otherName = userDoc.exists() ? (userDoc.data() as User).name : 'Vendor';
            } catch (e) {
              otherName = 'Vendor';
            }
            otherRole = 'Vendor Support';
          } else {
            otherName = 'Admin Support';
            otherRole = 'Support';
          }
        } else {
          if (userProfile.role === 'customer') {
            try {
              const storeDoc = await getDoc(doc(db, 'stores', chat.storeId));
              otherName = storeDoc.exists() ? (storeDoc.data() as Store).name : 'Store';
            } catch (e) {
              otherName = 'Store';
            }
            otherRole = 'Store';
          } else {
            try {
              const userDoc = await getDoc(doc(db, 'users', chat.customerId));
              otherName = userDoc.exists() ? (userDoc.data() as User).name : 'Customer';
            } catch (e) {
              otherName = 'Customer';
            }
            otherRole = 'Customer';
          }
        }
        
        return { ...chat, otherName, otherRole };
      }));

      // Sort by updatedAt descending
      enrichedChats.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setChats(enrichedChats);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chats'));

    return unsubscribe;
  }, [userProfile]);

  useEffect(() => {
    if (!activeChat || !userProfile) return;

    const currentChatInList = chats.find(c => c.id === activeChat.id);
    const myKey = userProfile.role === 'admin' ? 'admin' : userProfile.uid;
    const unreadForMe = currentChatInList?.unreadCount?.[myKey] || 0;

    if (unreadForMe > 0) {
      const resetUnread = async () => {
        try {
          await updateDoc(doc(db, 'chats', activeChat.id!), {
            [`unreadCount.${myKey}`]: 0
          });
        } catch (error) {
          console.error("Failed to reset unread count", error);
        }
      };
      resetUnread();
    }
  }, [activeChat, chats, userProfile]);

  useEffect(() => {
    if (!activeChat) return;

    const messagesQuery = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`));

    return unsubscribe;
  }, [activeChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !userProfile) return;

    const messageData: Omit<Message, 'id'> = {
      chatId: activeChat.id!,
      senderId: userProfile.uid,
      text: newMessage.trim(),
      createdAt: serverTimestamp()
    };

    const otherUserId = activeChat.type === 'support' 
      ? (userProfile.role === 'admin' ? activeChat.customerId : 'admin')
      : (userProfile.uid === activeChat.customerId ? activeChat.vendorId : activeChat.customerId);

    const currentUnread = activeChat.unreadCount?.[otherUserId] || 0;

    try {
      await addDoc(collection(db, 'chats', activeChat.id!, 'messages'), messageData);
      await updateDoc(doc(db, 'chats', activeChat.id!), {
        lastMessage: newMessage.trim(),
        updatedAt: serverTimestamp(),
        [`unreadCount.${otherUserId}`]: currentUnread + 1
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${activeChat.id}/messages`);
    }

    setNewMessage('');
  };

  const startSupportChat = async () => {
    if (!userProfile || userProfile.role !== 'vendor') return;
    
    // Check if support chat already exists
    try {
      const supportQuery = query(
        collection(db, 'chats'),
        where('customerId', '==', userProfile.uid),
        where('type', '==', 'support')
      );
      const snapshot = await getDocs(supportQuery);
      
      if (snapshot.empty) {
        const newChat: Omit<ChatType, 'id'> = {
          customerId: userProfile.uid,
          vendorId: 'admin',
          storeId: 'support',
          lastMessage: 'Chat started',
          updatedAt: serverTimestamp(),
          type: 'support',
          unreadCount: {}
        };
        const docRef = await addDoc(collection(db, 'chats'), newChat);
        setActiveChat({ id: docRef.id, ...newChat });
      } else {
        setActiveChat({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ChatType);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-4rem)] flex">
      <div className="w-1/3 bg-white shadow sm:rounded-l-lg border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Messages</h3>
          {userProfile?.role === 'vendor' && (
            <button
              onClick={startSupportChat}
              className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-200 flex items-center"
            >
              <Shield className="w-4 h-4 mr-1" /> Support
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No messages yet.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {chats.map(chat => (
                <li 
                  key={chat.id} 
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${activeChat?.id === chat.id ? 'bg-indigo-50' : ''}`}
                  onClick={() => setActiveChat(chat)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {chat.type === 'support' ? <Shield className="h-6 w-6 text-indigo-500" /> : 
                       chat.otherRole === 'Store' ? <StoreIcon className="h-6 w-6 text-gray-400" /> : 
                       <UserIcon className="h-6 w-6 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{chat.otherName}</p>
                      <p className="text-sm text-gray-500 truncate">{chat.lastMessage || 'No messages yet'}</p>
                    </div>
                    {chat.unreadCount?.[userProfile?.role === 'admin' ? 'admin' : (userProfile?.uid || '')] > 0 && (
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                          {chat.unreadCount[userProfile?.role === 'admin' ? 'admin' : userProfile!.uid]}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white shadow sm:rounded-r-lg flex flex-col">
        {activeChat ? (
          <>
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex items-center space-x-3">
              {activeChat.type === 'support' ? <Shield className="h-6 w-6 text-indigo-500" /> : 
               userProfile?.role === 'customer' ? <StoreIcon className="h-6 w-6 text-gray-400" /> : 
               <UserIcon className="h-6 w-6 text-gray-400" />}
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {chats.find(c => c.id === activeChat.id)?.otherName || 'Chat'}
              </h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-4">
              {messages.map((msg) => {
                const isMe = msg.senderId === userProfile?.uid;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'}`}>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-4 border-t border-gray-200 bg-white sm:px-6">
              <form onSubmit={handleSendMessage} className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 px-3 border"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </div>
    </div>
  );
};
