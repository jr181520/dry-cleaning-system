/**
 * 网络请求封装（支付宝小程序版）
 * 封装 my.request + mock 降级
 */

const app = getApp();

/**
 * 通用请求
 */
function request(url, data = {}, method = 'GET') {
  return app.request(url, data, method);
}

/**
 * GET 请求
 */
function get(url, data = {}) {
  return request(url, data, 'GET');
}

/**
 * POST 请求
 */
function post(url, data = {}) {
  return request(url, data, 'POST');
}

/**
 * PUT 请求
 */
function put(url, data = {}) {
  return request(url, data, 'PUT');
}

/**
 * DELETE 请求
 */
function del(url, data = {}) {
  return request(url, data, 'DELETE');
}

/**
 * 上传文件
 */
function uploadFile(filePath, formData = {}) {
  return new Promise((resolve, reject) => {
    my.uploadFile({
      url: app.globalData.apiBaseUrl + '/upload',
      filePath: filePath,
      fileName: 'file',
      formData: formData,
      header: {
        'Authorization': app.globalData.token ? `Bearer ${app.globalData.token}` : ''
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          resolve(data);
        } catch (e) {
          resolve({ success: true, url: res.data });
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

module.exports = { request, get, post, put, del, uploadFile };
