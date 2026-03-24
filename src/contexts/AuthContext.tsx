import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, Role } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setCurrentUser(user);
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          let userData: any;
          if (userDoc.exists()) {
            userData = userDoc.data() as User;
            if (user.email === 'dereklamson24@gmail.com' && userData.role !== 'admin') {
              await setDoc(userDocRef, { role: 'admin' }, { merge: true });
              userData.role = 'admin';
            }
            await updateDoc(userDocRef, { isOnline: true, lastSeen: serverTimestamp() });
          } else {
            userData = {
              uid: user.uid,
              email: user.email || '',
              name: user.displayName || 'Anonymous',
              role: user.email === 'dereklamson24@gmail.com' ? 'admin' : 'pending',
              createdAt: serverTimestamp(),
              status: 'active',
              isOnline: true,
              lastSeen: serverTimestamp(),
            };
            await setDoc(userDocRef, userData);
          }
          setUserProfile(userData as User);
        } else {
          if (currentUser) {
            try {
              await updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() });
            } catch (e) {
              console.error("Error updating offline status", e);
            }
          }
          setCurrentUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'users');
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    
    const interval = setInterval(() => {
      updateDoc(doc(db, 'users', currentUser.uid), { lastSeen: serverTimestamp(), isOnline: true }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`));
    }, 60000); // Update every minute

    const handleBeforeUnload = () => {
      // This might not always work reliably, but it's a best effort
      updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }).catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      alert("Login failed. Please try again.");
    }
  };

  const logout = async () => {
    try {
      if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() });
      }
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser?.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
