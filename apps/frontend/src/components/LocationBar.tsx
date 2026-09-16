'use client';

import { useDeviceLocation } from '@/lib/useDeviceLocation';

// The manual-override path (the pencil, opening window.prompt) must stay
// reachable from every status — docs/shopassist-ui-plan.md §5.3 requires
// location to stay editable no matter how it was resolved.
export function LocationBar() {
  const { status, location, requestLocation, setManualLocation } = useDeviceLocation();

  const handleManualEdit = () => {
    const current = location?.formattedAddress ?? '';
    const next = window.prompt('Update delivery pincode / area', current);
    if (next && next.trim()) setManualLocation(next.trim());
  };

  const pencil = (
    <button
      type="button"
      onClick={handleManualEdit}
      aria-label="Edit delivery location"
      className="text-ink/40"
    >
      ✎
    </button>
  );

  if (status === 'requesting' || status === 'resolving') {
    return (
      <div className="flex items-center gap-1.5 text-sm font-semibold text-ink/70">
        <span aria-hidden="true">📍</span>
        Finding you…
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber">
        <span aria-hidden="true">📍</span>
        <span className="flex-1">Location access is off — enter it manually.</span>
        {pencil}
      </div>
    );
  }

  if (status === 'unavailable' || status === 'timeout' || status === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-error-bg px-3 py-2 text-sm text-error">
        <span aria-hidden="true">📍</span>
        <span className="flex-1">Couldn&apos;t find your location.</span>
        <button type="button" onClick={requestLocation} className="font-bold underline">
          Retry
        </button>
        {pencil}
      </div>
    );
  }

  if (status === 'resolved' && location) {
    return (
      <button
        type="button"
        onClick={handleManualEdit}
        className="flex items-center gap-1.5 text-sm font-bold text-accent"
      >
        <span aria-hidden="true">📍</span>
        {location.formattedAddress}
        <span aria-hidden="true" className="text-ink/40">
          ✎
        </span>
      </button>
    );
  }

  if (status === 'unsupported') {
    return (
      <button
        type="button"
        onClick={handleManualEdit}
        className="flex items-center gap-1.5 text-sm font-bold text-accent"
      >
        <span aria-hidden="true">📍</span>
        Set your location
      </button>
    );
  }

  // idle — first-time affordance
  return (
    <button
      type="button"
      onClick={requestLocation}
      className="flex items-center gap-1.5 text-sm font-bold text-accent"
    >
      <span aria-hidden="true">📍</span>
      Use my location
    </button>
  );
}
