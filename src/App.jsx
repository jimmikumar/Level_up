import React, { useEffect, useState } from "react";
import LevelUpV1 from "./LevelUpV1";
import LevelUpV2 from "./LevelUpV2";
import LevelUpV3 from "./LevelUpV3";
import LevelUpV3_1 from "./LevelUpV3_1";
import LevelUpV3_2 from "./LevelUpV3_2";
import "./v2.css";

const VERSION_KEY = "levelup-active-version";

export default function App() {
  const [version, setVersion] = useState(() => {
    try {
      const saved = localStorage.getItem(VERSION_KEY);
      return ["v1", "v2", "v3", "v3.1", "v3.2"].includes(saved) ? saved : "v1";
    } catch { return "v1"; }
  });

  useEffect(() => {
    try { localStorage.setItem(VERSION_KEY, version); } catch {}
  }, [version]);

  return (
    <>
      <div className="version-switch" role="group" aria-label="Choose LevelUp version">
        <span>LEVELUP</span>
        <select aria-label="Switch LevelUp version" value={version} onChange={e => setVersion(e.target.value)}>
          <option value="v1">V1 Original</option><option value="v2">V2</option><option value="v3">V3</option><option value="v3.1">V3.1</option><option value="v3.2">V3.2 Latest</option>
        </select>
      </div>
      {version === "v1" ? <LevelUpV1 /> : version === "v2" ? <LevelUpV2 /> : version === "v3.2" ? <LevelUpV3_2 /> : version === "v3.1" ? <LevelUpV3_1 /> : <LevelUpV3 />}
    </>
  );
}
