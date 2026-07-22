const app = getApp();

Page({
  data: {
    userInfo: null,
    zhimaScore: 0,
    menuItems: [
      { icon: '📍', name: '地址管理', url: '/pages/profile/address/index' },
      { icon: '🎫', name: '优惠券', url: '/pages/profile/coupons/index' },
      { icon: '👑', name: '会员中心', url: '/pages/profile/member/index' },
      { icon: '⚙️', name: '设置', url: '/pages/profile/settings/index' },
      { icon: 'ℹ️', name: '关于', url: '/pages/profile/about/index' }
    ]
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo;
    if (userInfo) {
      this.setData({ userInfo });
      this.loadZhimaScore();
    }
  },

  loadZhimaScore() {
    app.request('/user/zhima-score', { userId: this.data.userInfo.userId })
      .then(res => {
        if (res && res.score) {
          this.setData({ zhimaScore: res.score });
        }
      });
  },

  onEditTap() {
    my.navigateTo({ url: '/pages/profile/edit/index' });
  },

  onMenuTap(e) {
    const url = e.target.dataset.url;
    my.navigateTo({ url });
  },

  onLoginTap() {
    my.navigateTo({ url: '/pages/login/index' });
  }
});
