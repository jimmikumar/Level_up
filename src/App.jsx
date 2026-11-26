import React, { useEffect, useState } from "react";
import LevelUpV1 from "./LevelUpV1";
import LevelUpV2 from "./LevelUpV2";
import "./v2.css";

const VERSION_KEY = "levelup-active-version";

export default function App() {
  const [version, setVersion] = useState(() => {
    try { return localStorage.getItem(VERSION_KEY) === "v2" ? "v2" : "v1"; }
    catch { return "v1"; }
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
      </div>
      {version === "v1" ? <LevelUpV1 /> : <LevelUpV2 />}
    </>
  );
}
