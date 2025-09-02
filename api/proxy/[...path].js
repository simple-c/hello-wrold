// 导入必要的模块
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 配置要代理的API
const API_CONFIG = {
  'runes': {
    url: 'http://74.82.199.248:8002/api/runes/2:0?limit=5000',
    methods: ['GET']
  },
  'fees': {
    url: 'https://unisat.mempool.space/api/v1/fees/mempool-blocks',
    methods: ['GET']
  },
  'prices': {
    url: 'https://unisat.mempool.space/api/v1/prices',
    methods: ['GET']
  },
  'market': {
    url: 'https://alkanes-api.idclub.io/market/listing',
    methods: ['POST']
  }
};

// 处理CORS
function handleCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// 主处理函数
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return handleCors(res).status(200).end();
  }

  try {
    // 多种方式获取API名称，提高兼容性
    let apiName;
    
    // 方式1: 从Vercel的路径参数获取
    if (req.query.path && Array.isArray(req.query.path) && req.query.path.length > 0) {
      apiName = req.query.path[0];
    } 
    // 方式2: 从请求URL直接解析
    else if (req.url) {
      const pathParts = req.url.split('/').filter(part => part);
      // 寻找api之后的路径部分
      const apiIndex = pathParts.indexOf('api');
      if (apiIndex !== -1 && pathParts.length > apiIndex + 1) {
        // 确保找到proxy后的部分
        const proxyIndex = pathParts.indexOf('proxy', apiIndex);
        if (proxyIndex !== -1 && pathParts.length > proxyIndex + 1) {
          apiName = pathParts[proxyIndex + 1];
        }
      }
    }

    // 详细日志，帮助调试
    console.log('解析到的API名称:', apiName);
    console.log('请求URL:', req.url);
    console.log('路径参数:', req.query.path);
    
    // 验证API名称
    if (!apiName || !API_CONFIG[apiName]) {
      return handleCors(res)
        .status(404)
        .json({ 
          error: `API not found: ${apiName}`,
          availableApis: Object.keys(API_CONFIG),
          requestUrl: req.url
        });
    }

    const config = API_CONFIG[apiName];
    
    // 验证请求方法
    if (!config.methods.includes(req.method)) {
      return handleCors(res)
        .status(405)
        .json({ error: `Method ${req.method} not allowed for ${apiName}` });
    }

    // 构建请求选项
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000
    };

    // 添加请求体
    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // 执行代理请求
    console.log(`Proxying ${req.method} to ${config.url}`);
    const apiResponse = await fetch(config.url, fetchOptions);
    
    // 处理响应
    const contentType = apiResponse.headers.get('content-type');
    let responseData;
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await apiResponse.json();
    } else {
      responseData = await apiResponse.text();
    }
    
    return handleCors(res)
      .status(apiResponse.status)
      .json(responseData);

  } catch (error) {
    console.error('代理错误:', error);
    
    let statusCode = 500;
    let errorMessage = 'Proxy server error';
    
    if (error.type === 'request-timeout') {
      statusCode = 504;
      errorMessage = 'Request timed out';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Connection refused to target API';
    }

    return handleCors(res)
      .status(statusCode)
      .json({ error: errorMessage });
  }
};
    
