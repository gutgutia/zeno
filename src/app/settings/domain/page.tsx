import { redirect } from 'next/navigation';

// Domain settings have been consolidated into the Branding page
export default function DomainSettingsPage() {
  redirect('/settings/branding');
}
