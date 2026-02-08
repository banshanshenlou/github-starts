# GitHub Stars Manager

[English](README.md)

## 简介
GitHub Stars Manager 是一个浏览器扩展，用于在 GitHub 页面内增强星标仓库管理：分组、标签、备注，以及通过 Gist 在多设备间同步元数据。

## 主要功能
- 侧边抽屉：分组树、星标列表、搜索/筛选/排序、同步与设置入口
- 页面增强：Stars 列表页与仓库页的内联编辑
- 同步能力：手动/自动同步、冲突提示与版本选择
- 国际化：根据系统语言自动选择界面文案

## 安装（开发模式）
1. 打开浏览器扩展管理页，启用开发者模式
2. 选择“加载已解压扩展”，选择 `extension/` 目录
3. 打开 GitHub Stars 列表页或任意仓库页开始使用

## 使用说明
1. 在设置页填写 PAT 与 Gist 信息
2. 点击“测试 Token”验证权限
3. 点击“同步”或开启自动同步

PAT 与 Gist 的获取步骤可参考设置页内的初始化说明。

## 打包与发布
- 更新版本号：`extension/manifest.json`
- 生成压缩包（PowerShell）：

```powershell
Compress-Archive -Path extension\* -DestinationPath dist\github-stars-manager-v0.1.2.zip -Force
```

## Star 历史
![Star 历史](https://api.star-history.com/svg?repos=banshanshenlou/github-starts&type=Date)

## 赞助
如果你觉得这个项目有帮助，欢迎支持。

| 支付宝 | 微信支付 |
| --- | --- |
| ![支付宝二维码](docs/alipay.jpg) | ![微信支付二维码](docs/wepay.png) |

## 许可证
见 `LICENSE`。
