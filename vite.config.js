import { defineConfig } from 'vite';

// 使用相对路径 base: './'，确保部署至 GitHub Pages 子路径、Cloudflare Pages、EdgeOne Pages 等任意平台时模型与资源 100% 正常加载
export default defineConfig({
  base: './',
});
