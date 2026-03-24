import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, Role } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  loginError: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    console.log("AuthProvider mounted, setting up auth listener");
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user ? `${user.email} (${user.uid})` : "Logged out");
      
      if (unsubscribeProfile) {
        console.log("Cleaning up previous profile listener");
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        setCurrentUser(user);
        const userDocRef = doc(db, 'users', user.uid);
        
        console.log("Setting up profile listener for:", user.uid);
        unsubscribeProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            console.log("Profile data received, role:", userData.role);
            
            // Handle admin upgrade if needed
            if (user.email === 'dereklamson24@gmail.com' && userData.role !== 'admin') {
              console.log("Upgrading dereklamson24@gmail.com to admin role");
              try {
                await updateDoc(userDocRef, { role: 'admin' });
              } catch (e) {
                console.error("Failed to upgrade admin role:", e);
              }
            }
            
            setUserProfile(userData);
            setLoading(false);
          } else {
            console.log("No profile found, creating initial profile");
            const newUserData = {
              uid: user.uid,
              email: user.email || '',
              name: user.displayName || 'Anonymous',
              role: user.email === 'dereklamson24@gmail.com' ? 'admin' : 'pending',
              createdAt: serverTimestamp(),
              status: 'active',
              isOnline: true,
              lastSeen: serverTimestamp(),
            };
            try {
              await setDoc(userDocRef, newUserData);
              console.log("Initial profile created successfully");
            } catch (e) {
              console.error("Failed to create initial profile:", e);
              handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`);
            }
          }
        }, (error) => {
          console.error("Profile listener error details:", error);
          // Don't throw here to avoid crashing the whole app, but log it
          if (error.code === 'permission-denied') {
            console.warn("Permission denied for profile listener. This might happen during initial setup.");
          } else {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
          setLoading(false);
        });

        // Update online status
        updateDoc(userDocRef, { isOnline: true, lastSeen: serverTimestamp() }).catch(e => {
          console.warn("Could not update online status (normal if profile doesn't exist yet):", e.message);
        });
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    }, (error) => {
      console.error("Auth state listener error:", error);
      setLoginError("Authentication service error. Please try again later.");
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
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
    setLoginError(null);
    try {
      console.log("Initiating Google Login");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log("Google Login successful");
    } catch (error: any) {
      console.error("Login failed", error);
      let message = "Login failed. Please try again.";
      if (error.code === 'auth/popup-closed-by-user') {
        message = "Login popup was closed. Please try again.";
      } else if (error.code === 'auth/network-request-failed') {
        message = "Network error. Please check your connection.";
      }
      setLoginError(message);
    }
  };

  const logout = async () => {
    try {
      console.log("Initiating logout");
      if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() });
      }
      await signOut(auth);
      console.log("Logout successful");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const clearError = () => setLoginError(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 animate-pulse">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, loginError, loginWithGoogle, logout, clearError }}>
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
