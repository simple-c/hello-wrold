export default async function handler(req, res) {
  // 要代理的API地址和支持的方法，与Flask配置对应
  const API_CONFIG = {
    'runes': {
      'url': 'http://74.82.199.248:8002/api/runes/2:0?limit=5000',
      'methods': ['GET']
    },
    'fees': {
      'url': 'https://unisat.mempool.space/api/v1/fees/mempool-blocks',
      'methods': ['GET']
    },
    'prices': {
      'url': 'https://unisat.mempool.space/api/v1/prices',
      'methods': ['GET']
    },
    'market': {
      'url': 'https://alkanes-api.idclub.io/market/listing',
      'methods': ['POST']
    }
  };

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 获取API名称
    const { apiName } = req.query;
    
    // 检查API是否存在
    if (!API_CONFIG[apiName]) {
      console.warn(`API not found: ${apiName}`);
      return res.status(404).json({ error: 'API not found' });
    }

    const config = API_CONFIG[apiName];
    const currentMethod = req.method;

    // 检查方法是否允许
    if (!config.methods.includes(currentMethod)) {
      console.warn(`Method ${currentMethod} not allowed for ${apiName}`);
      return res.status(405).json({ error: `Method ${currentMethod} not allowed` });
    }

    // 准备请求参数
    const requestOptions = {
      method: currentMethod,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10秒超时
    };

    // 添加请求体（POST方法）
    if (currentMethod === 'POST') {
      requestOptions.body = JSON.stringify(req.body);
    }

    // 发送请求到目标API
    const response = await fetch(config.url, requestOptions);
    
    console.info(`Proxy request to ${apiName} succeeded, status code: ${response.status}`);

    // 解析响应
    const data = await response.json();
    
    // 返回原始响应数据和状态码
    return res.status(response.status).json(data);

  } catch (error) {
    // 错误处理
    console.error(`Error proxying request: ${error.message}`);
    
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Connection error' });
    }
    
    return res.status(500).json({ error: error.message });
  }
}
    
