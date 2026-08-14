import { createApp } from 'vue'
import { createPinia } from 'pinia';
import App from './App.vue'
import {router} from './plugin/router';
import { useDshStore } from '@/store/dsh';

import 'virtual:uno.css'
import '@/assets/style/global.less';

/**
 * 先完成 dsh store 初始化（profiles / dsh 解析 / 服务状态）再挂载，
 * 保证首次渲染前路由重定向（/setup 或首页）的依据已就绪。
 */
async function bootstrap() {
  const app = createApp(App)
  app.use(createPinia())
  const store = useDshStore()
  await store.init()
  app.use(router)
  app.mount('#app')
}

bootstrap();
