import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../AuthContext';
import { useWebSocket } from './WebSocketContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [orderCounts, setOrderCounts] = useState({ cashierCount: 0, warehouseCount: 0, serviceCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useContext(AuthContext);
  const { socket, isConnected, on, off } = useWebSocket();
  const previousWarehouseCountRef = useRef(0);
  const audioRef = useRef(null);
  
  // Fallback: Keep polling refs for fallback mode
  const pollingIntervalRef = useRef(null);
  const isFetchingRef = useRef(false);
  const useWebSocketMode = useRef(true); // Flag to track if we're using WebSocket

  // Initialize audio for notification sound
  useEffect(() => {
    // Create a simple "ding" sound using Web Audio API
    const createDingSound = async () => {
      try {
        // Get or create audio context
        let audioContext = audioRef.current?.context;
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          audioRef.current = { ...audioRef.current, context: audioContext };
        }

        // Ensure audio context is running (required by browsers after user interaction)
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Wait a tiny bit to ensure context is ready
        if (audioContext.state !== 'running') {
          console.warn('Audio context not ready, skipping sound');
          return;
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // Frequency in Hz (higher = higher pitch)
        oscillator.type = 'sine'; // Sine wave for a clean tone

        // Envelope: quick attack, sustain, then fade out
        const now = audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Quick attack
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1); // Sustain
        gainNode.gain.linearRampToValueAtTime(0, now + 0.3); // Fade out

        oscillator.start(now);
        oscillator.stop(now + 0.3); // Duration: 300ms
      } catch (error) {
        console.warn('Could not play notification sound:', error);
      }
    };

    audioRef.current = { play: createDingSound };
  }, []);

  // Update order counts from WebSocket or API (fallback)
  const updateOrderCounts = useCallback((newCounts) => {
    // Check if warehouse count increased (new order detected)
    const previousCount = previousWarehouseCountRef.current;
    
    // Dispatch event for warehouse count changes (both increase and decrease)
    if (newCounts.warehouseCount !== previousCount) {
      // New warehouse order detected - play sound only on increase
      if (newCounts.warehouseCount > previousCount && previousCount >= 0) {
        try {
          if (audioRef.current && audioRef.current.play) {
            // Play sound asynchronously to not block the UI
            audioRef.current.play().catch(err => {
              console.warn('Could not play notification sound:', err);
            });
          }
        } catch (error) {
          console.warn('Could not play notification sound:', error);
        }
      }
      
      // Dispatch event to notify Warehouse component to refresh
      window.dispatchEvent(new CustomEvent('warehouseOrderCountChanged', {
        detail: { count: newCounts.warehouseCount, previousCount }
      }));
    }

    // Also dispatch event for cashier count changes
    const previousCashierCount = orderCounts.cashierCount;
    if (newCounts.cashierCount !== previousCashierCount) {
      window.dispatchEvent(new CustomEvent('cashierOrderCountChanged', {
        detail: { count: newCounts.cashierCount, previousCount: previousCashierCount }
      }));
    }

    // Dispatch event for service count changes
    const previousServiceCount = orderCounts.serviceCount || 0;
    if (newCounts.serviceCount !== previousServiceCount) {
      window.dispatchEvent(new CustomEvent('serviceOrderCountChanged', {
        detail: { count: newCounts.serviceCount, previousCount: previousServiceCount }
      }));
    }

    previousWarehouseCountRef.current = newCounts.warehouseCount;
    setOrderCounts(newCounts);
    setIsLoading(false);
  }, [orderCounts]);

  // Fallback: Fetch order counts from API (if WebSocket fails)
  const fetchOrderCounts = useCallback(async () => {
    if (!isAuthenticated) return;
    
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/notifications/order-counts', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const newCounts = {
          cashierCount: response.data.cashierCount || 0,
          warehouseCount: response.data.warehouseCount || 0,
          serviceCount: response.data.serviceCount || 0
        };
        updateOrderCounts(newCounts);
      }
    } catch (error) {
      console.error('Error fetching order counts (fallback):', error);
      setIsLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, updateOrderCounts]);

  // WebSocket: Listen for real-time order count updates
  useEffect(() => {
    if (!isAuthenticated || !socket) {
      // Fallback to polling if WebSocket not available
      if (isAuthenticated && !isConnected) {
        console.log('⚠️ WebSocket not connected, using polling fallback');
        useWebSocketMode.current = false;
        
        // Initial fetch
        fetchOrderCounts();
        
        // Set up polling as fallback
        pollingIntervalRef.current = setInterval(() => {
          fetchOrderCounts();
        }, 7000);
        
        return () => {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        };
      }
      return;
    }

    // WebSocket is connected - use real-time updates
    useWebSocketMode.current = true;
    console.log('🔌 Using WebSocket for real-time updates');
    
    // Clear any polling intervals
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Listen for order count updates from server
    const handleOrderCountsUpdate = (data) => {
      if (data.success) {
        const newCounts = {
          cashierCount: data.cashierCount || 0,
          warehouseCount: data.warehouseCount || 0,
          serviceCount: data.serviceCount || 0
        };
        updateOrderCounts(newCounts);
      }
    };

    // Request initial counts when connected
    if (isConnected) {
      socket.emit('request-order-counts');
    }

    // Set up WebSocket listener
    on('order-counts-updated', handleOrderCountsUpdate);

    // Cleanup
    return () => {
      off('order-counts-updated', handleOrderCountsUpdate);
    };
  }, [isAuthenticated, socket, isConnected, on, off, updateOrderCounts, fetchOrderCounts]);

  // Cleanup on unmount or auth change
  useEffect(() => {
    if (!isAuthenticated) {
      setOrderCounts({ cashierCount: 0, warehouseCount: 0, serviceCount: 0 });
      setIsLoading(false);
      previousWarehouseCountRef.current = 0;
      
      // Clear polling if active
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  }, [isAuthenticated]);

  const value = {
    orderCounts,
    isLoading,
    refresh: fetchOrderCounts
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;

