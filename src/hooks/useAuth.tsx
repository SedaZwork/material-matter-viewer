import { useState, useEffect } from 'react';

// Define a user type that matches the expected data from WordPress
interface WordpressUser {
  id: number;
  email: string;
  // Add other fields you might pass from WordPress
}

// This is a placeholder for the user data that will be injected by WordPress
// We'll access it from the window object
declare global {
  interface Window {
    wordpressUser?: WordpressUser;
  }
}

export const useAuth = () => {
  const [user, setUser] = useState<WordpressUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUserReady = () => {
      if (window.wordpressUser) {
        setUser(window.wordpressUser);
      }
      setLoading(false);
    };

    // Check for user data immediately
    handleUserReady();

    // Listen for a custom event that signals user data is ready
    window.addEventListener('wordpressUserReady', handleUserReady);

    return () => {
      window.removeEventListener('wordpressUserReady', handleUserReady);
    };
  }, []);

  // Sign-in and sign-up are handled by WordPress, so these functions are no longer needed.
  // The signOut function will redirect to the WordPress logout URL.
  const signOut = async () => {
    // Redirect to the WordPress logout URL.
    // You might need to configure this URL in your WordPress settings.
    window.location.href = '/wp-login.php?action=logout';
  };

  return {
    user,
    loading,
    signOut
  };
};