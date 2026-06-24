import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUserDoc = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        toast('Vui lòng tải xuống và chạy Synapse Worker để xử lý tác vụ nội bộ', { duration: 4000 });
        
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        const isSuperAdmin = user.email === 'synapse@admin.com';

        if (!userSnap.exists()) {
          const newUser = {
            email: user.email,
            displayName: user.displayName || 'Unknown',
            role: isSuperAdmin ? 'admin' : 'user',
            isLocked: false,
            balance: 0,
            createdAt: new Date().toISOString()
          };
          await setDoc(userRef, newUser);
          setIsAdmin(isSuperAdmin);
          setUserData(newUser);
        } else {
          const data = userSnap.data();
          setIsAdmin(data.role === 'admin' || isSuperAdmin);
          setUserData(data);
        }

        // Lắng nghe realtime dữ liệu user (balance, role, isLocked)
        unsubUserDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setIsAdmin(data.role === 'admin' || isSuperAdmin);

            if (data.isLocked && !isSuperAdmin && data.role !== 'admin') {
              auth.signOut();
              setCurrentUser(null);
              setUserData(null);
              setIsAdmin(false);
              toast.error("Tài khoản của bạn đã bị Admin khóa.");
            }
          }
        });

      } else {
        setCurrentUser(null);
        setUserData(null);
        setIsAdmin(false);
        if (unsubUserDoc) unsubUserDoc();
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userData, isAdmin }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
