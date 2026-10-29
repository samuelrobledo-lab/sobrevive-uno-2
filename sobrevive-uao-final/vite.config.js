import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Rutas relativas: permite publicar en GitHub Pages (usuario.github.io/repo/) o abrir desde cualquier carpeta
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      // Nombres fijos (sin hash): el index.html de la raíz del repositorio de GitHub carga siempre los mismos archivos.
      // Ese index.html pide los nombres de la primera publicación (index-DN4BowaK.js / index-CNpBMQYb.css):
      // `npm run build:pages` crea index-DN4BowaK.js como una sola línea que importa index.js (nunca una copia:
      // el simulador importa index.js y con dos copias habría dos React) y copia index.css con el nombre viejo.
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
