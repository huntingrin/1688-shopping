# 页面操作配方

2026-10 在 `detail.1688.com` 与 `order.1688.com` 实测。选择器会随改版失效；失效时按"结构特征 + 文本"重新定位，不要退化成硬编码坐标。

## 登录态

打开 `https://cart.1688.com/cart.htm`：直接显示"采购车"= 已登录；跳登录页 = 未登录。比看头像或猜 Cookie 可靠。

## 详情页：拿到目标 SKU 的真实价格

页面顶部显示的是**起价**（如 `¥4.01 起`），不是目标规格价。规格区未登录时可能被「登录查看全部规格」遮住，但 **DOM 里有完整价格矩阵**：

```text
div.expand-view-item
  span.item-label        → "【适合柜度150-170cm】帘宽200*高200cm"
  span.item-price-stock  → "¥62"
  span.item-price-stock  → "库存999985个"
  span.item-input-number → ant-input-number（含 + / − / input）
```

读 `innerText` 就能在**不登录**的情况下拿到每个规格的价格与库存。这是核价最快的一条路，不必等登录。

要拿优惠价、运费、划线价再登录。

## 选颜色

元素：`button.sku-filter-button`，文本是完整颜色名。

⚠️ 用 `el.click()`（JS 合成点击）可能只改视觉高亮，提交订单时回退成默认颜色。**必须用真实指针点击** `page.mouse.click(x, y)`。

选完立刻验证：`button.sku-filter-button` 中带 active/checked 类的只有一个，且文本等于目标颜色。

## 选尺寸与数量

每个规格是独立一行，各自带数量步进器，**不是单选**：

- 行容器：`div.expand-view-item`（用 innerText 匹配规格文本）
- 加号：该行内 `span.anticon-plus`
- 输入框：`input.ant-input-number-input`，初始 placeholder 为 `0`

数量为 0 时点「立即下单」会被拦。加完读回 `input.value` 确认是目标数量。

## 「立即下单」按钮

它是自定义元素 `<q-button>`，用 `querySelectorAll("button")` 抓不到。

定位方式：遍历元素取 `innerText.trim() === "立即下单"` 且 `width > 200` 的那个，再用 `page.mouse.click` 点中心。

**静默失败特征**：点击后 URL 仍是 `order.1688.com/order/smart_make_order.htm`、页面无报错。九成是地址没挂到订单，回去检查，不要重复点。

## 订单页：地址

- 选择器：`.ctf-lib-antd-address-picker input[readonly]`，value 形如 `北京 北京市 西城区`
- 地址抽屉里的地址**保存 ≠ 挂到订单**。必须点中地址行，再点「确定」
- 判断成功：页面顶部由「请添加地址 >」变为完整地址 + 收货人 + 电话 + 「更改地址」

## 新建地址：自动识别不可信

页面顶部有「粘贴地址到此处，将自动识别姓名/电话/地址」。

实测把 `北京市西城区…` 识别成 **东城区**，并把"西城区"塞进了详细地址，变成 `市西城区 旧鼓楼大街…`。

规则：自动填写只当草稿，**姓名、手机、省市区、详细地址四项逐字复核**。

改区县：点那个 readonly 输入框 → 出现 ant-tabs 四级联动（省 / 市 / 区 / 街道）→ 点当前区名所在的 tab 展开列表 → 点目标区 → 点「确认」。

街道可以留空，详细地址里写清即可。

## 收银台

URL 含 `payment-cashier-pc-air`，`orderId` 参数就是订单号。

默认选中「先采后付」。页面结构：

```text
￥0.00
确认收货后付款 ¥66.00
请在4天23时59分 内完成支付
```

交接时把订单号抄给用户，并说明当前选中的是哪种支付方式。

## 通用注意

- 页面宽度会变，坐标只在当次有效；每次操作前重新取 `getBoundingClientRect()`
- 分数缩放（DPR=2）时截图尺寸 ≠ CSS 像素，不要拿截图坐标直接点
- 操作后必须回到页面状态验证，不要假定点击成功
- 不读取、不导出 Cookie，不接管用户其他标签页
