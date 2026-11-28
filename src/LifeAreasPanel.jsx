import React, { useMemo, useState } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from "recharts";
import { Heart, Save } from "lucide-react";

const DEFAULT_AREAS = [
  { key: "career", label: "Career", score: 0 },
  { key: "business", label: "Business", score: 0 },
  { key: "finance", label: "Finance", score: 0 },
  { key: "health", label: "Health", score: 0 },
  { key: "learning", label: "Learning", score: 0 },
  { key: "relationships", label: "Relationships", score: 0 },
  { key: "personal", label: "Personal growth", score: 0 }
];

export default function LifeAreasPanel({ areas, onChange, language = "en" }) {
  const [draft, setDraft] = useState(() => {
    const saved = Array.isArray(areas) ? areas : [];
    return DEFAULT_AREAS.map(item => ({ ...item, ...(saved.find(x => x.key === item.key) || {}) }));
  });
  const hindi = language === "hi";
  const chartData = useMemo(() => draft.map(item => ({
    area: hindi ? ({
      career: "करियर", business: "व्यवसाय", finance: "वित्त",
      health: "स्वास्थ्य", learning: "सीखना", relationships: "रिश्ते",
      personal: "व्यक्तिगत विकास"
    })[item.key] : item.label,
    score: Number(item.score) || 0,
    fullMark: 10
  })), [draft, hindi]);
  const setScore = (key, score) => setDraft(current => current.map(item => item.key === key ? { ...item, score: Number(score) } : item));
  const rated = draft.filter(item => Number(item.score) > 0);
  const average = rated.length ? (rated.reduce((sum, item) => sum + Number(item.score), 0) / rated.length).toFixed(1) : "0.0";

  return <div className="v3-page v32-life-page">
    <section className="v3-panel">
      <div className="v3-panel-heading">
        <div><span className="v3-kicker">{hindi ? "जीवन के सभी महत्वपूर्ण क्षेत्र" : "YOUR LIFE AT A GLANCE"}</span><h3>{hindi ? "जीवन संतुलन" : "Life Areas"}</h3></div>
        <span className="v3-count">{rated.length}/7 {hindi ? "रेट किए गए" : "rated"}</span>
      </div>
      <p className="v3-muted">{hindi ? "हर क्षेत्र को 1 से 10 तक अंक दें। खाली क्षेत्र चार्ट में शून्य रहेंगे, कोई अनुमानित स्कोर नहीं जोड़ा जाएगा।" : "Rate each area from 1 to 10 based on how satisfied you feel today. Unrated areas remain at zero, LevelUp will not guess your scores."}</p>
      <div className="v32-life-chart">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} outerRadius="72%">
            <PolarGrid />
            <PolarAngleAxis dataKey="area" tick={{ fill: "var(--v3-text)", fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: "var(--v3-muted)", fontSize: 9 }} />
            <Radar name={hindi ? "आपका स्कोर" : "Your score"} dataKey="score" stroke="#9a7cff" fill="#9a7cff" fillOpacity={0.32} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="v32-life-average"><Heart size={17}/><span>{hindi ? "औसत संतुष्टि" : "Average satisfaction"}</span><b>{average}/10</b></div>
    </section>
    <section className="v3-panel">
      <div className="v3-panel-heading"><div><span className="v3-kicker">{hindi ? "अपना मूल्यांकन करें" : "YOUR SELF ASSESSMENT"}</span><h3>{hindi ? "प्रत्येक क्षेत्र को रेट करें" : "Rate each area"}</h3></div></div>
      <div className="v32-life-ratings">{draft.map(item => <label key={item.key}>
        <span>{hindi ? chartData.find(x => x.area && x.area === ({
          career: "करियर", business: "व्यवसाय", finance: "वित्त", health: "स्वास्थ्य",
          learning: "सीखना", relationships: "रिश्ते", personal: "व्यक्तिगत विकास"
        })[item.key])?.area : item.label}</span>
        <input type="range" min="0" max="10" value={item.score} onChange={event => setScore(item.key, event.target.value)} />
        <b>{item.score === 0 ? "Not rated" : item.score + "/10"}</b>
      </label>)}</div>
      <button className="v3-primary" onClick={() => onChange(draft)}><Save size={15}/>{hindi ? "स्कोर सेव करें" : "Save life area scores"}</button>
    </section>
  </div>;
}
