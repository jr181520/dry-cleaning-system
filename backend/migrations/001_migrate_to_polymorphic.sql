-- ============================================
-- 渐进式架构数据迁移脚本
-- 从当前干洗业务迁移到多态模型
-- ============================================

-- ============================================
-- 1. 新增字段（保持向后兼容）
-- ============================================

-- 订单表：新增多态字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_type ENUM('cleaning', 'recycle', 'rental', 'deposit') 
DEFAULT 'cleaning' AFTER status;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS items_json JSON 
AFTER order_type;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS amounts_json JSON 
AFTER items_json;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_json JSON 
AFTER amounts_json;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_json JSON 
AFTER payment_json;

-- 物品表：新增多态字段
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS item_type ENUM('dry_cleaning', 'recycle', 'rental') 
DEFAULT 'dry_cleaning' AFTER name;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS owner_type ENUM('user', 'store', 'brand', 'recycle_shop') 
DEFAULT 'user' AFTER item_type;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS owner_id VARCHAR(64) 
AFTER owner_type;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS attributes_json JSON 
AFTER owner_id;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS cleaning_data_json JSON 
AFTER attributes_json;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS recycle_data_json JSON 
AFTER cleaning_data_json;

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS rental_data_json JSON 
AFTER recycle_data_json;

-- 用户表：新增角色和信用字段
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS roles_json JSON 
DEFAULT '["customer"]' AFTER phone;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS credit_json JSON 
AFTER roles_json;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS assets_json JSON 
AFTER credit_json;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS addresses_json JSON 
AFTER assets_json;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS member_json JSON 
AFTER addresses_json;

-- ============================================
-- 2. 数据迁移：订单表
-- ============================================

-- 将旧 items 数据迁移到新格式
UPDATE orders SET items_json = JSON_ARRAYAGG(
  JSON_OBJECT(
    'itemId', item_id,
    'name', item_name,
    'itemType', 'dry_cleaning',
    'price', item_price,
    'quantity', item_quantity,
    'subtotal', item_price * item_quantity,
    'serviceType', 'dry_clean',
    'pickupCode', pickup_code
  )
)
WHERE items_json IS NULL AND order_type = 'cleaning';

-- 将旧金额迁移到 amounts_json
UPDATE orders SET amounts_json = JSON_OBJECT(
  'subtotal', total_amount,
  'discount', 0,
  'deliveryFee', delivery_fee,
  'total', total_amount
)
WHERE amounts_json IS NULL;

-- 迁移支付信息
UPDATE orders SET payment_json = JSON_OBJECT(
  'status', payment_status,
  'method', payment_method,
  'transactionId', transaction_id
)
WHERE payment_json IS NULL;

-- ============================================
-- 3. 数据迁移：物品表
-- ============================================

-- 迁移旧物品到新格式
UPDATE items SET 
  item_type = 'dry_cleaning',
  owner_type = 'user',
  attributes_json = JSON_OBJECT(
    'category', category,
    'brand', brand,
    'material', material
  ),
  cleaning_data_json = JSON_OBJECT(
    'serviceType', service_type,
    'stains', JSON_ARRAY(),
    'specialReq', special_req
  )
WHERE item_type = 'dry_cleaning' AND item_type IS NULL;

-- ============================================
-- 4. 数据迁移：用户表
-- ============================================

-- 迁移用户角色
UPDATE users SET roles_json = JSON_ARRAY('customer')
WHERE roles_json IS NULL;

-- 迁移用户信用
UPDATE users SET credit_json = JSON_OBJECT(
  'fulfillmentScore', 100,
  'completedOrders', completed_orders_count,
  'cancelledOrders', cancelled_orders_count,
  'lateReturns', 0,
  'depositBalance', 0,
  'creditLimit', 0,
  'blacklisted', FALSE
)
WHERE credit_json IS NULL;

-- 迁移会员信息
UPDATE users SET member_json = JSON_OBJECT(
  'level', member_level,
  'points', points,
  'totalSpent', total_spent
)
WHERE member_json IS NULL;

-- ============================================
-- 5. 创建新表
-- ============================================

