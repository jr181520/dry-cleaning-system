/**
 * 多品类服务目录
 * 定义所有业务品类的服务项、价格、状态流
 * 
 * 双向跑腿配送模型：
 *   服务类：取件(用户→门店) → 服务处理 → 取件(门店→用户)
 *   租赁类：发货(门店→用户) → 使用中 → 归还(用户→门店)
 */
const MODULE_CONFIG = require('../../../config/modules');

// ============================================
// 品类定义
// ============================================

const CATEGORIES = {
  // ====== 服务品类 ======
  cleaning: {
    id: 'cleaning',
    name: '衣物干洗',
    nameShort: '干洗',
    icon: '👔',
    color: '#1e40af',
    category: 'service',
    description: '专业干洗、熨烫定型',
    orderType: 'cleaning',
    // 状态流：服务品类（双向配送）
    statusFlow: [
      { key: 'pending',    label: '待支付',   icon: '📝', userLabel: '已下单' },
      { key: 'paid',       label: '已支付',   icon: '💰', userLabel: '已支付，待取件' },
      { key: 'delivering', label: '取件中',   icon: '🛵', userLabel: '骑手取件中' },
      { key: 'received',   label: '已收件',   icon: '📦', userLabel: '门店已收件' },
      { key: 'processing', label: '处理中',   icon: '🔧', userLabel: '清洗中' },
      { key: 'ready',      label: '已就绪',   icon: '✅', userLabel: '清洗完成，待取件' },
      { key: 'completed',  label: '已完成',   icon: '🎉', userLabel: '已取件' }
    ],
    // 服务项
    services: [
      { id: 'suit_dry', icon: '👔', name: '西装干洗',   desc: '专业熨烫定型', price: 50,  unit: '件' },
      { id: 'shirt',    icon: '👕', name: '衬衫清洗',   desc: '轻柔手洗护理', price: 30,  unit: '件' },
      { id: 'down',     icon: '🧥', name: '羽绒服清洗', desc: '杀菌除螨护理', price: 80,  unit: '件' },
      { id: 'shoes',    icon: '👟', name: '运动鞋清洗', desc: '深度清洁保养', price: 40,  unit: '双' },
      { id: 'tie',      icon: '👔', name: '领带清洗',   desc: '轻柔水洗护理', price: 20,  unit: '条' },
      { id: 'curtain',  icon: '🪟', name: '窗帘清洗',   desc: '除螨杀菌护理', price: 120, unit: '幅' }
    ]
  },

  shoe_care: {
    id: 'shoe_care',
    name: '鞋类洗护',
    nameShort: '洗鞋',
    icon: '👟',
    color: '#f97316',
    category: 'service',
    description: '专业鞋类清洁、修复、保养',
    orderType: 'shoe_care',
    statusFlow: [
      { key: 'pending',    label: '待支付',   icon: '📝' },
      { key: 'paid',       label: '已支付',   icon: '💰' },
      { key: 'delivering', label: '取件中',   icon: '🛵' },
      { key: 'received',   label: '已收件',   icon: '📦' },
      { key: 'processing', label: '清洗中',   icon: '🔧' },
      { key: 'ready',      label: '已就绪',   icon: '✅' },
      { key: 'completed',  label: '已完成',   icon: '🎉' }
    ],
    services: [
      { id: 'deep_clean',  icon: '🧹', name: '深度清洁',   desc: '去除顽固污渍、消毒杀菌', price: 49,  unit: '双' },
      { id: 'restore',     icon: '🔧', name: '修复翻新',   desc: '开胶修复、划痕处理',     price: 89,  unit: '双' },
      { id: 'waterproof',  icon: '💧', name: '防水护理',   desc: '纳米防水涂层',           price: 69,  unit: '双' },
      { id: 'deodorize',   icon: '🌿', name: '杀菌除臭',   desc: '紫外线杀菌+活性炭除味', price: 39,  unit: '双' },
      { id: 'leather',     icon: '👢', name: '皮靴护理',   desc: '皮革清洁+滋养上油',     price: 99,  unit: '双' }
    ]
  },

  luxury_care: {
    id: 'luxury_care',
    name: '奢侈品护理',
    nameShort: '奢护',
    icon: '👜',
    color: '#8b5cf6',
    category: 'service',
    description: '箱包皮带等奢侈品专业养护',
    orderType: 'luxury_care',
    statusFlow: [
      { key: 'pending',    label: '待支付',   icon: '📝' },
      { key: 'paid',       label: '已支付',   icon: '💰' },
      { key: 'delivering', label: '取件中',   icon: '🛵' },
      { key: 'received',   label: '已收件',   icon: '📦' },
      { key: 'processing', label: '养护中',   icon: '🔧' },
      { key: 'ready',      label: '已就绪',   icon: '✅' },
      { key: 'completed',  label: '已完成',   icon: '🎉' }
    ],
    services: [
      { id: 'bag_clean',   icon: '👜', name: '箱包清洁',   desc: '内外深层清洁',           price: 199, unit: '件' },
      { id: 'bag_restore', icon: '🔧', name: '包包修复',   desc: '五金更换、皮面修复',     price: 399, unit: '件' },
      { id: 'belt_care',   icon: '🧣', name: '皮带护理',   desc: '清洁滋养、保养封层',     price: 129, unit: '条' },
      { id: 'color_restore',icon:'🎨', name: '补色翻新',   desc: '褪色补色、颜色还原',     price: 299, unit: '件' },
      { id: 'metal_polish',icon: '✨', name: '五金抛光',   desc: '金属件抛光翻新',         price: 89,  unit: '处' }
    ]
  },

  pet_grooming: {
    id: 'pet_grooming',
    name: '宠物清洗',
    nameShort: '宠物',
    icon: '🐕',
    color: '#10b981',
    category: 'service',
    description: '宠物洗澡美容护理',
    orderType: 'pet_grooming',
    statusFlow: [
      { key: 'pending',    label: '待支付',   icon: '📝' },
      { key: 'paid',       label: '已支付',   icon: '💰' },
      { key: 'delivering', label: '接宠中',   icon: '🛵' },
      { key: 'received',   label: '已接宠',   icon: '🐕' },
      { key: 'processing', label: '洗护中',   icon: '🛁' },
      { key: 'ready',      label: '已就绪',   icon: '✅' },
      { key: 'completed',  label: '已完成',   icon: '🎉' }
    ],
    services: [
      { id: 'basic_wash',  icon: '🛁', name: '基础洗护',   desc: '洗澡+吹干+梳毛',     price: 69,  unit: '只', size: 'small' },
      { id: 'deep_groom',  icon: '✂',  name: '精致美容',   desc: '洗护+造型+剪指甲', price: 129, unit: '只', size: 'small' },
      { id: 'spa',         icon: '💆', name: 'SPA护理',     desc: '深层清洁+按摩护理', price: 199, unit: '只', size: 'medium' },
      { id: 'med_bath',    icon: '💊', name: '药浴护理',   desc: '皮肤病专用药浴',     price: 159, unit: '只', size: 'medium' },
      { id: 'large_groom', icon: '🐕', name: '大型犬洗护', desc: '大型犬全套洗护美容', price: 299, unit: '只', size: 'large' },
      { id: 'boarding',    icon: '🏠', name: '宠物寄养',   desc: '按天寄养,粮可选',   price: 0,   unit: '天', isBoarding: true }
    ]
  },

  electronics_repair: {
    id: 'electronics_repair',
    name: '电子产品维修',
    nameShort: '维修',
    icon: '📱',
    color: '#6366f1',
    category: 'service',
    description: '手机、平板、电脑专业维修',
    orderType: 'electronics_repair',
    statusFlow: [
      { key: 'pending',      label: '待支付',   icon: '📝' },
      { key: 'paid',         label: '已支付',   icon: '💰' },
      { key: 'delivering',   label: '取件中',   icon: '🛵' },
      { key: 'received',     label: '已收件',   icon: '📦' },
      { key: 'in_progress',  label: '诊断中',   icon: '🔍' },
      { key: 'processing',   label: '维修中',   icon: '🔧' },
      { key: 'ready',        label: '已就绪',   icon: '✅' },
      { key: 'completed',    label: '已完成',   icon: '🎉' }
    ],
    services: [
      { id: 'screen',     icon: '📱', name: '屏幕维修',   desc: '液晶屏/触屏更换',       price: 199, unit: '次', diagnostic: true },
      { id: 'battery',    icon: '🔋', name: '电池更换',   desc: '原厂/兼容电池更换',     price: 99,  unit: '次', diagnostic: false },
      { id: 'water_dmg',  icon: '💧', name: '进水维修',   desc: '进水后主板清理维修',   price: 299, unit: '次', diagnostic: true },
      { id: 'camera',     icon: '📷', name: '摄像头维修', desc: '前后摄像头更换调校',   price: 149, unit: '次', diagnostic: true },
      { id: 'diagnose',   icon: '🔍', name: '故障诊断',   desc: '全面检测+问题定位',     price: 49,  unit: '次', diagnostic: false }
    ]
  },

  // ====== 租赁品类 ======
  rental: {
    id: 'rental',
    name: '服饰租赁',
    nameShort: '租衣',
    icon: '👘',
    color: '#ec4899',
    category: 'rental',
    description: '礼服、汉服等服饰短期租赁',
    orderType: 'rental',
    // 租赁状态流：发货(门店→用户) → 归还(用户→门店)
    statusFlow: [
      { key: 'reserved',  label: '已预约',   icon: '📋', userLabel: '已预约',         side: 'rental' },
      { key: 'paid',      label: '已支付',   icon: '💰', userLabel: '已支付押金',     side: 'rental' },
      { key: 'shipped',   label: '配送中',   icon: '🛵', userLabel: '配送中',         side: 'rental_out' },
      { key: 'using',     label: '使用中',   icon: '✨', userLabel: '使用中',         side: 'rental' },
      { key: 'due',       label: '即将到期', icon: '⏰', userLabel: '到期提醒',       side: 'rental' },
      { key: 'overdue',   label: '已逾期',   icon: '⚠',  userLabel: '请尽快归还',     side: 'rental' },
      { key: 'returning', label: '归还中',   icon: '🛵', userLabel: '骑手取件归还中',  side: 'rental_return' },
      { key: 'returned',  label: '已归还',   icon: '✅', userLabel: '已归还' }
    ],
    services: [
      { id: 'qipao',      icon: '👘', name: '旗袍',       desc: '中式旗袍',   price: 99,  unit: '/天', deposit: 300 },
      { id: 'hanfu',      icon: '👘', name: '汉服',       desc: '传统汉服',   price: 129, unit: '/天', deposit: 400 },
      { id: 'evening',    icon: '👗', name: '晚礼服',     desc: '正式晚礼服', price: 199, unit: '/天', deposit: 500 },
      { id: 'suit_wed',   icon: '🤵', name: '西装套装',   desc: '婚礼西装',   price: 149, unit: '/天', deposit: 500 },
      { id: 'accessory',  icon: '💎', name: '配饰',       desc: '头饰/首饰',  price: 49,  unit: '/天', deposit: 200 }
    ]
  },

  rental_leisure: {
    id: 'rental_leisure',
    name: '小件商品租赁',
    nameShort: '租物',
    icon: '🎮',
    color: '#14b8a6',
    category: 'rental',
    description: '电子产品、工具、户外装备租赁',
    orderType: 'rental_leisure',
    statusFlow: [
      { key: 'reserved',  label: '已预约',   icon: '📋' },
      { key: 'paid',      label: '已支付',   icon: '💰' },
      { key: 'shipped',   label: '配送中',   icon: '🛵' },
      { key: 'using',     label: '使用中',   icon: '✨' },
      { key: 'due',       label: '即将到期', icon: '⏰' },
      { key: 'overdue',   label: '已逾期',   icon: '⚠' },
      { key: 'returning', label: '归还中',   icon: '🛵' },
      { key: 'returned',  label: '已归还',   icon: '✅' }
    ],
    services: [
      { id: 'camera_rent', icon: '📷', name: '相机',       desc: '单反/微单',  price: 79,  unit: '/天', deposit: 3000 },
      { id: 'drone',       icon: '🛸', name: '无人机',     desc: '航拍无人机',  price: 129, unit: '/天', deposit: 2000 },
      { id: 'projector',   icon: '📽',  name: '投影仪',     desc: '便携投影仪',  price: 59,  unit: '/天', deposit: 1500 },
      { id: 'switch_rent', icon: '🎮', name: 'Switch',      desc: '任天堂游戏机',price: 39,  unit: '/天', deposit: 1500 },
      { id: 'tent',        icon: '⛺',  name: '露营装备',   desc: '帐篷套装',    price: 89,  unit: '/天', deposit: 1000 }
    ]
  }
};

