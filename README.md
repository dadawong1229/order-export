# 订单导出支付渠道筛选

订单导出服务：`GET /api/orders/export` 支持按支付渠道筛选，不筛选时导出全部订单。

## 运行

Node.js >= 20，无第三方依赖。

```bash
npm start              # 默认监听 3000，可用 PORT 覆盖
npm test               # 运行全部自动化测试
```

## 接口

### `GET /api/orders/export`

筛选参数为可重复的 query 参数 `payment_channel`：

```text
GET /api/orders/export?payment_channel=alipay&payment_channel=wechat_pay
```

- 不传、空值、纯空白：导出全部订单。
- 空值与有效值混合：忽略空值，仅按有效值筛选。
- 1–5 个不同有效渠道：仅导出这些渠道的订单。
- 值会去除首尾空白并忽略大小写，匹配后归一化为枚举规范值。
- 重复值先去重再计数，重复不报错。
- 非法值校验优先于数量上限。

成功响应：

```text
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="orders.csv"
```

空结果返回 200 且 CSV 只有表头行。

### 错误响应

校验在订单查询和 CSV 生成之前完成，错误响应不含任何 CSV 内容或 CSV 响应头。

非法渠道值：

```json
{
  "error": {
    "code": "INVALID_PAYMENT_CHANNEL",
    "message": "存在非法支付渠道值: unknown_channel",
    "invalid_values": ["unknown_channel"]
  }
}
```

超过 5 个（去重后）：

```json
{
  "error": {
    "code": "TOO_MANY_PAYMENT_CHANNELS",
    "message": "最多选择 5 个支付渠道，当前选择了 6 个",
    "max": 5,
    "count": 6
  }
}
```

## 支付渠道枚举

唯一来源：`src/paymentChannels.js` 的 `PAYMENT_CHANNELS`。

| 规范值 |
| --- |
| `alipay` |
| `wechat_pay` |
| `union_pay` |
| `bank_card` |
| `paypal` |
| `stripe` |
| `apple_pay` |

订单数据、筛选校验都使用该来源；新增渠道只需修改该文件。`apple_pay` 在种子数据中没有订单，用于覆盖空结果场景。

## CSV 格式契约

筛选只改变数据行集合，以下格式与不筛选时完全一致：

- 列与顺序：`order_id,order_no,user_id,payment_channel,amount,currency,status,created_at`
- UTF-8，无 BOM
- 逗号分隔，`\n` 换行，末尾一个换行
- RFC 4180 引号规则：含 `,`、`"`、CR、LF 的字段加引号，内部引号加倍
- 空值输出为空字段
- 金额固定 2 位小数，无千分位、无币种符号
- 时间为 ISO 8601 UTC（如 `2026-10-01T08:15:00Z`）
- 数据行按 `created_at` 升序、`order_id` 升序排列

## 实现结构

- `src/paymentChannels.js`：渠道枚举与归一化。
- `src/paymentChannelFilter.js`：参数解析、去重、非法值与数量校验。
- `src/orders.js`：内存订单数据源与查询阶段筛选。
- `src/csv.js`：CSV 序列化。
- `src/app.js`：HTTP 处理与响应。
- `src/server.js`：服务启动入口。
- `test/`：单元测试与真实 HTTP 集成测试，用例名标注对应 AC 编号。
