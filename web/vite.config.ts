import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Local: abra http://financeos.localhost:5173 (mesmo site do login em auth.financeos.localhost).
  server: { port: 5173, strictPort: true, allowedHosts: ['financeos.localhost'] },
});
