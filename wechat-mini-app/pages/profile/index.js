const app = getApp();

Page({
  data: {
    userInfo: {
      avatar: '',
      nickname: '微信用户',
      memberLevel: ''
    },
    memberInfo: null
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      userInfo: userInfo
    });

    // 获取会员信息
    this.loadMemberInfo();
  },

  async loadMemberInfo() {
    try {
      const result = await app.request('/member/info');
      if (result.success) {
        this.setData({
          memberInfo: result.member
        });
      }
    } catch (error) {
      console.error('获取会员信息失败', error);
      // 模拟会员数据
      this.setData({
        memberInfo: {
          name: '黄金会员',
          points: 5800,
          balance: 320.00,
          discount: '8.5折',
          expireDate: '2026-12-31'
        }
      });
    }
  },

  // 我的积分
  onViewPoints() {
    wx.navigateTo({
      url: '/pages/profile/points'
    });
  },

  // 我的优惠券
  onViewCoupons() {
    wx.navigateTo({
      url: '/pages/profile/coupons'
    });
  },

  // 地址管理
  onViewAddresses() {
    wx.navigateTo({
      url: '/pages/profile/addresses'
    });
  },

  // 历史记录
  onViewHistory() {
    wx.navigateTo({
      url: '/pages/profile/history'
    });
  },

  // 取件记录
  onPickupRecords() {
    wx.navigateTo({
      url: '/pages/orders/index?type=pickup'
    });
  },

  // 我的订单
  onMyOrders() {
    wx.switchTab({
      url: '/pages/orders/index'
    });
  },

  // 收藏夹
  onFavorite() {
    app.showToast('功能开发中', 'none');
  },

  // 意见反馈
  onFeedback() {
    wx.navigateTo({
      url: '/pages/profile/feedback'
    });
  },

  // 关于我们
  onAbout() {
    wx.navigateTo({
      url: '/pages/profile/about'
    });
  },

  // 帮助中心
  onHelp() {
    wx.navigateTo({
      url: '/pages/profile/help'
    });
  },

  // 设置
  onSettings() {
    wx.navigateTo({
      url: '/pages/profile/settings'
    });
  },

  // 联系客服
  onCallService() {
    wx.makePhoneCall({
      phoneNumber: '400-888-8888',
      fail: err => {
        app.showToast('拨打失败', 'none');
      }
    });
  }
});
