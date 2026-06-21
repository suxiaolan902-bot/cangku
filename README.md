# Amazon US 竞品关键词分析工具

本仓库提供一套**仅处理浏览器已加载页面数据**的亚马逊美国站竞品关键词分析工具。工具不包含爬虫，不调用 Amazon API，不跨域请求，也不会主动向 Amazon 发送额外网络请求，以降低账号或 IP 风控风险。

## 功能组成

1. `amazon_extract.js`：Tampermonkey 油猴脚本
   - 适配 `amazon.com` 搜索结果页与商品详情页。
   - 页面右下角增加“一键导出”按钮。
   - 从当前 DOM 中提取已加载商品数据：ASIN、标题、售价、星级、评论总数、类目。
   - 自动下载本地 JSON 文件。

2. `analysis.py`：Python 数据分析脚本
   - 读取油猴脚本导出的本地 JSON 文件。
   - 对英文标题分词、去除常见虚词，统计关键词词频。
   - 区分“大词”和“长尾词”。
   - 计算类目均价、评论中位数、低价竞品数量，并给出竞争度评分与等级。
   - 输出两份 Excel：`keyword_heat.xlsx` 和 `market_summary.xlsx`。

## 安装油猴脚本

1. 在 Chrome、Edge 或 Firefox 安装 Tampermonkey 扩展。
2. 打开 Tampermonkey 管理面板，点击“添加新脚本”。
3. 删除默认模板内容，将 `amazon_extract.js` 的完整内容复制进去。
4. 保存脚本，并确保脚本处于启用状态。
5. 访问 `https://www.amazon.com/` 的搜索结果页或商品详情页，等待页面加载完成。

## 使用流程

### 1. 导出 Amazon 页面本地 JSON

1. 在 Amazon US 搜索结果页或商品详情页等待商品信息加载完成。
2. 点击页面右下角的“导出Amazon商品JSON”按钮。
3. 浏览器会自动下载类似 `amazon_us_products_2026-06-21T00-00-00-000Z.json` 的文件。
4. 如需更多样本，请手动翻页或打开其他页面后重复导出；本工具不会自动翻页或抓取页面。

### 2. 安装 Python 依赖

建议使用虚拟环境：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pandas openpyxl
```

### 3. 生成 Excel 分析结果

```bash
python analysis.py /path/to/amazon_us_products.json --output-dir output
```

运行完成后会生成：

- `output/keyword_heat.xlsx`：关键词热度表。
- `output/market_summary.xlsx`：市场竞品汇总表。

可选参数：

```bash
python analysis.py /path/to/amazon_us_products.json --output-dir output --low-price-threshold 19.99
```

`--low-price-threshold` 用于手动指定低价竞品阈值；如果不提供，脚本会使用当前类目价格中位数作为低价阈值。

## 字段说明

### JSON 商品字段

- `asin`：商品 ASIN。
- `title`：商品标题。
- `price`：页面展示售价文本。
- `price_value`：解析后的数值价格，无法解析时为 `null`。
- `rating`：星级评分，无法识别时为 `null`。
- `review_count`：评论总数，无法识别时为 `null`。
- `category`：页面可见类目或搜索下拉类目。
- `source`：数据来源页面类型，搜索结果页为 `search_results`，详情页为 `product_detail`。
- `url`：当前商品链接或页面链接。

### 关键词热度表

- `keyword`：关键词。
- `frequency`：出现频次，按单个商品标题去重后统计。
- `product_coverage`：覆盖商品数量。
- `keyword_type`：`大词` 或 `长尾词`。

### 市场竞品汇总表

- `category`：类目。
- `product_count`：商品数量。
- `average_price`：类目均价。
- `median_reviews`：评论中位数。
- `low_price_threshold`：低价阈值。
- `low_price_competitor_count`：低价竞品数量。
- `competition_score`：竞争度评分。
- `competition_level`：竞争等级。

## 合规与风控说明

- 本工具只读取当前浏览器页面中已经加载完成的 DOM 内容。
- 油猴脚本不使用 `fetch`、`XMLHttpRequest` 或跨域请求。
- Python 脚本只读取本地 JSON 文件，不访问网络。
- 本工具不包含自动翻页、批量访问、爬虫调度、代理池或 Amazon API 调用。
