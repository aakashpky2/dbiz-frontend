import { redirect } from 'next/navigation';

export default function GovernmentFeesRedirectPage() {
    redirect('/dashboard/admin/rate-card?tab=government-fees');
}
