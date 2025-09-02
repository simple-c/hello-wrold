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

// 辅助函数：提取纯净的API名称，去除可能的查询参数
function getCleanApiName(input) {
  if (!input) return null;
  // 分割查询参数，只保留路径部分
  return input.split('?')[0];
}

// 主处理函数
module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return handleCors(res).status(200).end();
  }

  try {
    let apiName;
    
    // 方式1: 从Vercel的路径参数获取并清理
    if (req.query.path && Array.isArray(req.query.path) && req.query.path.length > 0) {
      apiName = getCleanApiName(req.query.path[0]);
    } 
    // 方式2: 从请求URL直接解析
    else if (req.url) {
      // 分割URL，只取路径部分（去除查询参数）
      const pathOnly = req.url.split('?')[0];
      const pathParts = pathOnly.split('/').filter(part => part);
      
      const apiIndex = pathParts.indexOf('api');
      if (apiIndex !== -1 && pathParts.length > apiIndex + 1) {
        const proxyIndex = pathParts.indexOf('proxy', apiIndex);
        if (proxyIndex !== -1 && pathParts.length > proxyIndex + 1) {
          apiName = pathParts[proxyIndex + 1];
        }
      }
    }

    // 详细日志
    console.log('原始路径参数:', req.query.path);
    console.log('清理后的API名称:', apiName);
    console.log('请求URL:', req.url);
    
    // 验证API名称
    if (!apiName || !API_CONFIG[apiName]) {
      return handleCors(res)
        .status(404)
        .json({ 
          error: `API not found: ${apiName}`,
          availableApis: Object.keys(API_CONFIG),
          requestUrl: req.url,
          cleanedApiName: apiName
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
    
