import { useState } from "react";

export default function SeriesCreateField({ onAdd }) {
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
  };

  return (
    <div className="fp-modal-series-create">
      <input
        type="text"
        className="fp-modal-series-create-input"
        placeholder="Yeni seri adı (ör. 52 B)"
        maxLength={32}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button
        type="button"
        className="fp-modal-series-create-btn"
        disabled={!name.trim()}
        onClick={submit}
      >
        Seri ekle
      </button>
    </div>
  );
}
