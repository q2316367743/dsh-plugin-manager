import {createRouter, createWebHashHistory, RouteRecordRaw} from 'vue-router';

export const routes: Array<RouteRecordRaw> = [
  {
    name: '首页',
    path: '/',
    component: () => import('@/pages/redirect/RedirectHome.vue')
  },
  {
    name: '引导',
    path: '/setup',
    component: () => import('@/pages/setup/index.vue')
  },
  {
    name: '平台',
    path: '/profile/:name',
    component: () => import('@/pages/profile/index.vue')
  },
  {
    name: '设置',
    path: '/settings',
    component: () => import('@/pages/settings/index.vue')
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});
