// 导入必要的模块
const fetch = require('node-fetch');

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
  // 允许所有来源（生产环境中建议限制具体域名）
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
    // 从请求路径中提取API名称
    const pathParts = req.query.path || [];
    const apiName = pathParts[0];
    
    // 验证API名称是否存在于配置中
    if (!apiName || !API_CONFIG[apiName]) {
      return handleCors(res)
        .status(404)
        .json({ error: `API not found: ${apiName}` });
    }

    const config = API_CONFIG[apiName];
    
    // 验证请求方法是否允许
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
        // 可以添加其他需要传递的头部
      }
    };

    // 添加请求体（POST请求）
    if (req.method === 'POST' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // 执行代理请求
    console.log(`Proxying ${req.method} request to ${config.url}`);
    const apiResponse = await fetch(config.url, fetchOptions);
    
    // 处理API响应
    const responseData = await apiResponse.json();
    
    // 设置响应状态码并返回数据
    return handleCors(res)
      .status(apiResponse.status)
      .json(responseData);

  } catch (error) {
    console.error('Proxy error:', error);
    
    // 错误处理
    let statusCode = 500;
    let errorMessage = 'Proxy server error';
    
    if (error.name === 'AbortError') {
      statusCode = 504;
      errorMessage = 'Request timed out';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Connection refused to target API';
    }

    return handleCors(res)
      .status(statusCode)
      .json({ error: errorMessage, details: error.message });
  }
};
