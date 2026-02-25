/**
 * 天气查询插件 - 改编自 TeleBox weather
 * 功能：查询全球城市天气信息（使用 Open-Meteo 免费API）
 */

import { Plugin } from "../src/types/index.js";
import axios from "axios";

// 应用Emoji
const EMOJI = {
  SUNNY: "☀️",
  CLOUDY: "☁️",
  RAINY: "🌧️",
  SNOWY: "❄️",
  FOGGY: "🌫️",
  THUNDER: "⛈️",
  SEARCH: "🔍",
  TEMP: "🌡️",
  WIND: "💨",
  HUMIDITY: "💧",
  PRESSURE: "📊",
  SUNRISE: "🌅",
  SUNSET: "🌇",
  LOADING: "🔄",
  ERROR: "❌",
  HELP: "❓",
  WORLD: "🌍",
  CHINA: "🇨🇳",
};

// Open-Meteo API 接口
interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current?: {
    time: string;
    interval: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    rain: number;
    snowfall: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    surface_pressure: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
  };
}

interface GeocodingResult {
  results?: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    country_code: string;
    admin1?: string;
    admin2?: string;
  }>;
}

// WMO天气代码映射
const weatherCodeMap: Record<number, { icon: string; description: string }> = {
  0: { icon: EMOJI.SUNNY, description: "晴朗" },
  1: { icon: "🌤️", description: "大部晴朗" },
  2: { icon: "⛅", description: "部分多云" },
  3: { icon: EMOJI.CLOUDY, description: "阴天" },
  45: { icon: EMOJI.FOGGY, description: "有雾" },
  48: { icon: EMOJI.FOGGY, description: "沉积雾凇" },
  51: { icon: "🌦️", description: "轻度细雨" },
  53: { icon: "🌦️", description: "中度细雨" },
  55: { icon: "🌦️", description: "密集细雨" },
  56: { icon: EMOJI.SNOWY, description: "轻度冻雨" },
  57: { icon: EMOJI.SNOWY, description: "密集冻雨" },
  61: { icon: EMOJI.RAINY, description: "轻度降雨" },
  63: { icon: EMOJI.RAINY, description: "中度降雨" },
  65: { icon: EMOJI.RAINY, description: "强降雨" },
  66: { icon: EMOJI.SNOWY, description: "轻度冻雨" },
  67: { icon: EMOJI.SNOWY, description: "强冻雨" },
  71: { icon: EMOJI.SNOWY, description: "轻度降雪" },
  73: { icon: EMOJI.SNOWY, description: "中度降雪" },
  75: { icon: EMOJI.SNOWY, description: "强降雪" },
  77: { icon: "🌨️", description: "雪粒" },
  80: { icon: "🌦️", description: "轻度阵雨" },
  81: { icon: EMOJI.RAINY, description: "中度阵雨" },
  82: { icon: EMOJI.THUNDER, description: "强阵雨" },
  85: { icon: "🌨️", description: "轻度阵雪" },
  86: { icon: "🌨️", description: "强阵雪" },
  95: { icon: EMOJI.THUNDER, description: "雷暴" },
  96: { icon: EMOJI.THUNDER, description: "轻度冰雹雷暴" },
  99: { icon: EMOJI.THUNDER, description: "强冰雹雷暴" }
};

// 快速映射常见城市
const quickCityMap: Record<string, string> = {
  // 中国主要城市
  "北京": "Beijing",
  "上海": "Shanghai",
  "广州": "Guangzhou",
  "深圳": "Shenzhen",
  "成都": "Chengdu",
  "杭州": "Hangzhou",
  "武汉": "Wuhan",
  "西安": "Xi'an",
  "重庆": "Chongqing",
  "南京": "Nanjing",
  "天津": "Tianjin",
  "苏州": "Suzhou",
  "长沙": "Changsha",
  "郑州": "Zhengzhou",
  "沈阳": "Shenyang",
  "青岛": "Qingdao",
  "宁波": "Ningbo",
  "东莞": "Dongguan",
  "佛山": "Foshan",
  "合肥": "Hefei",
  "大连": "Dalian",
  "厦门": "Xiamen",
  "福州": "Fuzhou",
  "哈尔滨": "Harbin",
  "济南": "Jinan",
  "长春": "Changchun",
  "昆明": "Kunming",
  "南宁": "Nanning",
  "贵阳": "Guiyang",
  "兰州": "Lanzhou",
  "海口": "Haikou",
  "乌鲁木齐": "Urumqi",
  "银川": "Yinchuan",
  "西宁": "Xining",
  "拉萨": "Lhasa",
  "呼和浩特": "Hohhot",
  "太原": "Taiyuan",
  "石家庄": "Shijiazhuang",
  "南昌": "Nanchang",
  "香港": "Hong Kong",
  "澳门": "Macau",
  "台北": "Taipei",
  // 国际主要城市
  "东京": "Tokyo",
  "大阪": "Osaka",
  "首尔": "Seoul",
  "新加坡": "Singapore",
  "曼谷": "Bangkok",
  "吉隆坡": "Kuala Lumpur",
  "雅加达": "Jakarta",
  "马尼拉": "Manila",
  "河内": "Hanoi",
  "胡志明市": "Ho Chi Minh City",
  "新德里": "New Delhi",
  "孟买": "Mumbai",
  "迪拜": "Dubai",
  "伦敦": "London",
  "巴黎": "Paris",
  "柏林": "Berlin",
  "马德里": "Madrid",
  "罗马": "Rome",
  "阿姆斯特丹": "Amsterdam",
  "莫斯科": "Moscow",
  "纽约": "New York",
  "洛杉矶": "Los Angeles",
  "旧金山": "San Francisco",
  "芝加哥": "Chicago",
  "西雅图": "Seattle",
  "波士顿": "Boston",
  "迈阿密": "Miami",
  "拉斯维加斯": "Las Vegas",
  "温哥华": "Vancouver",
  "多伦多": "Toronto",
  "悉尼": "Sydney",
  "墨尔本": "Melbourne",
  "奥克兰": "Auckland",
};

