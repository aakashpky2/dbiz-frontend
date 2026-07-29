
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/login');
  // The rest of the original HomePage component will not be rendered due to the redirect.
  // We can leave it or remove it, but for clarity, it's best to keep the file minimal.
  // It's good practice to return null or an empty fragment if the component logic
  // could theoretically continue after a redirect, though redirect() will terminate rendering.
  return null;
}
