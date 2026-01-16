'use client';

import { useState, useEffect, useRef } from 'react';
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
import smartcrop from 'smartcrop';

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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Smart crop image to square, centered on face
  const smartCropImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          // Determine the crop size (square, max 512px for avatars)
          const size = Math.min(img.width, img.height, 512);

          // Use smartcrop to find the best crop region
          const result = await smartcrop.crop(img, { width: size, height: size });
          const crop = result.topCrop;

          // Create canvas and draw cropped image
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(file); // Fallback to original
            return;
          }

          // Draw the cropped region
          ctx.drawImage(
            img,
            crop.x, crop.y, crop.width, crop.height,
            0, 0, size, size
          );

          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob) {
              const croppedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(croppedFile);
            } else {
              resolve(file); // Fallback to original
            }
          }, 'image/jpeg', 0.9);
        } catch {
          resolve(file); // Fallback to original on error
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please use PNG, JPEG, GIF, or WebP.');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2MB.');
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Smart crop the image (centers on face)
      const croppedFile = await smartCropImage(file);

      const formData = new FormData();
      formData.append('file', croppedFile);

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload avatar');
      }

      const data = await response.json();
      setProfile(prev => prev ? { ...prev, avatar_url: data.avatar_url } : null);
      toast.success('Avatar uploaded successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;

    setIsUploadingAvatar(true);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove avatar');
      }

      setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
      toast.success('Avatar removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove avatar');
    } finally {
      setIsUploadingAvatar(false);
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
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />

            {/* Clickable avatar */}
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isUploadingAvatar}
              className="relative w-20 h-20 bg-[var(--color-gray-200)] rounded-full flex items-center justify-center overflow-hidden group hover:ring-2 hover:ring-[var(--color-primary)] hover:ring-offset-2 transition-all disabled:opacity-50"
            >
              {isUploadingAvatar ? (
                <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              ) : profile.avatar_url ? (
                <>
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="w-20 h-20 object-cover"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-3xl font-medium text-[var(--color-gray-500)] group-hover:opacity-0 transition-opacity">
                    {(name || profile.email || '?')[0].toUpperCase()}
                  </span>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-[var(--color-gray-300)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-[var(--color-gray-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </>
              )}
            </button>

            <div className="flex-1">
              <p className="text-sm text-[var(--color-gray-600)] mb-2">
                Click on the photo to upload a new one
              </p>
              <p className="text-xs text-[var(--color-gray-500)]">
                PNG, JPEG, GIF, or WebP. Max 2MB.
              </p>
              {profile.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingAvatar}
                  className="mt-2 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
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
