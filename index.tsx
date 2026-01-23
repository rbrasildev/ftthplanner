
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './LanguageContext';
import { ThemeProvider } from './ThemeContext';
import { HelmetProvider } from 'react-helmet-async';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);
// Register Service Worker for Map Caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/map-sw.js')
      .then(registration => console.log('Map SW registered'))
      .catch(err => console.log('Map SW registration failed: ', err));
  });
}
