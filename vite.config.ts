import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "Boss直聘自动投递助手",
        namespace: "https://github.com/muyuniao/boss-auto-apply",
        version: "0.2.0",
        description:
          "在 Boss 直聘职位列表页按筛选规则自动批量发起沟通。支持关键词/薪资/活跃度过滤,内置长尾延迟降低风控概率。",
        author: "muyuniao",
        match: [
          "https://www.zhipin.com/web/geek/job*",
          "https://www.zhipin.com/web/geek/jobs*",
          "https://www.zhipin.com/web/geek/job-recommend*",
          "https://www.zhipin.com/web/geek/overseas*",
        ],
        grant: [
          "GM_getValue",
          "GM_setValue",
          "GM_addStyle",
          "GM_registerMenuCommand",
          "GM_notification",
        ],
        connect: ["www.zhipin.com"],
        license: "MIT",
      },
      build: {
        fileName: "boss-auto-apply.user.js",
        autoGrant: true,
      },
    }),
  ],
});