// ============================================
// 品类查询 API
// ============================================

/**
 * 获取所有已启用的品类
 */
function getEnabledCategories() {
  return Object.values(CATEGORIES).filter(cat =>
    MODULE_CONFIG.modules[cat.id] && MODULE_CONFIG.modules[cat.id].enabled
  );
}

/**
 * 按大类获取品类（service / rental / recycle）
 */
function getCategoriesByType(type) {
  return getEnabledCategories().filter(cat => cat.category === type);
}

/**
 * 获取单个品类详情
 */
function getCategory(categoryId) {
  const cat = CATEGORIES[categoryId];
  if (!cat) return null;
  const mod = MODULE_CONFIG.modules[categoryId];
  if (!mod || !mod.enabled) return null;
  return cat;
}

/**
 * 获取品类的状态流
 */
function getStatusFlow(categoryId) {
  const cat = getCategory(categoryId);
  return cat ? cat.statusFlow : null;
}

/**
 * 获取品类服务列表
 */
function getServices(categoryId) {
  const cat = getCategory(categoryId);
  return cat ? cat.services : null;
}

/**
 * 生成品类选择卡片数据（供前端使用）
 */
function getCategoryCards() {
  return getEnabledCategories().map(cat => ({
    id: cat.id,
    name: cat.name,
    nameShort: cat.nameShort || cat.name,
    icon: cat.icon,
    color: cat.color,
    category: cat.category,
    description: cat.description,
    serviceCount: cat.services.length,
    minPrice: Math.min(...cat.services.map(s => s.price))
  }));
}

module.exports = {
  CATEGORIES,
  getEnabledCategories,
  getCategoriesByType,
  getCategory,
  getStatusFlow,
  getServices,
  getCategoryCards
};
