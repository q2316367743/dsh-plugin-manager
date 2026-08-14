// vite.config.js
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import {defineConfig} from "vite";
import path from "path";
import UnoCSS from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite';
import {TDesignResolver} from 'unplugin-vue-components/resolvers';
import wails from '@wailsio/runtime/plugins/vite';

function _resolve(dir: string) {
  return path.resolve(__dirname, dir);
}

export default defineConfig({
  resolve: {
    alias: {
      "@": _resolve("src")
    },
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
  plugins: [
    vue(), vueJsx(), UnoCSS(),
    AutoImport({
      resolvers: [TDesignResolver({
        library: 'vue-next'
      })],
      imports: ['vue', '@vueuse/core', 'vue-router'],
      eslintrc: {
        enabled: true
      }
    }),
    Components({
      resolvers: [
        TDesignResolver({
          library: 'vue-next'
        })
      ]
    }),
    wails('./bindings')
  ],
  base: "/",
  build: {
    outDir: "dist"
  },

});
