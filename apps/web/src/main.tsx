import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
// Design system styles are global: imported here (not only via the barrel), because the
// bundler drops a barrel's side-effect imports when only some of its exports are used.
import './design-system/tokens.css';
import './design-system/base.css';
import './design-system/components.css';
import './design-system/organisms.css';
import './design-system/docs.css';
import { LocaleProvider, Toaster, TooltipProvider, applyTheme, readTheme } from './design-system';
import { App } from './App';

// Apply the saved theme before the first render to avoid a flash.
applyTheme(readTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
    <TooltipProvider>
      <App />
      <Toaster />
    </TooltipProvider>
    </LocaleProvider>
  </StrictMode>,
);
