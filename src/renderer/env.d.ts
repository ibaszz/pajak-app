/// <reference types="vite/client" />
import type { PajakAPI } from '../main/preload';

declare global {
  interface Window {
    api: PajakAPI;
  }
}

export {};