-- 订单状态历史表
CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  actor_id VARCHAR(64),
  actor_type VARCHAR(32),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 物品状态历史表
CREATE TABLE IF NOT EXISTS item_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  actor_id VARCHAR(64),
  actor_type VARCHAR(32),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_item_id (item_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分账记录表
CREATE TABLE IF NOT EXISTS payment_splits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  account_name VARCHAR(128),
  amount DECIMAL(10, 2) NOT NULL,
  settled TINYINT(1) DEFAULT 0,
  settled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_account_id (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 信用记录表
CREATE TABLE IF NOT EXISTS credit_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  behavior VARCHAR(64) NOT NULL,
  score_change INT NOT NULL,
  old_score INT,
  new_score INT,
  context_json JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 门店表
CREATE TABLE IF NOT EXISTS stores (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) UNIQUE,
  owner_id VARCHAR(64) NOT NULL,
  staff_ids_json JSON,
  business_json JSON,
  location_json JSON,
  hours_json JSON,
  services_json JSON,
  delivery_json JSON,
  stats_json JSON DEFAULT '{"totalOrders":0,"monthlyOrders":0,"rating":5.0,"ratingCount":0}',
  settlement_json JSON DEFAULT '{"balance":0,"frozenBalance":0,"pendingSettlement":0}',
  status ENUM('pending', 'active', 'suspended', 'closed') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner_id (owner_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 配送单表
CREATE TABLE IF NOT EXISTS delivery_orders (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL,
  type ENUM('none', 'pickup', 'delivery') NOT NULL,
  courier_type ENUM('solo', 'shared'),
  provider VARCHAR(32),
  provider_order_id VARCHAR(64),
  pickup_address_json JSON,
  delivery_address_json JSON,
  fee DECIMAL(10, 2) DEFAULT 0,
  distance DECIMAL(10, 2),
  courier_json JSON,
  status ENUM('pending', 'assigned', 'picking', 'delivering', 'delivered', 'cancelled', 'failed') DEFAULT 'pending',
  track_json JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  delivered_at DATETIME,
  INDEX idx_order_id (order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 消息模板表
CREATE TABLE IF NOT EXISTS message_templates (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  event VARCHAR(64) NOT NULL,
  content_json JSON NOT NULL,
  channels_json JSON,
  enabled TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_event (type, event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. 初始化数据
-- ============================================

-- 插入消息模板（干洗）
INSERT INTO message_templates (id, type, event, content_json, channels_json) VALUES
('cleaning_order_created', 'cleaning', 'order_created', 
 '{"title":"订单已创建","body":"您的清洗订单已创建，订单号：{orderNo}，预计{estimatedDays}天完成"}',
 '["wechat","sms"]'),
('cleaning_order_paid', 'cleaning', 'order_paid',
 '{"title":"支付成功","body":"您的清洗订单已支付成功，金额：{amount}元"}',
 '["wechat","sms"]'),
('cleaning_order_completed', 'cleaning', 'order_completed',
 '{"title":"清洗完成","body":"您的{itemName}已清洗完成，请前往{storeName}取件"}',
 '["wechat","sms","push"]');

-- ============================================
-- 7. 清理旧字段（可选，在确认迁移成功后执行）
-- ============================================

-- 注意：以下操作需要先确认迁移完成
-- ALTER TABLE orders DROP COLUMN IF EXISTS item_name;
-- ALTER TABLE orders DROP COLUMN IF EXISTS item_price;
-- ALTER TABLE orders DROP COLUMN IF EXISTS item_quantity;
-- ALTER TABLE orders DROP COLUMN IF EXISTS total_amount;
-- ALTER TABLE orders DROP COLUMN IF EXISTS delivery_fee;
-- ALTER TABLE orders DROP COLUMN IF EXISTS payment_status;
-- ALTER TABLE orders DROP COLUMN IF EXISTS payment_method;
-- ALTER TABLE orders DROP COLUMN IF EXISTS transaction_id;
-- ALTER TABLE orders DROP COLUMN IF EXISTS pickup_code;
