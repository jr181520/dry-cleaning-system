/**
 * 多品类管理工具（支付宝小程序版）
 */
const CATEGORIES = [
  { id: 'cleaning',          name: '干洗',     icon: '👔', color: '#1677ff', type: 'service', desc: '衣物专业清洗护理' },
  { id: 'shoe_care',         name: '洗鞋',     icon: '👟', color: '#f97316', type: 'service', desc: '鞋类深度清洁翻新修复' },
  { id: 'luxury_care',       name: '奢护',     icon: '👜', color: '#8b5cf6', type: 'service', desc: '箱包皮带奢侈品专业养护' },
  { id: 'pet_grooming',      name: '宠物',     icon: '🐕', color: '#10b981', type: 'service', desc: '宠物洗澡美容SPA护理' },
  { id: 'electronics_repair',name: '维修',     icon: '📱', color: '#6366f1', type: 'service', desc: '手机平板电脑专业维修' },
  { id: 'rental',            name: '租衣',     icon: '👘', color: '#ec4899', type: 'rental',  desc: '礼服汉服旗袍短期租赁' },
  { id: 'rental_leisure',    name: '租物',     icon: '🎮', color: '#14b8a6', type: 'rental',  desc: '相机无人机Switch露营装备' }
];

const CATEGORY_SERVICES = {
  cleaning: [
    { id: 'suit_dry', icon: '👔', name: '西装干洗', desc: '专业熨烫定型', unit: '件' },
    { id: 'shirt', icon: '👕', name: '衬衫清洗', desc: '轻柔手洗护理', unit: '件' },
    { id: 'down', icon: '🧥', name: '羽绒服清洗', desc: '杀菌除螨护理', unit: '件' },
    { id: 'shoes', icon: '👟', name: '运动鞋清洗', desc: '深度清洁保养', unit: '双' },
    { id: 'tie', icon: '👔', name: '领带清洗', desc: '轻柔水洗护理', unit: '条' },
    { id: 'curtain', icon: '🪟', name: '窗帘清洗', desc: '除螨杀菌护理', unit: '幅' }
  ],
  shoe_care: [
    { id: 'deep_clean', icon: '🧹', name: '深度清洁', desc: '去除顽固污渍', unit: '双' },
    { id: 'restore', icon: '🔧', name: '修复翻新', desc: '开胶修复划痕处理', unit: '双' },
    { id: 'waterproof', icon: '💧', name: '防水护理', desc: '纳米防水涂层', unit: '双' },
    { id: 'deodorize', icon: '🌿', name: '杀菌除臭', desc: '紫外线杀菌', unit: '双' },
    { id: 'leather', icon: '👢', name: '皮靴护理', desc: '皮革清洁滋养', unit: '双' }
  ],
  luxury_care: [
    { id: 'bag_clean', icon: '👜', name: '箱包清洁', desc: '内外深层清洁', unit: '件' },
    { id: 'bag_restore', icon: '🔧', name: '包包修复', desc: '五金更换皮面修复', unit: '件' },
    { id: 'belt_care', icon: '🧣', name: '皮带护理', desc: '清洁滋养保养', unit: '条' },
    { id: 'color_restore', icon: '🎨', name: '补色翻新', desc: '褪色补色还原', unit: '件' }
  ],
  pet_grooming: [
    { id: 'basic_wash', icon: '🛁', name: '基础洗护', desc: '洗澡+吹干+梳毛', unit: '只', size: 'small' },
    { id: 'deep_groom', icon: '✂', name: '精致美容', desc: '洗护+造型+剪指甲', unit: '只', size: 'small' },
    { id: 'spa', icon: '💆', name: 'SPA护理', desc: '深层清洁+按摩', unit: '只', size: 'medium' },
    { id: 'large_groom', icon: '🐕', name: '大型犬洗护', desc: '大型犬全套洗护', unit: '只', size: 'large' },
    { id: 'boarding', icon: '🏠', name: '宠物寄养', desc: '按天计费含喂食', unit: '天', isBoarding: true }
  ],
  electronics_repair: [
    { id: 'screen', icon: '📱', name: '屏幕维修', desc: '液晶屏更换', unit: '次', diagnostic: true },
    { id: 'battery', icon: '🔋', name: '电池更换', desc: '原厂电池更换', unit: '次' },
    { id: 'water_dmg', icon: '💧', name: '进水维修', desc: '主板清理维修', unit: '次', diagnostic: true },
    { id: 'diagnose', icon: '🔍', name: '故障诊断', desc: '全面检测定位', unit: '次' },
    { id: 'film', icon: '🛡', name: '贴膜服务', desc: '钢化膜贴附', unit: '次' },
    { id: 'tablet_repair', icon: '💻', name: '平板维修', desc: 'iPad安卓平板', unit: '次', diagnostic: true },
    { id: 'headphone', icon: '🎧', name: '耳机维修', desc: '蓝牙有线耳机', unit: '次', diagnostic: true },
    { id: 'charging', icon: '🔌', name: '充电口维修', desc: '尾插更换', unit: '次', diagnostic: true }
  ],
  rental: [
    { id: 'qipao', icon: '👘', name: '旗袍', desc: '中式旗袍', unit: '/天', deposit: 300 },
    { id: 'hanfu', icon: '👘', name: '汉服', desc: '传统汉服制式', unit: '/天', deposit: 400 },
    { id: 'evening', icon: '👗', name: '晚礼服', desc: '正式晚宴礼服', unit: '/天', deposit: 500 },
    { id: 'suit_wed', icon: '🤵', name: '西装套装', desc: '婚礼商务西装', unit: '/天', deposit: 500 },
    { id: 'kimono', icon: '🎎', name: '和服', desc: '日式传统和服', unit: '/天', deposit: 400 },
    { id: 'cosplay', icon: '🦸', name: '演出服', desc: '动漫Cosplay服装', unit: '/天', deposit: 350 },
    { id: 'accessories', icon: '💍', name: '配饰', desc: '项链耳环手镯', unit: '/天', deposit: 200 }
  ],
  rental_leisure: [
    { id: 'camera_rent', icon: '📷', name: '相机', desc: '单反/微单', unit: '/天', deposit: 3000 },
    { id: 'drone', icon: '🛸', name: '无人机', desc: '航拍无人机', unit: '/天', deposit: 2000 },
    { id: 'projector', icon: '📽', name: '投影仪', desc: '便携投影仪', unit: '/天', deposit: 1500 },
    { id: 'switch_rent', icon: '🎮', name: 'Switch', desc: '任天堂游戏机', unit: '/天', deposit: 1500 },
    { id: 'gopro', icon: '📹', name: 'GoPro', desc: '运动相机', unit: '/天', deposit: 2000 },
    { id: 'ipad_rent', icon: '📱', name: '平板电脑', desc: 'iPad平板', unit: '/天', deposit: 2500 },
    { id: 'camping', icon: '⛺', name: '露营装备', desc: '帐篷睡袋炉具', unit: '/天', deposit: 1500 },
    { id: 'speaker', icon: '🔊', name: '蓝牙音箱', desc: 'JBL/Bose音箱', unit: '/天', deposit: 800 }
  ]
};

