/**
 * 用户认证服务
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// 用户 Schema
const userSchema = new mongoose.Schema({
  userNo: { type: String, unique: true, index: true },
  phone: { type: String, sparse: true, index: true }, // 移除unique约束，允许为空
  password: String,
  openid: { type: String, sparse: true, index: true }, // 微信openid，用于跨平台用户识别
  name: String,
  avatar: String,
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
  birthday: Date,
  roles: [{ type: String, enum: ['customer', 'store_staff', 'store_owner', 'recycler', 'appraiser', 'brand_admin', 'chain_admin', 'admin', 'merchant'], default: 'customer' }],
  storeId: String, // 如果是门店角色，关联的门店
  status: { type: String, enum: ['active', 'inactive', 'banned'], default: 'active' },
  creditScore: { type: Number, default: 100 },
  realNameVerified: { type: Boolean, default: false },
  lastLoginAt: Date,
  lastLoginIp: String,
  loginCount: { type: Number, default: 0 },
  address: [{
    name: String,
    phone: String,
    province: String,
    city: String,
    district: String,
    address: String,
    postalCode: String,
    isDefault: Boolean
  }],
  // 数据来源和层级关系
  registrationSource: { 
    type: String, 
    enum: ['web_customer', 'wechat_mini', 'store_app', 'admin_system', 'chain-admin', 'unknown'],
    default: 'unknown'
  },  // 注册来源：C端网页、微信小程序、门店APP、后台系统
  sourcePlatform: { type: String },  // 来源平台标识
  chainId: { type: String, index: true },  // 所属连锁ID（通过门店关联）
  createdFrom: { type: String, default: 'app' }  // 兼容旧字段
}, { timestamps: true });

userSchema.index({ roles: 1 });
userSchema.index({ storeId: 1 });
userSchema.index({ status: 1 });
userSchema.index({ openid: 1 }); // 微信openid索引

// 密码中间件
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && !this.password.startsWith('$2')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

class AuthService {
  /**
   * 用户注册
   */
  async register(phone, password, userData = {}) {
    // 检查手机号是否已注册
    const existing = await User.findOne({ phone });
    if (existing) {
      throw new Error('手机号已注册');
    }

    const userNo = 'U' + Date.now() + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    const user = await User.create({
      userNo,
      phone,
      password,
      name: userData.name || phone.slice(-4),
      roles: userData.roles || ['customer'],
      storeId: userData.storeId,
      registrationSource: userData.registrationSource || 'unknown',
      sourcePlatform: userData.sourcePlatform,
      chainId: userData.chainId,
      createdFrom: userData.createdFrom || 'app'
    });

    // 生成 token
    const token = this.generateToken(user._id);
    
    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  /**
   * 用户登录
   */
  async login(phone, password) {
    const user = await User.findOne({ phone, status: 'active' });
    if (!user) {
      throw new Error('用户不存在或已被禁用');
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('密码错误');
    }

    // 更新登录信息
    user.lastLoginAt = new Date();
    user.loginCount += 1;
    await user.save();

    // 生成 token
    const token = this.generateToken(user._id);
    
    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  /**
   * 微信登录（支持网页端和小程序）
   */
  async wechatLogin(openid, userData = {}) {
    console.log('[wechatLogin] 开始执行, openid:', openid, '平台:', userData.platform || 'unknown');
    
    if (!openid) {
      throw new Error('openid不能为空');
    }
    
    // 优先通过openid查找用户
    let user = await User.findOne({ openid: openid });
    console.log('[wechatLogin] 通过openid查找用户:', user ? '找到' : '未找到');
    
    // 如果没找到，尝试通过phone查找（兼容旧数据）
    if (!user) {
      user = await User.findOne({ phone: openid, createdFrom: 'wechat' });
      console.log('[wechatLogin] 通过phone查找旧用户:', user ? '找到' : '未找到');
      
      // 如果找到旧用户，迁移openid
      if (user) {
        user.openid = openid;
        await user.save();
        console.log('[wechatLogin] 旧用户openid迁移成功');
      }
    }
    
    if (!user) {
      // 新用户自动注册
      const userNo = 'U' + Date.now() + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      console.log('[wechatLogin] 创建新用户, userNo:', userNo);
      
      user = await User.create({
        userNo,
        phone: userData.phone || '', // phone可选，不强制
        openid: openid, // 存储openid
        password: '', // 微信登录无需密码
        name: userData.nickname || userData.name || '微信用户',
        avatar: userData.headimgurl || userData.avatar || '',
        gender: userData.sex === 1 ? 'male' : (userData.sex === 2 ? 'female' : 'unknown'),
        roles: ['customer'],
        createdFrom: userData.platform || 'wechat' // 标记创建平台
      });
      
      console.log('[wechatLogin] 用户创建成功, userId:', user._id);
    } else {
      // 更新用户信息
      if (userData.nickname || userData.name) {
        user.name = userData.nickname || userData.name;
      }
      if (userData.headimgurl || userData.avatar) {
        user.avatar = userData.headimgurl || userData.avatar;
      }
    }

    // 更新登录信息
    user.lastLoginAt = new Date();
    user.loginCount += 1;
    await user.save();

    const token = this.generateToken(user._id);
    console.log('[wechatLogin] 生成token:', token ? '成功' : '失败');
    
    const result = {
      user: this.sanitizeUser(user),
      token,
      openid: user.openid // 返回openid用于标识用户
    };
    console.log('[wechatLogin] 返回结果:', JSON.stringify(result).substring(0, 200));
    
    return result;
  }

  /**
   * 校验是否为合法 MongoDB ObjectId
   */
  _isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
  }

  /**
   * 获取用户信息
   */
  async getUserById(userId) {
    if (!this._isValidObjectId(userId)) {
      throw new Error('用户不存在（无效ID格式）');
    }
    const user = await User.findById(userId).lean();
    if (!user) throw new Error('用户不存在');
    return this.sanitizeUser(user);
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId, updateData) {
    // 非 ObjectId 格式的 userId（如开发模式 mock_token）不支持更新
    if (!this._isValidObjectId(userId)) {
      throw new Error('当前用户ID格式不支持更新，请使用正式账号');
    }
    const user = await User.findById(userId);
    if (!user) throw new Error('用户不存在');
    
    // 前端传 nickname → 映射为 name
    if (updateData.nickname !== undefined && updateData.name === undefined) {
      updateData.name = updateData.nickname;
    }
    
    // ================================================================
    // 跨平台身份合并：小程序填写手机号时自动绑定已有C端账户
    // ================================================================
    let mergedTarget = null;
    if (updateData.phone && updateData.phone !== user.phone) {
      // 查找是否有其他用户已注册此手机号（C端用户）
      const existingUser = await User.findOne({ 
        phone: updateData.phone, 
        _id: { $ne: user._id }  // 排除自己
      });
      
      if (existingUser) {
        console.log('[用户合并] 发现同手机号用户:', {
          currentId: user._id,
          currentOpenid: user.openid,
          currentCreatedFrom: user.createdFrom,
          existingId: existingUser._id,
          existingOpenid: existingUser.openid,
          existingCreatedFrom: existingUser.createdFrom
        });
        
        // 合并策略：将小程序的 openid 绑定到已有C端账户
        if (!existingUser.openid && user.openid) {
          // C端用户没有openid → 迁移openid到C端用户
          existingUser.openid = user.openid;
          await existingUser.save();
          
          // 更新所有订单的 userId（从小程序用户ID → C端用户ID）
          const Order = require('mongoose').model('Order');
          const updateResult = await Order.updateMany(
            { userId: String(user._id) },
            { $set: { userId: String(existingUser._id), _mergedFrom: String(user._id) } }
          );
          console.log('[用户合并] 订单迁移:', updateResult.modifiedCount, '条');
          
          // 标记原用户为已合并
          user.status = 'merged';
          user.mergedTo = existingUser._id;
          await user.save();
          
          // 返回合并后的用户
          mergedTarget = existingUser;
          console.log('[用户合并] ✅ 手机号匹配，已合并账户');
        } else if (existingUser.openid && user.openid && existingUser.openid !== user.openid) {
          // 两者都有不同的 openid（异常情况），仅更新当前用户手机号
          console.warn('[用户合并] ⚠️ 两个用户都有不同openid，不做合并，仅更新手机号');
        } else {
          // 其他情况：简单更新手机号
          console.log('[用户合并] 不做合并，仅更新手机号');
        }
      }
    }
    
    const allowedFields = ['name', 'avatar', 'gender', 'birthday', 'phone', 'address'];
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    }
    
    await user.save();
    
    // 如果发生了合并，返回合并后的用户信息
    if (mergedTarget) {
      mergedTarget.lastLoginAt = new Date();
      mergedTarget.loginCount += 1;
      await mergedTarget.save();
      return {
        ...this.sanitizeUser(mergedTarget),
        __merged: true,
        __mergedFrom: user._id
      };
    }
    
    return this.sanitizeUser(user);
  }

  /**
   * 修改密码
   */
  async changePassword(userId, oldPassword, newPassword) {
    if (!this._isValidObjectId(userId)) {
      throw new Error('当前用户ID格式不支持修改密码，请使用正式账号');
    }
    const user = await User.findById(userId);
    if (!user) throw new Error('用户不存在');
    
    if (user.password) {
      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) throw new Error('原密码错误');
    }
    
    user.password = newPassword;
    await user.save();
    
    return { success: true };
  }

  /**
   * 重置密码（忘记密码）
   */
  async resetPassword(phone, newPassword) {
    const user = await User.findOne({ phone });
    if (!user) throw new Error('用户不存在');
    
    user.password = newPassword;
    await user.save();
    
    return { success: true };
  }

  /**
   * 通过账号（手机号/工号）查找门店员工或连锁管理员
   */
  async findStaffByAccount(account) {
    const staffRoles = ['store_staff', 'store_owner', 'chain_admin', 'merchant'];

    // 先通过手机号查找
    let user = await User.findOne({
      phone: account,
      roles: { $in: staffRoles },
      status: 'active'
    });

    // 再通过工号查找
    if (!user) {
      user = await User.findOne({
        userNo: account,
        roles: { $in: staffRoles },
        status: 'active'
      });
    }

    return user;
  }

  /**
   * 验证员工密码
   */
  async verifyStaffPassword(user, password) {
    if (!user.password) return false;
    return bcrypt.compare(password, user.password);
  }

  /**
   * 绑定微信openid到员工账户
   */
  async bindWechatToStaff(openid, staffUser) {
    // 检查是否已有该openid的顾客账户
    const existingCustomer = await User.findOne({ openid: openid });
    
    if (existingCustomer && existingCustomer._id.toString() !== staffUser._id.toString()) {
      // 合并：将员工角色添加到顾客账户
      if (!existingCustomer.roles.includes('store_staff') && !existingCustomer.roles.includes('store_owner')) {
        existingCustomer.roles = [...existingCustomer.roles, ...(staffUser.roles.filter(r => r !== 'customer'))];
      }
      existingCustomer.storeId = staffUser.storeId;
      if (!existingCustomer.openid) existingCustomer.openid = openid;
      await existingCustomer.save();
      
      // 更新staffUser的openid引用
      staffUser.openid = openid;
      await staffUser.save();
      return;
    }
    
    // 直接绑定openid
    if (!staffUser.openid) {
      staffUser.openid = openid;
      await staffUser.save();
    }
  }

  /**
   * 获取门店员工列表
   */
  async getStoreStaff(storeId) {
    const staff = await User.find({ 
      storeId, 
      roles: { $in: ['store_staff', 'store_owner'] },
      status: 'active'
    }).select('-password').lean();
    
    return staff;
  }

  /**
   * 发送验证码（模拟）
   */
  async sendVerifyCode(phone, type = 'login') {
    // 实际项目中应该调用短信服务
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    
    // 存储验证码（实际应该用 Redis）
    this.verifyCodes = this.verifyCodes || {};
    this.verifyCodes[phone] = {
      code,
      expires: Date.now() + 5 * 60 * 1000 // 5分钟有效
    };
    
    console.log(`[验证码] ${phone}: ${code}`);
    
    // 开发环境返回验证码方便测试
    const result = { success: true, message: '验证码已发送' };
    if (process.env.NODE_ENV !== 'production') {
      result.code = code;
    }
    
    return result;
  }

  /**
   * 验证验证码
   */
  async verifyCode(phone, code) {
    const record = this.verifyCodes?.[phone];
    
    if (!record) {
      throw new Error('验证码已过期');
    }
    
    if (Date.now() > record.expires) {
      delete this.verifyCodes[phone];
      throw new Error('验证码已过期');
    }
    
    if (record.code !== code) {
      throw new Error('验证码错误');
    }
    
    delete this.verifyCodes[phone];
    return true;
  }

  // 生成 Token（简化版）
  generateToken(userId) {
    return Buffer.from(`${userId}:${Date.now()}:${uuidv4()}`).toString('base64');
  }

  // 解析 Token
  parseToken(token) {
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const [userId, timestamp] = decoded.split(':');
      return { userId, timestamp: parseInt(timestamp) };
    } catch {
      return null;
    }
  }

  // 清理敏感信息
  sanitizeUser(user) {
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.password;
    // 确保返回openid用于跨平台用户识别
    if (obj.openid) {
      obj.openid = obj.openid;
    }
    return obj;
  }
}

module.exports = new AuthService();
