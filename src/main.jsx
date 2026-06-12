import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { HouseholdProvider } from './context/HouseholdContext';

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <HouseholdProvider>
      <App />
    </HouseholdProvider>
  </React.StrictMode>
);