// HTML转义
function htmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 风向计算
function calcWindDirection(deg: number): string {
  const dirs = ["北", "北东北", "东北", "东东北", "东", "东东南", "东南", "南东南",
    "南", "南西南", "西南", "西西南", "西", "西西北", "西北", "北西北"];
  const ix = Math.round(deg / 22.5);
  return dirs[ix % 16];
}

const weatherPlugin: Plugin = {
  name: "weather",
  version: "1.0.0",
  description: "查询全球城市天气",
  author: "TeleBox adapted for NexBot",

  commands: {
    weather: {
      description: "查询城市天气",
      aliases: ["tianqi", "tq"],
      examples: ["weather 北京", "weather Shanghai", "weather Tokyo"],
      handler: async (msg, args, ctx) => {
        try {
          // 无参数显示帮助
          if (args.length === 0) {
            await ctx.replyHTML(
              `${EMOJI.WORLD} <b>天气查询</b>\n\n` +
              `<b>用法：</b><code>.weather &lt;城市名&gt;</code>\n\n` +
              `<b>示例：</b>\n` +
              `<code>.weather 北京</code>\n` +
              `<code>.weather Shanghai</code>\n` +
              `<code>.weather Tokyo</code>\n\n` +
              `<b>支持中文/英文城市名</b>`
            );
            return;
          }

          let cityName = args.join(" ");
          const originalInput = cityName;

          // 检查快速映射
          if (quickCityMap[cityName]) {
            cityName = quickCityMap[cityName];
          }

          // 地理编码：获取城市坐标
          const geoResponse = await axios.get<GeocodingResult>(
            "https://geocoding-api.open-meteo.com/v1/search",
            {
              params: {
                name: cityName,
                count: 10,
                language: "zh",
                format: "json"
              },
              timeout: 10000
            }
          );

          if (!geoResponse.data.results || geoResponse.data.results.length === 0) {
            await ctx.replyHTML(
              `${EMOJI.ERROR} <b>城市未找到</b>\n\n` +
              `无法找到城市: <code>${htmlEscape(originalInput)}</code>\n\n` +
              `<b>建议：</b>\n` +
              `• 检查城市名拼写\n` +
              `• 尝试使用英文名称\n` +
              `• 尝试添加国家名，如: Beijing China`
            );
            return;
          }

          // 选择第一个匹配结果
          const location = geoResponse.data.results[0];

          // 构建位置名称
          const locationParts: string[] = [];
          if (location.name && location.name !== "undefined") {
            locationParts.push(location.name);
          }
          if (location.admin1 && location.admin1 !== "undefined" && location.admin1 !== location.name) {
            locationParts.push(location.admin1);
          }
          if (location.country && location.country !== "undefined") {
            locationParts.push(location.country);
          }
          const locationName = locationParts.join(", ");

          // 获取天气数据
          const weatherResponse = await axios.get<OpenMeteoResponse>(
            "https://api.open-meteo.com/v1/forecast",
            {
              params: {
                latitude: location.latitude,
                longitude: location.longitude,
                current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
                daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max",
                timezone: "auto",
                forecast_days: 1
              },
              timeout: 10000
            }
          );

          const data = weatherResponse.data;

          if (!data.current) {
            await ctx.reply(`${EMOJI.ERROR} 无法获取天气数据`);
            return;
          }

          // 构建天气报告
          const current = data.current;
          const weatherInfo = weatherCodeMap[current.weather_code] || { icon: "❓", description: "未知" };
          
          let report = `${weatherInfo.icon} <b>${htmlEscape(locationName)}</b>\n`;
          report += `${weatherInfo.description} · ${EMOJI.TEMP} ${current.temperature_2m}°C\n\n`;
          
          report += `<b>详细数据：</b>\n`;
          report += `${EMOJI.TEMP} 体感温度: ${current.apparent_temperature}°C\n`;
          report += `${EMOJI.HUMIDITY} 湿度: ${current.relative_humidity_2m}%\n`;
          report += `${EMOJI.WIND} 风速: ${current.wind_speed_10m} km/h (${calcWindDirection(current.wind_direction_10m)})\n`;
          report += `${EMOJI.PRESSURE} 气压: ${current.pressure_msl} hPa\n`;
          
          if (data.daily) {
            const daily = data.daily;
            report += `\n<b>今日预报：</b>\n`;
            report += `🔺 最高: ${daily.temperature_2m_max[0]}°C · 🔻 最低: ${daily.temperature_2m_min[0]}°C\n`;
            if (daily.sunrise && daily.sunrise[0]) {
              const sunrise = new Date(daily.sunrise[0]).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
              const sunset = new Date(daily.sunset[0]).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
              report += `${EMOJI.SUNRISE} 日出: ${sunrise} · ${EMOJI.SUNSET} 日落: ${sunset}`;
            }
          }

          await ctx.replyHTML(report);

        } catch (error: any) {
          console.error("[weather] 插件执行失败:", error);
          
          if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
            await ctx.reply(`${EMOJI.ERROR} 请求超时，请稍后重试`);
            return;
          }
          
          await ctx.reply(`${EMOJI.ERROR} 查询失败: ${error.message || "未知错误"}`);
        }
      },
    },
  },
};

export default weatherPlugin;
