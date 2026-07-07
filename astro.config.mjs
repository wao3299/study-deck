import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://wao3299.github.io',
  base: '/aws_learning',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
