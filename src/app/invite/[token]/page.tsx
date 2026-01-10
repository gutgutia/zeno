'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Users, Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';

interface InvitationDetails {
  email: string;
  role: string;
  organization: {
    name: string;
    slug: string;
  };
  expires_at: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);

  // Check auth state and fetch invitation details
  useEffect(() => {
    async function init() {
      const supabase = createClient();

      // Check if user is logged in
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({ email: authUser.email || '' });
      }

      // Fetch invitation details
      try {
        const res = await fetch(`/api/invitations/accept?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Invalid invitation');
        } else {
          setInvitation(data);
        }
      } catch {
        setError('Failed to load invitation details');
      }

      setLoading(false);
    }

    init();
  }, [token]);

  // Store token in localStorage for post-login acceptance
  useEffect(() => {
    if (token && invitation) {
      localStorage.setItem('pendingInviteToken', token);
    }
  }, [token, invitation]);

  // Check for pending invite after auth state changes
  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser({ email: session.user.email || '' });

        // Check for pending invite
        const pendingToken = localStorage.getItem('pendingInviteToken');
        if (pendingToken === token) {
          // Auto-accept the invitation
          handleAccept();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation');
      } else {
        localStorage.removeItem('pendingInviteToken');
        setSuccess(data.message);

        // Redirect to dashboards after a short delay
        setTimeout(() => {
          router.push('/dashboards');
        }, 2000);
      }
    } catch {
      setError('Failed to accept invitation');
    }

    setAccepting(false);
  };

  const handleLogin = () => {
    // Redirect to auth with return URL
    router.push(`/auth?redirect=/invite/${token}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Invalid Invitation
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => router.push('/')} variant="outline">
              Go to Homepage
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Welcome to the Team!
            </h1>
            <p className="text-gray-600 mb-2">{success}</p>
            <p className="text-sm text-gray-500">Redirecting to your dashboards...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
            <Users className="h-10 w-10 text-white mx-auto mb-3" />
            <h1 className="text-xl font-semibold text-white">Team Invitation</h1>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="text-center mb-6">
              <p className="text-gray-600">
                You've been invited to join
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {invitation?.organization.name}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                as a <span className="font-medium capitalize">{invitation?.role}</span>
              </p>
            </div>

            {/* Invitation for email */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Invitation sent to</p>
                  <p className="text-sm font-medium text-gray-900">
                    {invitation?.email}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4 text-sm">
                {error}
              </div>
            )}

            {user ? (
              // User is logged in
              <div>
                {user.email.toLowerCase() === invitation?.email.toLowerCase() ? (
                  <Button
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full"
                    size="lg"
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Accept Invitation'
                    )}
                  </Button>
                ) : (
                  <div className="text-center">
                    <p className="text-amber-700 bg-amber-50 rounded-lg p-3 mb-4 text-sm">
                      You're logged in as <strong>{user.email}</strong>, but this
                      invitation was sent to <strong>{invitation?.email}</strong>.
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Please log out and sign in with the correct email to accept this invitation.
                    </p>
                    <Button
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        setUser(null);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Sign Out
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              // User is not logged in
              <div>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Sign in or create an account with <strong>{invitation?.email}</strong> to join the team.
                </p>
                <Button onClick={handleLogin} className="w-full" size="lg">
                  Continue with Email
                </Button>
              </div>
            )}

            {/* Expiry notice */}
            <p className="text-xs text-gray-400 text-center mt-6">
              This invitation expires on{' '}
              {invitation?.expires_at
                ? new Date(invitation.expires_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'soon'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
