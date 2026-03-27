import { useLocation } from 'react-router-dom';

export default function PlaceholderPage() {
  const location = useLocation();
  const name = location.pathname.split('/').pop() || '';
  const title = name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ');

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">This section will be built in a future prompt.</p>
    </div>
  );
}
