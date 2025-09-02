// 导入必要的模块
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // 兼容Vercel的ES模块处理

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

// 处理CORS的中间件
function handleCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// 主处理函数
module.exports = async (req, res) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return handleCors(res).status(200).end();
  }

  try {
    // 获取API名称
    const apiName = req.query.path?.[0];
    
    console.log('请求的API名称:', apiName);
    console.log('请求方法:', req.method);
    
    // 验证API名称
    if (!apiName || !API_CONFIG[apiName]) {
      return handleCors(res)
        .status(404)
        .json({ 
          error: `API not found: ${apiName}`,
          availableApis: Object.keys(API_CONFIG)
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
      timeout: 15000 // 增加超时时间
    };

    // 添加请求体
    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // 执行代理请求
    console.log(`Proxying to ${config.url}`);
    const apiResponse = await fetch(config.url, fetchOptions);
    
    // 处理非JSON响应（关键修复）
    const contentType = apiResponse.headers.get('content-type');
    let responseData;
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await apiResponse.json();
    } else {
      responseData = await apiResponse.text(); // 处理文本响应
    }
    
    // 返回响应
    return handleCors(res)
      .status(apiResponse.status)
      .json(responseData); // 即使是非JSON，也尝试序列化

  } catch (error) {
    console.error('详细错误信息:', error); // 记录完整错误
    
    let statusCode = 500;
    let errorMessage = 'Proxy server error';
    
    if (error.type === 'request-timeout') {
      statusCode = 504;
      errorMessage = 'Request timed out';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Connection refused to target API';
    } else if (error.message.includes('Failed to fetch')) {
      statusCode = 502;
      errorMessage = 'Invalid response from target API';
    }

    return handleCors(res)
      .status(statusCode)
      .json({ 
        error: errorMessage, 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
  }
};
    
