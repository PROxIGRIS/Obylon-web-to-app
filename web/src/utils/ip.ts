export async function getClientIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return data.ip;
  } catch (error) {
    console.error("Failed to fetch IP", error);
    return "Unknown IP";
  }
}

export async function getIpAndLocation(): Promise<{ ip: string; location: string }> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    
    let locationStr = "Unknown Location";
    if (data.city && data.country_name) {
      locationStr = `${data.city}, ${data.country_name} (${data.org || "Unknown ISP"})`;
    }
    
    return {
      ip: data.ip || "Unknown IP",
      location: locationStr
    };
  } catch (error) {
    console.error("Failed to fetch IP & Location", error);
    const ip = await getClientIp(); // Fallback to basic IP if ipapi.co is rate limited
    return { ip, location: "Unknown Location" };
  }
}
