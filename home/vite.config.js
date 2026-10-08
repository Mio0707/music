import {defineConfig} from 'vite';
export default defineConfig({
  base:'./',
  publicDir:'public',
  build:{outDir:'dist',emptyOutDir:true},
  server:{port:5173,strictPort:true},
});
