"use client";

import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { showToast } from '@/lib/toast';

export function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  useEffect(() => {
    if (wasOffline && isOnline) {
      showToast.success('You are back online!');
    } else if (!isOnline) {
      showToast.warning('You are currently offline. Some features may be limited.');
    }
  }, [isOnline, wasOffline]);

  if (isOnline) return null;

  return (
    <div className="border border-orange-200 bg-orange-50 p-4 rounded-lg">
      <div className="flex items-center space-x-2">
        <WifiOff className="h-4 w-4 text-orange-600" />
        <p className="text-orange-800 text-sm">
          You are currently offline. Some features may be limited until your connection is restored.
        </p>
      </div>
    </div>
  );
}

export function OnlineIndicator() {
  const { isOnline } = useOnlineStatus();

  return (
    <div className="flex items-center gap-2">
      {isOnline ? (
        <Wifi className="h-4 w-4 text-green-600" />
      ) : (
        <WifiOff className="h-4 w-4 text-red-600" />
      )}
      <span className={`text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}