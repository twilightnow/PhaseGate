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
- 多个需求文件的时候怎么办
- 需要考虑有中间层设计文件的具体意义，怎么最小程度写最合适，需要考虑长期维护性
- progress.json 多个任务同时执行的时候？
- Phase 0 可以结束时 ai提示手动结束Phase 0
- 文件归档？总之需要考虑文件大量增加后的管理结构，防止堆积在一起
- 区分任务书和设计书


 关于任务书和设计书的部分
 我打算的设计是读需求后写的是任务书。
 最后一步再写设计书，关于写设计书的部分，暂时不实装，暂缓。
 当前的书类全部改为任务书。
 应该要加最后一步，任务书移动到归档里，然后写出或者更新设计书。