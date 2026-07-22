const app = getApp();

Page({
  data: {
    avatar: '',
    nickname: '',
    phone: ''
  },

  onLoad() {
    const userInfo = app.globalData.userInfo;
    if (userInfo) {
      this.setData({
        avatar: userInfo.avatar || '',
        nickname: userInfo.nickname || '',
        phone: userInfo.phone || ''
      });
    }
  },

  onChooseAvatar() {
    my.chooseImage({
      count: 1,
      success: (res) => {
        if (res.apFilePaths && res.apFilePaths.length > 0) {
          this.setData({ avatar: res.apFilePaths[0] });
        }
      }
    });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onSaveTap() {
    if (!this.data.nickname.trim()) {
      my.showToast({ content: '请输入昵称', type: 'none' });
      return;
    }
    my.showLoading({ content: '保存中' });
    app.request('/user/update-profile', {
      userId: app.globalData.userInfo.userId,
      nickname: this.data.nickname,
      phone: this.data.phone,
      avatar: this.data.avatar
    }, 'POST').then(res => {
      my.hideLoading();
      if (res && res.success) {
        const updatedUser = {
          ...app.globalData.userInfo,
          nickname: this.data.nickname,
          phone: this.data.phone,
          avatar: this.data.avatar
        };
        app.globalData.userInfo = updatedUser;
        my.setStorageSync({ key: 'userInfo', data: updatedUser });
        my.showToast({ content: '保存成功', type: 'success' });
        setTimeout(() => {
          my.navigateBack();
        }, 1000);
      } else {
        my.showToast({ content: (res || {}).error || '保存失败', type: 'fail' });
      }
    }).catch(() => {
      my.hideLoading();
      my.showToast({ content: '保存失败', type: 'fail' });
    });
  }
});
