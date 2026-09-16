'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getStoredLocation,
  reverseGeocode,
  setStoredLocation,
  StoredLocation,
} from '@/lib/locationClient';

export type LocationStatus =
  | 'idle'
  | 'unsupported'
  | 'requesting'
  | 'resolving'
  | 'resolved'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'error';

interface UseDeviceLocationResult {
  status: LocationStatus;
  location: StoredLocation | null;
  errorMessage: string | null;
  requestLocation: () => void;
  setManualLocation: (input: string) => void;
}

export function useDeviceLocation(): UseDeviceLocationResult {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredLocation();
    if (stored) {
      setLocation(stored);
      setStatus('resolved');
      return;
    }

    // Progressive enhancement: where the Permissions API is available (not
    // consistently on Safari), tell "never asked" apart from "already
    // denied" up front, so the UI doesn't have to wait for a wasted click
    // to show the right affordance.
    if (!navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (result.state === 'denied') setStatus('denied');
      })
      .catch(() => {});
  }, []);

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }

    setErrorMessage(null);
    setStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('resolving');
        const { latitude: lat, longitude: lng } = position.coords;

        try {
          const result = await reverseGeocode(lat, lng);
          if (!result.ok) {
            setErrorMessage(result.error ?? 'Could not resolve your location.');
            setStatus('error');
            return;
          }

          const resolved: StoredLocation = {
            pincode: result.pincode ?? null,
            area: result.area ?? null,
            formattedAddress: result.formattedAddress || '',
            lat,
            lng,
            source: 'gps',
            resolvedAt: Date.now(),
          };
          setStoredLocation(resolved);
          setLocation(resolved);
          setStatus('resolved');
        } catch {
          setErrorMessage('Network error while resolving your location.');
          setStatus('error');
        }
      },
      (error) => {
        // A transient failure shouldn't blank an already-resolved location —
        // only the status changes, `location` (and its cached value) stays.
        if (error.code === error.PERMISSION_DENIED) setStatus('denied');
        else if (error.code === error.POSITION_UNAVAILABLE) setStatus('unavailable');
        else if (error.code === error.TIMEOUT) setStatus('timeout');
        else setStatus('error');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const setManualLocation = useCallback((input: string) => {
    const manual: StoredLocation = {
      pincode: null,
      area: null,
      formattedAddress: input,
      lat: null,
      lng: null,
      source: 'manual',
      resolvedAt: Date.now(),
    };
    setStoredLocation(manual);
    setLocation(manual);
    setStatus('resolved');
    setErrorMessage(null);
  }, []);

  return { status, location, errorMessage, requestLocation, setManualLocation };
}
