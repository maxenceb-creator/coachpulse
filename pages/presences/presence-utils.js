(function(global){
  function esc(value){
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[char]));
  }

  function readJson(key, fallback){
    const storage = global.CoachPulseStorage;
    if(storage?.getJson) return storage.getJson(key, fallback);
    return fallback;
  }

  function parseDate(value){
    if(!value) return null;
    const text = String(value).slice(0,10);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  function isoDate(date){
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(date, days){
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function addMonths(date, months){
    const originalDay = date.getDate();
    const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(originalDay, lastDay));
    return next;
  }

  function sameDay(a,b){
    return a && b && isoDate(a) === isoDate(b);
  }

  function hexToRgb(hex){
    const clean = String(hex || "").replace("#", "");
    const value = parseInt(clean.length === 3 ? clean.split("").map(char => char + char).join("") : clean, 16);
    return Number.isFinite(value) ? `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}` : "29,153,91";
  }

  global.CoachPulsePresencesUtils = {
    addDays,
    addMonths,
    esc,
    hexToRgb,
    isoDate,
    parseDate,
    readJson,
    sameDay
  };
})(typeof window !== "undefined" ? window : globalThis);
