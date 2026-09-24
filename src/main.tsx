import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AiProviderProvider} from './context/AiProviderContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AiProviderProvider>
      <App />
    </AiProviderProvider>
  </StrictMode>,
);
