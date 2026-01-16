'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');

  // Fetch profile data
  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch('/api/profile');
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();
        setProfile(data);
        setName(data.name || '');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-gray-500)]">Failed to load profile.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-gray-900)]">
          Profile Settings
        </h1>
        <p className="text-[var(--color-gray-600)] mt-1">
          Manage your personal information
        </p>
      </div>

      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Your profile picture is shown across Zeno
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-[var(--color-gray-200)] rounded-full flex items-center justify-center overflow-hidden">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-20 h-20 object-cover"
                />
              ) : (
                <span className="text-3xl font-medium text-[var(--color-gray-500)]">
                  {(name || profile.email || '?')[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-sm text-[var(--color-gray-500)]">
              Profile pictures are automatically synced from your Google account when you sign in with Google.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Your name and email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
            <p className="text-xs text-[var(--color-gray-500)]">
              This is how your name will appear to other team members
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              value={profile.email}
              disabled
              className="bg-[var(--color-gray-50)]"
            />
            <p className="text-xs text-[var(--color-gray-500)]">
              Your email address cannot be changed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Details about your Zeno account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Account ID</dt>
              <dd className="font-mono text-[var(--color-gray-700)]">{profile.id.slice(0, 8)}...</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-gray-500)]">Member since</dt>
              <dd className="text-[var(--color-gray-700)]">
                {new Date(profile.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </dd>
            </div>
            {profile.updated_at && (
              <div className="flex justify-between">
                <dt className="text-[var(--color-gray-500)]">Last updated</dt>
                <dd className="text-[var(--color-gray-700)]">
                  {new Date(profile.updated_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={isSaving || name === (profile.name || '')}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
