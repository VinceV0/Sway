import React from 'react';
import ReactDOM from 'react-dom/client';
import HomePage from './pages/HomePage'; // Updated path pointing to the pages folder

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HomePage />
  </React.StrictMode>
);