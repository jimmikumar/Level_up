import React, { useEffect, useState } from "react";
import LevelUpV1 from "./LevelUpV1";
import LevelUpV2 from "./LevelUpV2";
import LevelUpV3 from "./LevelUpV3";
import LevelUpV3_1 from "./LevelUpV3_1";
import "./v2.css";

const VERSION_KEY = "levelup-active-version";

export default function App() {
  const [version, setVersion] = useState(() => {
    try {
      const saved = localStorage.getItem(VERSION_KEY);
      return ["v1", "v2", "v3", "v3.1"].includes(saved) ? saved : "v1";
    } catch { return "v1"; }
  });

  useEffect(() => {
    try { localStorage.setItem(VERSION_KEY, version); } catch {}
  }, [version]);

  return (
    <>
      <div className="version-switch" role="group" aria-label="Choose LevelUp version">
        <span>LEVELUP</span>
        <button className={version === "v1" ? "selected" : ""} onClick={() => setVersion("v1")}>V1</button>
        <button className={version === "v2" ? "selected" : ""} onClick={() => setVersion("v2")}>V2</button>
        <button className={version === "v3" ? "selected" : ""} onClick={() => setVersion("v3")}>V3</button>
        <button className={version === "v3.1" ? "selected" : ""} onClick={() => setVersion("v3.1")}>V3.1</button>
      </div>
      {version === "v1" ? <LevelUpV1 /> : version === "v2" ? <LevelUpV2 /> : version === "v3.1" ? <LevelUpV3_1 /> : <LevelUpV3 />}
    </>
  );
}
