const WEATHER_CODES = {
  0: "晴",
  1: "大部晴朗",
  2: "局部多云",
  3: "阴天",
  45: "雾",
  48: "雾凇",
  51: "小毛毛雨",
  53: "毛毛雨",
  55: "大毛毛雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  80: "阵雨",
  81: "中阵雨",
  82: "强阵雨",
  95: "雷雨",
  96: "雷雨伴有小冰雹",
  99: "雷雨伴有大冰雹"
};

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`天气服务请求失败：HTTP ${response.status}`);
  }
  return response.json();
}

// v3 提取的公共函数：两个工具都需要"城市名 → 经纬度"
async function findLocation(city) {
  if (!city || typeof city !== "string") {
    throw new Error("city 必须是非空字符串");
  }

  const locations = await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`
  );
  return locations.results?.[0] ?? null;
}

function describeCode(code) {
  return WEATHER_CODES[code] ?? `天气代码 ${code}`;
}

export async function getWeather({ city }) {
  const location = await findLocation(city);
  if (!location) {
    return { city, found: false, message: `没有找到“${city}”这个地点` };
  }

  const forecast = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&timezone=auto`
  );
  const current = forecast.current;

  return {
    city: location.name,
    country: location.country,
    timezone: forecast.timezone,
    observedAt: current.time,
    temperature: `${current.temperature_2m}${forecast.current_units.temperature_2m}`,
    apparentTemperature: `${current.apparent_temperature}${forecast.current_units.apparent_temperature}`,
    condition: describeCode(current.weather_code),
    humidity: `${current.relative_humidity_2m}${forecast.current_units.relative_humidity_2m}`,
    windSpeed: `${current.wind_speed_10m}${forecast.current_units.wind_speed_10m}`,
    source: "Open-Meteo"
  };
}

// v3 新增：未来多天预报工具
export async function getForecast({ city, days = 7 }) {
  const location = await findLocation(city);
  if (!location) {
    return { city, found: false, message: `没有找到“${city}”这个地点` };
  }

  // Open-Meteo 免费接口最多预报 16 天，这里收敛到 1~16
  const n = Math.min(Math.max(Number.parseInt(days, 10) || 7, 1), 16);
  const forecast = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=${n}`
  );
  const { daily, daily_units: units } = forecast;

  return {
    city: location.name,
    country: location.country,
    timezone: forecast.timezone,
    days: daily.time.map((date, i) => ({
      date,
      condition: describeCode(daily.weather_code[i]),
      tempMax: `${daily.temperature_2m_max[i]}${units.temperature_2m_max}`,
      tempMin: `${daily.temperature_2m_min[i]}${units.temperature_2m_min}`,
      precipitationProbability: daily.precipitation_probability_max[i] == null
        ? null
        : `${daily.precipitation_probability_max[i]}${units.precipitation_probability_max}`
    })),
    source: "Open-Meteo"
  };
}
