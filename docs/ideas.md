## 想法

初始化的时候能不能不直接放到根目录，初始化的时候必须指定名字吗 直接像其他项目一样.phasegate怎么样
  requirements/         requirements documents // 为什么是个文件夹，即使是文件夹也应该附赠一个用来编辑的模板文件
  design/               module design documents // 新需求时应自动生成；支持项目启动时全局识别已有内容（待实现）
  contracts/            interface contracts // 新需求时应自动生成；支持项目启动时全局识别已有内容（待实现）
  progress.json         project state (source of truth)
  progress.md           project progress (human-readable)
  phasegate.config.json  configuration

// .phasegate/ 不天然加入 .gitignore，设计书（design/、contracts/）有长期保存价值，应纳入版本管理

## 需讨论
- 启动了 但是没有读入requirements.md内容
- init怎么判断的主目录的第一级创建目录的
- `progress.md` 由每次 `ProgressManager.write()` 自动重新生成 Status Section，Phase Summary 区块（由 AI 阶段追加）则只增不改。似乎有维护性问题


## 延后

- design/和contracts/ 提供一个初期的全局整理。  每个文件里面都应该加简单的解释词

- 使用指导需要更新 按 本地部署和phasegate命令
- Description的模板不太对
- Claude 文件夹信任问题
- AI CLI PATH问题
- 默认配置需要增加对于各个模型的调度方案
- 但是没有读入requirements，需要增加一个对应指摘的文件
- 系统提示词多语言支持