(function(global){
  function slugCode(value, fallback = "code"){
    return String(value || fallback)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback;
  }

  function normalizeAttendanceCodes(codes, defaultAttendanceCodes = [], attendanceCodeTones = {}){
    const rows = Array.isArray(codes) ? codes : defaultAttendanceCodes;
    const seen = new Set();
    return rows.map((code, index) => {
      const baseId = slugCode(code.id || code.label || code.short, `code-${index + 1}`);
      let id = baseId;
      let suffix = 2;
      while(seen.has(id)){
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      seen.add(id);
      return {
        id,
        label:String(code.label || code.short || "Code").trim(),
        short:String(code.short || code.label || "?").trim().slice(0, 4).toUpperCase(),
        tone:attendanceCodeTones[code.tone] ? code.tone : "green",
        teamIds:[...new Set([
          ...(Array.isArray(code.teamIds) ? code.teamIds : []),
          ...(code.teamId ? [code.teamId] : [])
        ].map(value => String(value || "").trim()).filter(Boolean))]
      };
    }).filter(code => code.label && code.short);
  }

  function mergeAttendanceCodes(codes, defaultAttendanceCodes = [], attendanceCodeTones = {}){
    const byId = new Map(
      normalizeAttendanceCodes(defaultAttendanceCodes, defaultAttendanceCodes, attendanceCodeTones)
        .map(code => [code.id, code])
    );
    normalizeAttendanceCodes(Array.isArray(codes) ? codes : [], defaultAttendanceCodes, attendanceCodeTones)
      .forEach(code => {
        const current = byId.get(code.id) || {};
        byId.set(code.id, {
          ...current,
          ...code,
          teamIds:code.teamIds?.length ? code.teamIds : (current.teamIds || [])
        });
      });
    return [...byId.values()];
  }

  global.CoachPulsePresenceAttendanceCodes = {
    mergeAttendanceCodes,
    normalizeAttendanceCodes,
    slugCode
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = global.CoachPulsePresenceAttendanceCodes;
  }
})(typeof window !== "undefined" ? window : globalThis);
