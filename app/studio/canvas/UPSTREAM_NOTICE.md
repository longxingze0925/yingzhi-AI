# 上游画布来源说明

本目录包含基于 `tigerowo/infinite-canvas` 的画布前端迁移代码。

- 上游项目：`https://github.com/tigerowo/infinite-canvas`
- 迁移来源提交：`6571143e`
- 许可证：GNU Affero General Public License v3.0（见 `AGPL-3.0-upstream.txt`）
- 当前处理方式：保留上游画布交互与界面，接入影织的 `/studio/canvas` 路由和现有登录外壳。
- 影织专用适配代码主要位于 `_upstream-deps`、路由包装文件和用户状态适配文件中。

后续如果对外提供该网络服务，需要按照 AGPL-3.0 的要求提供对应修改后的源代码和许可证信息。
