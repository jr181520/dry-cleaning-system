const app = getApp();

Page({
  data: {
    userInfo: {
      avatar: '',
      nickname: '',
      phone: '',
      gender: 0,
      birthday: ''
    },
    today: '',
    saving: false
  },

  onLoad() {
    // 计算今天日期（用于生日picker的end）
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.setData({ today });

    // 加载当前用户信息
    this.loadUserInfo();
  },

  async loadUserInfo() {
    // 先从本地加载（快速展示）
    const storedInfo = wx.getStorageSync('userInfo') || {};
    this.applyUserInfo(storedInfo);

    // 再从后端同步最新数据
    try {
      const res = await app.request('/auth/profile');
      if (res && res.success && res.data) {
        const serverData = {
          avatar: res.data.avatar || '',
          nickname: res.data.name || res.data.nickname || '',
          phone: res.data.phone || '',
          gender: res.data.gender !== undefined ? res.data.gender : 0,
          birthday: res.data.birthday || ''
        };
        // 合并到本地存储
        wx.setStorageSync('userInfo', { ...storedInfo, ...serverData });
        if (app.globalData) {
          app.globalData.userInfo = { ...storedInfo, ...serverData };
        }
        this.applyUserInfo(serverData);
      }
    } catch (err) {
      console.log('从后端加载用户信息失败，使用本地数据', err);
    }
  },

  applyUserInfo(info) {
    this.setData({
      userInfo: {
        avatar: info.avatar || '',
        nickname: info.nickname || '',
        phone: info.phone || '',
        gender: info.gender !== undefined ? info.gender : 0,
        birthday: info.birthday || ''
      }
    });
  },

  // 更换头像
  onChangeAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        // 先本地预览
        this.setData({
          'userInfo.avatar': tempFilePath
        });
        // TODO: 上传到服务器获取永久URL
        // 当前先用临时路径
        app.showToast('头像已更换，保存后生效', 'success');
      },
      fail: (err) => {
        if (err.errMsg.indexOf('cancel') === -1) {
          app.showToast('选择图片失败', 'none');
        }
      }
    });
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    });
  },

  // 手机号输入
  onPhoneInput(e) {
    this.setData({
      'userInfo.phone': e.detail.value
    });
  },

  // 性别选择
  onGenderSelect(e) {
    const gender = parseInt(e.currentTarget.dataset.gender);
    this.setData({
      'userInfo.gender': gender
    });
  },

  // 生日选择
  onBirthdayChange(e) {
    this.setData({
      'userInfo.birthday': e.detail.value
    });
  },

  // 保存修改
  async onSave() {
    const { userInfo } = this.data;

    // 校验昵称
    if (!userInfo.nickname || !userInfo.nickname.trim()) {
      app.showToast('请输入昵称', 'none');
      return;
    }

    // 校验手机号
    if (userInfo.phone && !/^1[3-9]\d{9}$/.test(userInfo.phone)) {
      app.showToast('请输入正确的手机号', 'none');
      return;
    }

    this.setData({ saving: true });

    try {
      // 先更新localStorage
      const storedInfo = wx.getStorageSync('userInfo') || {};
      const updatedInfo = {
        ...storedInfo,
        avatar: userInfo.avatar,
        nickname: userInfo.nickname.trim(),
        phone: userInfo.phone,
        gender: userInfo.gender,
        birthday: userInfo.birthday
      };
      wx.setStorageSync('userInfo', updatedInfo);

      // 同步手机号到 userDeliveryInfo（订单页跨平台查询依赖此字段）
      if (userInfo.phone) {
        const deliveryInfo = wx.getStorageSync('userDeliveryInfo') || {};
        deliveryInfo.contactPhone = userInfo.phone;
        wx.setStorageSync('userDeliveryInfo', deliveryInfo);
        console.log('[个人资料] 📱 手机号已同步到配送信息:', userInfo.phone);
      }

      // 同步更新app全局数据
      if (app.globalData) {
        app.globalData.userInfo = updatedInfo;
      }

      // 尝试同步到后端
      try {
        const result = await app.request('/auth/profile', updatedInfo, 'PUT');
        
        // 处理账户合并（手机号匹配到已有C端用户）
        if (result && result.data && result.data.__merged) {
          console.log('[个人资料] 🔗 账户合并: 手机号匹配到已有C端账户');
          
          // 使用合并后的用户数据
          const mergedUser = result.data.user;
          const mergedInfo = {
            ...updatedInfo,
            _id: mergedUser._id,
            name: mergedUser.name || updatedInfo.name,
            nickname: mergedUser.name || updatedInfo.nickname || '',
            phone: mergedUser.phone || updatedInfo.phone,
            avatar: mergedUser.avatar || updatedInfo.avatar,
            openid: mergedUser.openid || updatedInfo.openid,
            creditScore: mergedUser.creditScore,
            userNo: mergedUser.userNo || ''
          };
          
          wx.setStorageSync('userInfo', mergedInfo);
          if (app.globalData) {
            app.globalData.userInfo = mergedInfo;
          }
          
          // 更新token（合并后的新令牌）
          if (result.data.token) {
            wx.setStorageSync('token', result.data.token);
            app.globalData.token = result.data.token;
            console.log('[个人资料] ✅ 已切换为合并后的账户token');
          }
          
          app.showToast('账户已绑定', 'success');
        } else {
          app.showToast('保存成功', 'success');
        }
      } catch (err) {
        console.log('后端同步失败，仅本地保存', err);
        app.showToast('保存成功', 'success');
      }

      // 延迟返回，让用户看到提示
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    } catch (error) {
      console.error('保存用户信息失败:', error);
      app.showToast('保存失败，请重试', 'none');
    } finally {
      this.setData({ saving: false });
    }
  }
});