const STATUS_FLOW = {
  service: [
    { key: 'pending', label: '待支付', icon: '📝' },
    { key: 'paid', label: '已支付', icon: '💰' },
    { key: 'delivering', label: '取件中', icon: '🛵' },
    { key: 'received', label: '已收件', icon: '📦' },
    { key: 'processing', label: '处理中', icon: '🔧' },
    { key: 'ready', label: '已就绪', icon: '✅' },
    { key: 'completed', label: '已完成', icon: '🎉' }
  ],
  rental: [
    { key: 'reserved', label: '已预约', icon: '📋' },
    { key: 'paid', label: '已支付', icon: '💰' },
    { key: 'shipped', label: '配送中', icon: '🛵' },
    { key: 'using', label: '使用中', icon: '✨' },
    { key: 'due', label: '即将到期', icon: '⏰' },
    { key: 'overdue', label: '已逾期', icon: '⚠' },
    { key: 'returning', label: '归还中', icon: '🛵' },
    { key: 'returned', label: '已归还', icon: '✅' }
  ]
};

module.exports = {
  CATEGORIES, CATEGORY_SERVICES, STATUS_FLOW,
  getAllCategories() { return CATEGORIES; },
  getByType(type) { return CATEGORIES.filter(c => c.type === type); },
  getCategory(id) { return CATEGORIES.find(c => c.id === id) || null; },
  getServices(id) { return CATEGORY_SERVICES[id] || []; },
  getStatusFlow(id) {
    const cat = this.getCategory(id);
    return cat ? (STATUS_FLOW[cat.type] || STATUS_FLOW.service) : STATUS_FLOW.service;
  },
  getHomeServices(id) { return this.getServices(id).slice(0, 4); }
};
