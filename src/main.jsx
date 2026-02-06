import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Reset styles
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  body { background: #0a0a0b; color: #e8e8e8; }
  input, textarea, button { font-family: inherit; }
  #root { min-height: 100vh; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
