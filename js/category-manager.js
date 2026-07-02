/**
 * 多品类管理器（C端/M端共用）
 * 支持服务品类(干洗/洗鞋/奢护/宠物/维修) + 租赁品类(服饰/小件)
 * 
 * 双向跑腿配送模型：
 *   服务类: 取件(用户→门店) → 处理 → 送回(门店→用户)
 *   租赁类: 发货(门店→用户) → 使用 → 归还(用户→门店)
 */
(function() {
  'use strict';

  // ============================================
  // 品类数据（从后端API / 本地配置加载）
  // ============================================
  const CATEGORIES = [
    // 服务品类
    { id: 'cleaning',          name: '干洗',     icon: '👔', color: '#1e40af', category: 'service', desc: '衣物专业清洗护理',          keywords: ['干洗','洗衣','西服','衬衫','羽绒服'] },
    { id: 'shoe_care',         name: '洗鞋',     icon: '👟', color: '#f97316', category: 'service', desc: '鞋类深度清洁翻新修复',      keywords: ['洗鞋','球鞋','皮鞋','运动鞋'] },
    { id: 'luxury_care',       name: '奢护',     icon: '👜', color: '#8b5cf6', category: 'service', desc: '箱包皮带奢侈品专业养护',    keywords: ['包包','皮带','奢侈品','护理'] },
    { id: 'pet_grooming',      name: '宠物',     icon: '🐕', color: '#10b981', category: 'service', desc: '宠物洗澡美容SPA护理',         keywords: ['宠物','猫','狗','洗澡','美容'] },
    { id: 'electronics_repair',name: '维修',     icon: '📱', color: '#6366f1', category: 'service', desc: '手机平板电脑专业维修',        keywords: ['手机','电脑','维修','屏幕','电池'] },
    // 租赁品类
    { id: 'rental',            name: '租衣',     icon: '👘', color: '#ec4899', category: 'rental',  desc: '礼服汉服旗袍短期租赁',        keywords: ['租衣','礼服','汉服','旗袍','西装'] },
    { id: 'rental_leisure',    name: '租物',     icon: '🎮', color: '#14b8a6', category: 'rental',  desc: '相机无人机Switch露营装备',    keywords: ['租赁','相机','无人机','Switch','露营'] }
  ];

  // 品类对应的服务项（兜底数据，优先从后端API加载）
  const CATEGORY_SERVICES = {
    cleaning: [
      { id: 'suit',    icon: '👔', name: '西装干洗',    desc: '专业熨烫定型',         price: 50,  unit: '件' },
      { id: 'shirt',   icon: '👕', name: '衬衫清洗',    desc: '轻柔手洗护理',         price: 30,  unit: '件' },
      { id: 'down',    icon: '🧥', name: '羽绒服清洗',  desc: '杀菌除螨护理',         price: 80,  unit: '件' },
      { id: 'shoes',   icon: '👟', name: '运动鞋清洗',  desc: '深度清洁保养',         price: 40,  unit: '双' },
      { id: 'tie',     icon: '👔', name: '领带清洗',    desc: '轻柔水洗护理',         price: 20,  unit: '条' },
      { id: 'curtain', icon: '🪟', name: '窗帘清洗',    desc: '除螨杀菌护理',         price: 120, unit: '幅' }
    ],
    shoe_care: [
      { id: 'deep',    icon: '🧹', name: '深度清洁',    desc: '顽固污渍+杀菌',        price: 49,  unit: '双' },
      { id: 'restore', icon: '🔧', name: '修复翻新',    desc: '开胶修复+划痕处理',    price: 89,  unit: '双' },
      { id: 'water',   icon: '💧', name: '防水护理',    desc: '纳米防水涂层',         price: 69,  unit: '双' },
      { id: 'deod',    icon: '🌿', name: '杀菌除臭',    desc: 'UV杀菌+活性炭',        price: 39,  unit: '双' },
      { id: 'leather', icon: '👢', name: '皮靴护理',    desc: '皮革清洁+滋养',        price: 99,  unit: '双' }
    ],
    luxury_care: [
      { id: 'bag_cln', icon: '👜', name: '箱包清洁',    desc: '内外深层清洁',         price: 199, unit: '件' },
      { id: 'bag_rst', icon: '🔧', name: '包包修复',    desc: '五金更换+皮面修复',    price: 399, unit: '件' },
      { id: 'belt',    icon: '🧣', name: '皮带护理',    desc: '清洁滋养+保养封层',   price: 129, unit: '条' },
      { id: 'color',   icon: '🎨', name: '补色翻新',    desc: '褪色补色+颜色还原',    price: 299, unit: '件' }
    ],
    pet_grooming: [
      { id: 'wash',    icon: '🛁', name: '基础洗护',    desc: '洗澡+吹干+梳毛',       price: 69,  unit: '只' },
      { id: 'groom',   icon: '✂',  name: '精致美容',    desc: '洗护+造型+剪指甲',     price: 129, unit: '只' },
      { id: 'spa',     icon: '💆', name: 'SPA护理',      desc: '深层清洁+按摩',        price: 199, unit: '只' },
      { id: 'large',   icon: '🐕', name: '大型犬洗护',  desc: '大型犬全套美容',        price: 299, unit: '只' },
      { id: 'boarding',icon: '🏠', name: '宠物寄养',    desc: '按天寄养,粮可选',      price: 0,   unit: '天', isBoarding: true }
    ],
    electronics_repair: [
      { id: 'screen',       icon: '📱', name: '屏幕维修',   desc: '液晶屏/触屏更换',       price: 199, unit: '次' },
      { id: 'battery',      icon: '🔋', name: '电池更换',   desc: '原厂/兼容电池',         price: 99,  unit: '次' },
      { id: 'water_dmg',    icon: '💧', name: '进水维修',   desc: '主板清理维修',         price: 299, unit: '次' },
      { id: 'diagnose',     icon: '🔍', name: '故障诊断',   desc: '全面检测+定位',         price: 49,  unit: '次' },
      { id: 'film',         icon: '🛡',  name: '贴膜服务',   desc: '钢化膜/防窥膜贴附',     price: 29,  unit: '次' },
      { id: 'tablet_repair',icon: '💻', name: '平板维修',   desc: 'iPad/安卓平板维修',     price: 199, unit: '次' },
      { id: 'headphone',    icon: '🎧', name: '耳机维修',   desc: '蓝牙/有线耳机维修',     price: 69,  unit: '次' },
      { id: 'charging',     icon: '🔌', name: '充电口维修', desc: '尾插/充电口更换',       price: 129, unit: '次' }
    ],
    rental: [
      { id: 'qipao',      icon: '👘', name: '旗袍',     desc: '中式旗袍',         price: 99,  unit: '/天', deposit: 300 },
      { id: 'hanfu',      icon: '👘', name: '汉服',     desc: '传统汉服制式',     price: 129, unit: '/天', deposit: 400 },
      { id: 'evening',    icon: '👗', name: '晚礼服',   desc: '正式晚宴礼服',     price: 199, unit: '/天', deposit: 500 },
      { id: 'suit_wed',   icon: '🤵', name: '西装套装', desc: '婚礼商务西装',     price: 149, unit: '/天', deposit: 500 },
      { id: 'kimono',     icon: '🎎', name: '和服',     desc: '日式传统和服',     price: 149, unit: '/天', deposit: 400 },
      { id: 'cosplay',    icon: '🦸', name: '演出服',   desc: '动漫/Cosplay服装',  price: 99,  unit: '/天', deposit: 350 },
      { id: 'accessories',icon: '💍', name: '配饰',     desc: '项链耳环手镯',     price: 49,  unit: '/天', deposit: 200 }
    ],
    rental_leisure: [
      { id: 'camera_rent', icon: '📷', name: '相机',     desc: '单反/微单相机',    price: 79,  unit: '/天', deposit: 3000 },
      { id: 'drone',       icon: '🛸', name: '无人机',   desc: '航拍无人机',        price: 129, unit: '/天', deposit: 2000 },
      { id: 'projector',   icon: '📽',  name: '投影仪',   desc: '便携家用投影仪',    price: 59,  unit: '/天', deposit: 1500 },
      { id: 'switch_rent', icon: '🎮', name: 'Switch',   desc: '任天堂游戏机',      price: 39,  unit: '/天', deposit: 1500 },
      { id: 'gopro',       icon: '📹', name: 'GoPro',    desc: '运动相机/防水',     price: 69,  unit: '/天', deposit: 2000 },
      { id: 'ipad_rent',   icon: '📱', name: '平板电脑',  desc: 'iPad/安卓平板',     price: 49,  unit: '/天', deposit: 2500 },
      { id: 'camping',     icon: '⛺', name: '露营装备',  desc: '帐篷睡袋炉具套装',  price: 99,  unit: '/天', deposit: 1500 },
      { id: 'speaker',     icon: '🔊', name: '蓝牙音箱',  desc: 'JBL/Bose便携音箱',  price: 29,  unit: '/天', deposit: 800 }
    ]
  };

  // ============================================
  // 品类管理器 API
  // ============================================
  window.CategoryManager = {
    // 获取所有品类
    getAllCategories: function() {
      return CATEGORIES;
    },

    // 按类型获取品类
    getByType: function(type) {
      return CATEGORIES.filter(c => c.category === type);
    },

    // 获取单个品类
    getCategory: function(categoryId) {
      return CATEGORIES.find(c => c.id === categoryId) || null;
    },

    // 获取品类服务
    getServices: function(categoryId) {
      return CATEGORY_SERVICES[categoryId] || [];
    },

    // 选择品类
    selectCategory: function(categoryId) {
      const cat = this.getCategory(categoryId);
      if (!cat) return false;

      localStorage.setItem('selectedCategory', JSON.stringify(cat));
      // 同时保存品类第一个服务作为默认选中
      const services = this.getServices(categoryId);
      if (services.length > 0) {
        localStorage.setItem('selectedService', JSON.stringify(services[0]));
      }
      return true;
    },

    // 获取当前选中的品类
    getSelectedCategory: function() {
      try {
        return JSON.parse(localStorage.getItem('selectedCategory') || 'null');
      } catch (e) { return null; }
    },

    // 获取选购上下文（品类+服务）
    getShoppingContext: function() {
      return {
        category: this.getSelectedCategory(),
        service: (function() {
          try { return JSON.parse(localStorage.getItem('selectedService') || 'null'); }
          catch (e) { return null; }
        })()
      };
    },

    // ============================================
    // 渲染品类选择器 UI（注入到指定容器）
    // ============================================
    renderCategoryTabs: function(containerId, onSelect) {
      var container = document.getElementById(containerId);
      if (!container) return;

      var activeCategory = this.getSelectedCategory();
      var activeId = activeCategory ? activeCategory.id : 'cleaning';

      var html = '<div class="category-tabs flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style="-webkit-overflow-scrolling: touch;">';
      CATEGORIES.forEach(function(cat) {
        var isActive = cat.id === activeId;
        var isRental = cat.category === 'rental';
        html += '<div class="category-tab flex-shrink-0 cursor-pointer rounded-xl px-3 py-2 text-center transition-all ' +
          (isActive
            ? 'bg-gradient-to-r from-' + cat.color + ' to-' + cat.color + ' text-white shadow-md'
            : 'bg-white text-gray-600 border border-gray-200'
          ) + '" style="min-width: 64px; ' + (isActive ? 'background: ' + cat.color + '; color: white;' : '') + '" ' +
          'onclick="window.CategoryManager._handleTabClick(\'' + cat.id + '\', \'' + containerId + '\', ' + (typeof onSelect === 'function' ? 'true' : 'false') + ')" ' +
          'data-category="' + cat.id + '">' +
          '<div class="text-xl mb-0.5">' + cat.icon + '</div>' +
          '<div class="text-xs font-semibold">' + cat.name + '</div>' +
          (isRental ? '<div class="text-xs opacity-70 mt-0.5">租赁</div>' : '') +
        '</div>';
      });
      html += '</div>';
      container.innerHTML = html;

      // 加载当前品类的服务
      var services = this.getServices(activeId);
      this._renderServicesGrid(activeId, services);
    },

    // 渲染品类服务网格
    // SaaS模式：所有价格由门店商家自行设定，C端仅展示服务产品，不显示价格
    _renderServicesGrid: function(categoryId, services) {
      var grid = document.getElementById('services-grid');
      if (!grid) return;

      var cat = this.getCategory(categoryId);
      if (!cat) return;

      var isRental = cat.category === 'rental';

      var html = '<div id="services-section" data-category="' + categoryId + '">';
      html += '<div class="flex items-center justify-between mb-3">' +
        '<div class="flex items-center gap-2"><span class="text-xl">' + cat.icon + '</span>' +
        '<span class="text-lg font-bold text-gray-800">' + cat.name + '服务</span></div>' +
        (isRental ? '<span class="text-xs text-pink-500 bg-pink-50 px-2 py-1 rounded-full">需押金</span>' :
         '<span class="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full">门店定价</span>') +
      '</div>';
      html += '<div class="grid grid-cols-2 gap-3">';

      services.forEach(function(svc) {
        var priceLabel;
        if (svc.isBoarding) {
          priceLabel = '<span class="text-xs text-green-600 font-medium">按天计费</span>';
        } else if (isRental) {
          priceLabel = '<span class="text-xs text-gray-400">' + (svc.unit || '') + '</span>';
        } else {
          priceLabel = '<span class="text-xs text-blue-500 font-medium">门店定价</span>';
        }

        html += '<div class="service-card bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all ' +
          (svc.isBoarding ? 'border-green-200 bg-green-50' : '') + '" ' +
          'onclick="window.CategoryManager.selectService(\'' + categoryId + '\', \'' + svc.id + '\')" ' +
          'data-cat="' + categoryId + '" data-svc="' + svc.id + '">' +
          '<div class="text-2xl mb-2">' + svc.icon + '</div>' +
          '<div class="text-sm font-bold text-gray-800 mb-1">' + svc.name + '</div>' +
          '<div class="text-xs text-gray-400 mb-2">' + svc.desc + '</div>' +
          '<div class="flex items-center justify-between">' +
            priceLabel +
            (svc.deposit ? '<span class="text-xs text-orange-500">押¥' + svc.deposit + '</span>' : '') +
          '</div>' +
        '</div>';
      });

      html += '</div></div>';
      grid.innerHTML = html;
    },

    // 处理品类切换
    _handleTabClick: function(categoryId, containerId, hasCallback) {
      this.selectCategory(categoryId);
      this.renderCategoryTabs(containerId);

      // 如果有回调，传递品类信息
      if (hasCallback && typeof arguments[2] === 'function') {
        // skip
      }
    },

    // 选择服务，跳转到下单页
    selectService: function(categoryId, serviceId) {
      var services = this.getServices(categoryId);
      var service = services.find(function(s) { return s.id === serviceId; });
      if (!service) return;

      // 保存选购上下文
      localStorage.setItem('selectedCategory', JSON.stringify(this.getCategory(categoryId)));
      localStorage.setItem('selectedService', JSON.stringify(service));

      // 跳转到下单页
      window.location.href = 'c-order.html?category=' + categoryId + '&service=' + serviceId;
    },

    // 从后端API加载品类配置（可选）
    loadFromAPI: async function() {
      try {
        var resp = await fetch('/api/categories/list');
        var data = await resp.json();
        if (data.success && data.categories) {
          // 合并后端品类到本地
          data.categories.forEach(function(apiCat) {
            var localCat = CATEGORIES.find(function(c) { return c.id === apiCat.id; });
            if (localCat) {
              Object.assign(localCat, apiCat);
            }
          });
        }
      } catch (e) {
        console.log('[品类管理器] 后端API不可用，使用本地配置');
      }
    }
  };

  // ============================================
  // 挂载全局品类跳转
  // ============================================
  window.goToCategoryOrder = function(categoryId) {
    CategoryManager.selectCategory(categoryId);
    window.location.href = 'c-order.html?category=' + categoryId;
  };

  console.log('[品类管理器] 已初始化，支持 ' + CATEGORIES.length + ' 个品类');
})();
