'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface SpreadsheetListItem {
  id: string;
  name: string;
  modifiedTime: string;
  owners?: { emailAddress: string; displayName?: string }[];
}

interface GoogleSheetPickerProps {
  workspaceId: string;
  onSelect: (spreadsheet: SpreadsheetListItem) => void;
  onCancel: () => void;
}

// Declare gapi and google types
declare global {
  interface Window {
    gapi: {
      load: (api: string, config: { callback: () => void; onerror?: () => void } | (() => void)) => void;
      client: {
        init: (config: { apiKey?: string; discoveryDocs?: string[] }) => Promise<void>;
        getToken: () => { access_token: string } | null;
        setToken: (token: { access_token: string }) => void;
      };
    };
    google: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: {
          SPREADSHEETS: string;
        };
        Action: {
          PICKED: string;
          CANCEL: string;
        };
        DocsView: new (viewId: string) => GoogleDocsView;
      };
    };
  }
}

interface GooglePickerBuilder {
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setAppId: (appId: string) => GooglePickerBuilder;
  addView: (view: GoogleDocsView) => GooglePickerBuilder;
  setCallback: (callback: (data: GooglePickerResponse) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

interface GoogleDocsView {
  setMimeTypes: (mimeTypes: string) => GoogleDocsView;
  setIncludeFolders: (include: boolean) => GoogleDocsView;
  setSelectFolderEnabled: (enabled: boolean) => GoogleDocsView;
}

interface GooglePickerResponse {
  action: string;
  docs?: Array<{
    id: string;
    name: string;
    mimeType: string;
    lastEditedUtc: number;
  }>;
}

// Script loading state
let gapiScriptLoaded = false;
let gapiClientLoaded = false;
let pickerLoaded = false;

function loadGapiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (gapiScriptLoaded && window.gapi) {
      resolve();
      return;
    }

    // Check if script tag exists but gapi not ready yet
    const existingScript = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
    if (existingScript) {
      // Wait for gapi to be available
      const checkGapi = setInterval(() => {
        if (window.gapi) {
          clearInterval(checkGapi);
          gapiScriptLoaded = true;
          resolve();
        }
      }, 50);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkGapi);
        reject(new Error('Timeout waiting for Google API to load'));
      }, 10000);
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Wait for gapi object to be available
      const checkGapi = setInterval(() => {
        if (window.gapi) {
          clearInterval(checkGapi);
          gapiScriptLoaded = true;
          resolve();
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkGapi);
        reject(new Error('Timeout waiting for Google API object'));
      }, 5000);
    };
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.head.appendChild(script);
  });
}

async function loadGoogleApis(): Promise<void> {
  // First, ensure the script is loaded
  await loadGapiScript();

  // Load GAPI client
  if (!gapiClientLoaded) {
    await new Promise<void>((resolve, reject) => {
      try {
        window.gapi.load('client', {
          callback: () => {
            gapiClientLoaded = true;
            resolve();
          },
          onerror: () => reject(new Error('Failed to load gapi client')),
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // Load Picker
  if (!pickerLoaded) {
    await new Promise<void>((resolve, reject) => {
      try {
        window.gapi.load('picker', {
          callback: () => {
            pickerLoaded = true;
            resolve();
          },
          onerror: () => reject(new Error('Failed to load picker')),
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

export function GoogleSheetPicker({
  workspaceId,
  onSelect,
  onCancel,
}: GoogleSheetPickerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [pickerOpened, setPickerOpened] = useState(false);
  const pickerRef = useRef<{ setVisible: (visible: boolean) => void } | null>(null);

  // Load Google APIs and get access token
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      setError(null);

      try {
        // Load Google Picker API
        await loadGoogleApis();

        // Get access token from our API
        const response = await fetch(`/api/google/picker-token?workspace_id=${workspaceId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to get access token');
        }

        const data = await response.json();

        if (!cancelled) {
          setAccessToken(data.accessToken);
          setClientId(data.clientId);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize Google Picker');
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const openPicker = useCallback(() => {
    if (!accessToken || !clientId) {
      setError('Not ready to open picker');
      return;
    }

    // Don't open if already opened
    if (pickerRef.current) {
      pickerRef.current.setVisible(true);
      return;
    }

    try {
      // Create a view for spreadsheets only
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS)
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false);

      // Build the picker
      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setAppId(clientId.split('-')[0]) // Extract project number from client ID
        .addView(view)
        .setCallback((data: GooglePickerResponse) => {
          if (data.action === window.google.picker.Action.PICKED && data.docs && data.docs.length > 0) {
            const doc = data.docs[0];
            // Hide the picker immediately
            pickerRef.current?.setVisible(false);
            pickerRef.current = null;
            // Call onSelect
            onSelect({
              id: doc.id,
              name: doc.name,
              modifiedTime: new Date(doc.lastEditedUtc).toISOString(),
            });
          } else if (data.action === window.google.picker.Action.CANCEL) {
            // User cancelled - hide picker and call onCancel
            pickerRef.current?.setVisible(false);
            pickerRef.current = null;
            onCancel();
          }
        })
        .build();

      pickerRef.current = picker;
      picker.setVisible(true);
      setPickerOpened(true);
    } catch (err) {
      console.error('Error opening picker:', err);
      setError(err instanceof Error ? err.message : 'Failed to open Google Picker');
    }
  }, [accessToken, clientId, onSelect, onCancel]);

  // Auto-open picker once when ready
  useEffect(() => {
    if (!isLoading && accessToken && clientId && !error && !pickerOpened) {
      openPicker();
    }
  }, [isLoading, accessToken, clientId, error, pickerOpened, openPicker]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-8 text-center">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--color-gray-600)]">Loading Google Picker...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-[var(--color-error)] shadow-sm p-6">
        <div className="text-center mb-4">
          <div className="w-12 h-12 bg-[var(--color-error)]/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-[var(--color-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-[var(--color-error)]">{error}</p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={openPicker}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Show a placeholder while the picker modal is open
  return (
    <div className="bg-white rounded-xl border border-[var(--color-gray-200)] shadow-sm p-6">
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-[#0F9D58]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#0F9D58]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zm4-8h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6z"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[var(--color-gray-900)] mb-2">
          Select a Google Sheet
        </h3>
        <p className="text-[var(--color-gray-600)] mb-6 max-w-md mx-auto">
          Choose a spreadsheet from the Google Picker window.
          If the picker didn&apos;t open, click the button below.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={openPicker}>
            Open Google Picker
          </Button>
        </div>
      </div>
    </div>
  );
}
