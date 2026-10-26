import React from 'react';
const LocalApp = React.lazy(() => import('./App'));
const SetupApp = React.lazy(() => import('./auth/SetupApp'));
export default function Entry() {
  const url = import.meta.env.VITE_API_URL;
  return <React.Suspense fallback={<div role="status" className="p-8">正在加载 mc…</div>}>
    {url ? <SetupApp key={url} url={url} /> : <LocalApp />}
  </React.Suspense>;
}
